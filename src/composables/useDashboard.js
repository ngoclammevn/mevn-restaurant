import { orderSettlement, isOutstanding } from '../../shared/lunch-finance.js'
import { orderPriceItems } from '../lib/settlement-items'
import { MENU_CLOSURE_SELECT } from '../lib/menu-select'
import { useUser } from '@clerk/vue'
import { useSupabaseClient } from '../lib/supabase'

function parseDishPriceMap(note) {
  if (!note) return null
  try {
    const parsed = JSON.parse(note)
    if (!Array.isArray(parsed?.dishes)) return null
    const map = new Map()
    for (const d of parsed.dishes) {
      if (d?.name) {
        const price = d.price != null && d.price !== '' ? Number(d.price) : null
        map.set(d.name.trim().toLowerCase(), Number.isFinite(price) ? price : null)
      }
    }
    return map
  } catch {
    return null
  }
}

export function calcOrderPrice(itemText, dishMap, orderNote = null) {
  if (!itemText) return { price: null, lines: [] }
  const rawLines = itemText.split('\n').map((l) => l.trim()).filter(Boolean)
  if (!rawLines.length) return { price: null, lines: [] }

  if (dishMap) {
    let total = 0
    let allPriced = true
    let anyPriced = false
    const lines = rawLines.map((line) => {
      const unitPrice = dishMap.get(line.toLowerCase()) ?? null
      if (unitPrice != null) {
        total += unitPrice
        anyPriced = true
      } else {
        allPriced = false
      }
      return { name: line, price: unitPrice }
    })

    if (anyPriced) {
      return { price: total, allPriced, lines }
    }
  }

  // Fallback for legacy orders with selected_dish.price in order.note
  if (orderNote) {
    try {
      const parsed = JSON.parse(orderNote)
      const fallbackPrice = parsed?.selected_dish?.price != null ? Number(parsed.selected_dish.price) : null
      if (Number.isFinite(fallbackPrice)) {
        return {
          price: fallbackPrice,
          allPriced: true,
          lines: rawLines.map((line, i) => ({ name: line, price: i === 0 ? fallbackPrice : null })),
        }
      }
    } catch {}
  }

  return {
    price: null,
    allPriced: false,
    lines: rawLines.map((line) => ({ name: line, price: null })),
  }
}

export function useDashboard() {
  const { user } = useUser()
  const sb = useSupabaseClient()

  // Lấy toàn bộ danh sách thành viên chưa thanh toán trên tất cả các menu của tôi (không giới hạn ngày)
  async function unpaidByPersonForMyMenus() {
    const uid = user.value?.id
    if (!uid) return { data: [] }

    const { data, error } = await sb.from('menus')
      .select('id,title,menu_date,note,created_at,is_closed,payment_mode,'+MENU_CLOSURE_SELECT+',orders(id,item_text,note,is_paid,user_id,created_at,user:profiles!orders_user_id_fkey(id,full_name,avatar_url,provider_has_image,avatar_mode,mascot_id,uploaded_avatar_path))')
      .eq('poster_id', uid)
      .order('menu_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) return { error }

    const byPerson = new Map()
    for (const menu of data ?? []) {
      const dishMap = parseDishPriceMap(menu.note)
      for (const o of menu.orders ?? []) {
        if (!isOutstanding(menu,o)) continue
        const entry = byPerson.get(o.user_id) ?? {
          user_id: o.user_id,
          full_name: o.user?.full_name || '',
          avatar_url: o.user?.avatar_url || '', avatar: o.user,
          items: [],
          knownTotal: 0,
          hasPricedItem: false,
          hasUnpricedItem: false,
        }
        const price = orderSettlement(menu,o).amountDue
        if (price != null) {
          entry.knownTotal += price
          entry.hasPricedItem = true
        } else {
          entry.hasUnpricedItem = true
        }
        entry.items.push({
          order_id: o.id,
          menu_id: menu.id,
          menu_title: menu.title,
          menu_date: menu.menu_date,
          item_text: o.item_text,
          note: o.note,
          price,
        })
        byPerson.set(o.user_id, entry)
      }
    }

    const people = [...byPerson.values()].sort((a, b) => {
      if (b.items.length !== a.items.length) return b.items.length - a.items.length
      if (b.knownTotal !== a.knownTotal) return b.knownTotal - a.knownTotal
      return (a.full_name || '').localeCompare(b.full_name || '', 'vi')
    })

    return { data: people }
  }

  // Thống kê theo khoảng ngày (startDate -> endDate)
  async function fetchStatistics({ startDate = '', endDate = '', onlyMyMenus = true } = {}) {
    const uid = user.value?.id
    if (onlyMyMenus && !uid) return { data: null }

    let query = sb.from('menus')
      .select('id,title,menu_date,poster_id,note,is_closed,created_at,poster:profiles!menus_poster_id_fkey(id,full_name,avatar_url,provider_has_image,avatar_mode,mascot_id,uploaded_avatar_path),payment_mode,'+MENU_CLOSURE_SELECT+',orders(id,item_text,note,is_paid,paid_at,user_id,created_at,user:profiles!orders_user_id_fkey(id,full_name,avatar_url,provider_has_image,avatar_mode,mascot_id,uploaded_avatar_path))')
      .order('menu_date', { ascending: false })
      .order('created_at', { ascending: false })

    if ( startDate ) {
      query = query.gte('menu_date', startDate)
    }
    if ( endDate ) {
      query = query.lte('menu_date', endDate)
    }

    const { data, error } = await query
    if (error) return { error }

    const allMenusInPeriod = data ?? []

    // Tính số tiền cá nhân của user đã đặt ăn trong kỳ (trên mọi menu)
    let myPersonalOrdersCount = 0
    let myPersonalPaidOrdersCount = 0
    let myPersonalSpentAmount = 0
    let myPersonalPaidAmount = 0
    let myPersonalUnpaidAmount = 0

    for (const m of allMenusInPeriod) {
      const dMap = parseDishPriceMap(m.note)
      for (const o of m.orders ?? []) {
        if (uid && o.user_id === uid) {
          myPersonalOrdersCount++
          if (o.is_paid) myPersonalPaidOrdersCount++
          const price = orderSettlement(m,o).amountDue
          if (price != null) {
            myPersonalSpentAmount += price
            if (o.is_paid) myPersonalPaidAmount += price
            else myPersonalUnpaidAmount += price
          }
        }
      }
    }

    const menus = onlyMyMenus && uid
      ? allMenusInPeriod.filter((m) => m.poster_id === uid)
      : allMenusInPeriod

    let totalOrders = 0
    let paidOrders = 0
    let unpaidOrders = 0
    let totalAmount = 0 // Tổng tiền đã chi (tổng giá trị các suất đặt trên menu)
    let paidAmount = 0  // Tổng tiền đã thu (các đơn đã chuyển khoản)
    let unpaidAmount = 0 // Tổng tiền chưa thu (các đơn chưa chuyển khoản)
    let pricedOrdersCount = 0

    const memberMap = new Map()
    const dishAgg = new Map()
    const menuStats = []

    for (const menu of menus) {
      const dishMap = parseDishPriceMap(menu.note)
      const orders = menu.orders ?? []
      let menuPaid = 0
      let menuAmount = 0
      let menuPaidAmount = 0
      let menuHasPrice = false

      for (const o of orders) {
        totalOrders++
        if (menu.payment_mode!=='sponsored' && o.is_paid) {
          paidOrders++
          menuPaid++
        } else if (isOutstanding(menu,o)) {
          unpaidOrders++
        }

        const price=orderSettlement(menu,o).amountDue, lines=orderPriceItems(menu,o).map(item=>({name:item.name,price:item.unitPrice}))
        if (price != null) {
          pricedOrdersCount++
          totalAmount += price
          menuAmount += price
          menuHasPrice = true
          if (o.is_paid) {
            paidAmount += price
            menuPaidAmount += price
          } else {
            unpaidAmount += price
          }
        }

        // Member stats
        const mEntry = memberMap.get(o.user_id) ?? {
          user_id: o.user_id,
          full_name: o.user?.full_name || '(chưa đặt tên)',
          avatar_url: o.user?.avatar_url || '', avatar: o.user,
          totalOrders: 0,
          paidOrders: 0,
          unpaidOrders: 0,
          totalAmount: 0,
          paidAmount: 0,
          unpaidAmount: 0,
          hasPrice: false,
        }
        mEntry.totalOrders++
        if (menu.payment_mode!=='sponsored' && o.is_paid) {
          mEntry.paidOrders++
        } else if (isOutstanding(menu,o)) {
          mEntry.unpaidOrders++
        }
        if (price != null) {
          mEntry.hasPrice = true
          mEntry.totalAmount += price
          if (o.is_paid) mEntry.paidAmount += price
          else mEntry.unpaidAmount += price
        }
        memberMap.set(o.user_id, mEntry)

        // Dish stats
        const rawLines = lines.length
          ? lines
          : (o.item_text || '').split('\n').map((l) => ({ name: l.trim(), price: null })).filter((l) => l.name)
        for (const l of rawLines) {
          const key = l.name.toLowerCase()
          const dEntry = dishAgg.get(key) ?? {
            name: l.name,
            count: 0,
            totalAmount: 0,
            hasPrice: false,
          }
          dEntry.count++
          if (l.price != null) {
            dEntry.hasPrice = true
            dEntry.totalAmount += l.price
          }
          dishAgg.set(key, dEntry)
        }
      }

      menuStats.push({
        id: menu.id,
        title: menu.title,
        menu_date: menu.menu_date,
        poster_name: menu.poster?.full_name || '',
        totalOrders: orders.length,
        paidOrders: menuPaid,
        unpaidOrders: orders.filter(order=>isOutstanding(menu,order)).length,
        totalAmount: menuAmount,
        paidAmount: menuPaidAmount,
        hasPrice: menuHasPrice,
      })
    }

    const byMember = [...memberMap.values()].sort((a, b) => {
      if (b.totalAmount !== a.totalAmount) return b.totalAmount - a.totalAmount
      if (b.totalOrders !== a.totalOrders) return b.totalOrders - a.totalOrders
      return a.full_name.localeCompare(b.full_name, 'vi')
    })

    const topDishes = [...dishAgg.values()]
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'vi'))
      .slice(0, 10)

    return {
      data: {
        summary: {
          totalMenus: menus.length,
          totalOrders,
          paidOrders,
          unpaidOrders,
          paidRate: totalOrders > 0 ? Math.round((paidOrders / totalOrders) * 100) : 0,
          amountCollectedRate: totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0,
          uniqueMembers: memberMap.size,
          totalAmount,
          paidAmount,
          unpaidAmount,
          hasPrice: pricedOrdersCount > 0,
          myPersonalOrdersCount,
          myPersonalPaidOrdersCount,
          myPersonalSpentAmount,
          myPersonalPaidAmount,
          myPersonalUnpaidAmount,
        },
        byMember,
        topDishes,
        byMenu: menuStats,
      },
    }
  }

  return { unpaidByPersonForMyMenus, fetchStatistics }
}

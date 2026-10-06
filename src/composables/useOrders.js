import { useUser } from '@clerk/vue'
import { useSupabaseClient } from '../lib/supabase'
import { normalizeMenu } from '../lib/menu'

const ORDER_SELECT = '*,order_items:order_items!order_items_order_id_menu_id_fkey(*,review:dish_reviews!dish_reviews_order_item_id_fkey(*))'
const HISTORY_SELECT = `${ORDER_SELECT},user:profiles!orders_user_id_fkey(id,full_name,avatar_url),
  menu:menus!orders_menu_id_fkey!inner(*,restaurant:restaurants!menus_restaurant_id_fkey(id,name,branch),
  poster:profiles!menus_poster_id_fkey(id,full_name,avatar_url,payment_info),
  menu_items:menu_items!menu_items_menu_id_fkey(*,dish:restaurant_dishes!menu_items_restaurant_dish_id_fkey(id,restaurant_id,name,variant)))`
const signedOut = () => ({ data: null, error: new Error('Vui lòng đăng nhập.') })

function orderResult(result) {
  if (result.error) return result
  const normalize = order => order && {
    ...order,
    ...(order.menu ? { menu: normalizeMenu(order.menu) } : {}),
    order_items: [...(order.order_items ?? [])].sort((a, b) => a.position - b.position),
  }
  return { ...result, data: Array.isArray(result.data) ? result.data.map(normalize) : normalize(result.data) }
}

export function useOrders() {
  const { user } = useUser()
  const sb = useSupabaseClient()

  // user_id optional: pass another person's id to order on their behalf.
  // RLS orders_insert is relaxed to allow this (trusted group <25).
  async function createOrder({ menu_id, item_text, note = null, user_id = null, menu_item_ids }) {
    if (!user.value?.id) return signedOut()
    const uid = user_id ?? user.value.id
    return orderResult(await sb.from('orders')
      .insert({ menu_id, user_id: uid, item_text, note, ...(menu_item_ids !== undefined ? { menu_item_ids } : {}) })
      .select(ORDER_SELECT)
      .single())
  }

  async function listProfiles() {
    if (!user.value?.id) return signedOut()
    return sb.from('profiles').select('id, full_name, avatar_url').order('full_name')
  }

  // Only the order owner can update is_paid (enforced by RLS orders_update).
  async function togglePaid(orderId, isPaid) {
    const uid = user.value?.id
    if (!uid) return signedOut()
    const result = await sb.from('orders')
      .update({ is_paid: isPaid, paid_at: isPaid ? new Date().toISOString() : null })
      .eq('id', orderId).eq('user_id', uid)
      .select(ORDER_SELECT)
      .single()
    if (user.value?.id !== uid) return signedOut()
    return orderResult(result)
  }

  async function updateOrder({ id, item_text, note = null, menu_item_ids }) {
    const uid = user.value?.id
    if (!uid) return signedOut()
    return orderResult(await sb.from('orders')
      .update({ item_text, note, ...(menu_item_ids !== undefined ? { menu_item_ids } : {}) })
      .eq('id', id).eq('user_id', uid)
      .select(ORDER_SELECT)
      .single())
  }

  async function listMyOrders({ from, to, unpaidOnly = false, offset, limit } = {}) {
    const uid = user.value?.id
    if (!uid) return signedOut()
    if ((from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) || (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) || (from && to && from > to)) {
      return { data: null, error: new Error('Khoảng ngày không hợp lệ.') }
    }
    const paginated = offset !== undefined || limit !== undefined
    const start = offset ?? 0, pageSize = limit ?? 100
    if (paginated && (!Number.isInteger(start) || start < 0 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000)) {
      return { data: null, error: new Error('Khoảng tải đơn không hợp lệ.') }
    }
    let query = sb.from('orders')
      .select(HISTORY_SELECT, paginated ? { count: 'exact' } : undefined)
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
    if (from) query = query.gte('menu.menu_date', from)
    if (to) query = query.lte('menu.menu_date', to)
    if (unpaidOnly) query = query.eq('is_paid', false)
    if (paginated) query = query.range(start, start + pageSize - 1)
    const result = await query
    if (user.value?.id !== uid) return signedOut()
    return orderResult(result)
  }

  async function listMyUnpaidOrders(range = {}) {
    return listMyOrders({ ...range, unpaidOnly: true })
  }

  return { createOrder, updateOrder, togglePaid, listMyOrders, listMyUnpaidOrders, listProfiles }
}

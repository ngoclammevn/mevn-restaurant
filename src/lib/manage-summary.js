import { orderSettlement, isOutstanding } from '../../shared/lunch-finance.js'
import { orderPriceItems } from './settlement-items'
export function managedOrderAmount(menu,order) { return orderSettlement(menu,order).amountDue }
export function summarizeManagedMenu(menu) {
  const grouped = new Map()
  for (const order of menu?.orders || []) for (const item of orderPriceItems(menu, order)) {
    if (!grouped.has(item.key)) grouped.set(item.key, { ...item, servings: 0, knownTotal: 0, unknownPriceCount: 0, people: [] })
    const row = grouped.get(item.key)
    row.servings++
    if (item.unitPrice === null) row.unknownPriceCount++
    else row.knownTotal += item.unitPrice
    row.people.push({ orderId: order.id, userId: order.user_id, name: order.user?.full_name || 'Chưa đặt tên', note: order.note || '' })
  }
  const orderedDishes = [...grouped.values()].sort((a, b) => b.servings - a.servings || a.name.localeCompare(b.name, 'vi'))
  return { orderedDishes, servings: orderedDishes.reduce((sum, row) => sum + row.servings, 0), orderedDishCount: orderedDishes.length,
    paidCount: (menu?.orders || []).filter(o => menu.payment_mode!=='sponsored' && o.is_paid).length, unpaidCount: (menu?.orders || []).filter(o => isOutstanding(menu,o)).length, sponsoredCount: menu?.payment_mode==='sponsored'?(menu.orders || []).length:0,
    knownTotal: orderedDishes.reduce((sum, row) => sum + row.knownTotal, 0), unknownPriceCount: orderedDishes.reduce((sum, row) => sum + row.unknownPriceCount, 0) }
}
export function groupOutstandingOrders(orders) {
  const groups = new Map()
  for (const order of orders || []) {
    if (!isOutstanding(order.menu,order)) continue
    const date = order.menu?.menu_date || ''
    if (!groups.has(order.user_id)) groups.set(order.user_id, { userId: order.user_id, name: order.user?.full_name || 'Chưa đặt tên', count: 0, knownTotal: 0, unknownAmountCount: 0, oldestDate: date, entries: [] })
    const group = groups.get(order.user_id), amount = managedOrderAmount(order.menu, order)
    group.count++
    if (amount === null) group.unknownAmountCount++
    else group.knownTotal += amount
    if (date && (!group.oldestDate || date < group.oldestDate)) group.oldestDate = date
    group.entries.push({ ...order, amount })
  }
  return [...groups.values()].map(group => ({ ...group, entries: group.entries.sort((a, b) => (a.menu?.menu_date || '').localeCompare(b.menu?.menu_date || '')) }))
}

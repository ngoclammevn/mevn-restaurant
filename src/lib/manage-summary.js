import { menuDishes } from './menu'

const priceOf = dish => typeof dish?.price === 'number' && Number.isFinite(dish.price) && dish.price >= 0 ? dish.price : null
function selections(menu, order) {
  const dishes = menuDishes(menu)
  const byId = new Map(dishes.filter(d => d.id).map(d => [d.id, d]))
  const legacySelections = text => String(text || '').split('\n').map(name => name.trim()).filter(Boolean).map(name => {
    const matches = dishes.filter(d => d.name === name)
    const dish = matches.length === 1 ? matches[0] : null
    return { key: dish?.id ? `menu-item:${dish.id}` : `legacy:${name}`, menuItemId: dish?.id || null, name, unitPrice: priceOf(dish) }
  })
  if (order.order_items?.length) return order.order_items.flatMap(item => {
    if (!item.menu_item_id) return legacySelections(item.name_snapshot || order.item_text)
    const dish = byId.get(item.menu_item_id)
    return [{ key: `menu-item:${item.menu_item_id}`, menuItemId: item.menu_item_id, name: dish?.name || item.name_snapshot || 'Món không còn trong menu', unitPrice: priceOf(dish) }]
  })
  return legacySelections(order.item_text)
}
export function managedOrderAmount(menu, order) {
  const items = selections(menu, order)
  return !items.length || items.some(item => item.unitPrice === null) ? null : items.reduce((sum, item) => sum + item.unitPrice, 0)
}
export function summarizeManagedMenu(menu) {
  const grouped = new Map()
  for (const order of menu?.orders || []) for (const item of selections(menu, order)) {
    if (!grouped.has(item.key)) grouped.set(item.key, { ...item, servings: 0, knownTotal: 0, unknownPriceCount: 0, people: [] })
    const row = grouped.get(item.key)
    row.servings++
    if (item.unitPrice === null) row.unknownPriceCount++
    else row.knownTotal += item.unitPrice
    row.people.push({ orderId: order.id, userId: order.user_id, name: order.user?.full_name || 'Chưa đặt tên', note: order.note || '' })
  }
  const orderedDishes = [...grouped.values()].sort((a, b) => b.servings - a.servings || a.name.localeCompare(b.name, 'vi'))
  return { orderedDishes, servings: orderedDishes.reduce((sum, row) => sum + row.servings, 0), orderedDishCount: orderedDishes.length,
    paidCount: (menu?.orders || []).filter(o => o.is_paid).length, unpaidCount: (menu?.orders || []).filter(o => !o.is_paid).length,
    knownTotal: orderedDishes.reduce((sum, row) => sum + row.knownTotal, 0), unknownPriceCount: orderedDishes.reduce((sum, row) => sum + row.unknownPriceCount, 0) }
}
export function groupOutstandingOrders(orders) {
  const groups = new Map()
  for (const order of orders || []) {
    if (order.is_paid) continue
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

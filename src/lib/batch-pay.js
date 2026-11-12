import { managedOrderAmount } from './manage-summary'

// Gom đơn chưa trả theo người đăng menu: mỗi người một tài khoản nhận nên mỗi nhóm một mã QR.
// Đơn chưa có giá không được gom (trả riêng sau) để không ai chuyển thiếu mà tưởng đã đủ.
export function batchGroups(orders) {
  const groups = new Map()
  for (const order of orders) {
    const posterId = order.menu?.poster_id
    if (!posterId) continue
    if (!groups.has(posterId)) groups.set(posterId, { posterId, poster: order.menu.poster, priced: [], unpriced: [] })
    const amount = managedOrderAmount(order.menu, order), group = groups.get(posterId)
    if (amount == null) group.unpriced.push(order)
    else group.priced.push({ order, amount })
  }
  const byDate = (a, b) => a.order.menu.menu_date.localeCompare(b.order.menu.menu_date)
  return [...groups.values()].map(group => ({ ...group, priced: [...group.priced].sort(byDate) }))
}

// Tóm tắt các đơn được chọn: tổng tiền, số bữa, ngày đầu và ngày cuối (YYYY-MM-DD).
export function batchSummary(entries) {
  const dates = [...new Set(entries.map(entry => entry.order.menu.menu_date))].sort()
  return { total: entries.reduce((sum, entry) => sum + entry.amount, 0), count: entries.length, from: dates[0], to: dates[dates.length - 1], dates }
}

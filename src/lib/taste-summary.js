import { reviewForItem } from './menu'

// Observed choices and user-written reviews only. Never group dishes by name.
export function summarizeTaste(orders = [], { from, to } = {}) {
  const selected = orders.filter(order => order.menu?.menu_date && (!from || order.menu.menu_date >= from) && (!to || order.menu.menu_date <= to))
  const groups = new Map(), labels = new Map(), reviewedDays = new Set(), seenReviews = new Set()
  let reviewCount = 0
  for (const order of selected) {
    const menu = order.menu
    for (const item of order.order_items ?? []) {
      const menuItem = (menu.menu_items ?? []).find(entry => entry.id === item.menu_item_id)
      const dishId = menuItem?.restaurant_dish_id ?? null
      const restaurantId = menu.restaurant_id ?? menuItem?.dish?.restaurant_id ?? null
      const key = restaurantId && dishId ? `${restaurantId}:${dishId}` : item.menu_item_id ? `menu-item:${item.menu_item_id}` : `order-item:${item.id ?? order.id}`
      if (!groups.has(key)) groups.set(key, {
        key, restaurantId, restaurantName: menu.restaurant?.name || item.restaurant_name_snapshot || '',
        dishId, dishName: menuItem?.dish?.name || item.name_snapshot || menuItem?.name || 'Món đã đặt',
        orderCount: 0, reviewCount: 0, averageRating: null, ratingTotal: 0,
        menuId: menu.id, menuDate: menu.menu_date,
      })
      const group = groups.get(key)
      group.orderCount++
      if (menu.menu_date > group.menuDate) { group.menuId = menu.id; group.menuDate = menu.menu_date }
      const review = reviewForItem(item)
      const rating = Number(review?.rating)
      const reviewKey = review?.id ?? item.id
      if (!review || review.deleted_at || review.is_deleted || !Number.isFinite(rating) || rating < 1 || rating > 5 || seenReviews.has(reviewKey)) continue
      seenReviews.add(reviewKey)
      group.reviewCount++; group.ratingTotal += rating; reviewCount++
      reviewedDays.add(menu.menu_date)
      for (const label of new Set(review.labels ?? [])) if (typeof label === 'string' && label.trim()) labels.set(label, (labels.get(label) ?? 0) + 1)
    }
  }
  const dishes = [...groups.values()].map(({ ratingTotal, ...dish }) => ({ ...dish, averageRating: dish.reviewCount ? ratingTotal / dish.reviewCount : null }))
  return {
    from, to, orderCount: selected.length, reviewCount, reviewedDayCount: reviewedDays.size,
    frequentDishes: dishes.sort((a, b) => b.orderCount - a.orderCount || a.dishName.localeCompare(b.dishName, 'vi')),
    likedDishes: dishes.filter(dish => dish.reviewCount && dish.averageRating >= 4).sort((a, b) => b.averageRating - a.averageRating || b.reviewCount - a.reviewCount),
    commonLabels: [...labels].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'vi')),
  }
}

export function parseStructuredMenu(note) {
  if (typeof note !== 'string') return null

  try {
    const parsed = JSON.parse(note)
    return Array.isArray(parsed?.dishes) ? parsed.dishes : null
  } catch {
    return null
  }
}

export function calculateSelection(dishes) {
  const selection = Array.isArray(dishes) ? dishes : []
  const prices = selection.map(dish => dish?.price)

  return {
    count: selection.length,
    total: prices.every(price => typeof price === 'number' && Number.isFinite(price))
      ? prices.reduce((sum, price) => sum + price, 0)
      : null,
  }
}

export function exactDishMatches(itemText, dishes) {
  if (typeof itemText !== 'string' || !Array.isArray(dishes)) return []

  const selectedNames = new Set(itemText.split('\n'))
  return dishes.filter(dish => typeof dish?.name === 'string' && selectedNames.has(dish.name))
}

export function canSelfPay(currentUserId, order) {
  return typeof currentUserId === 'string'
    && currentUserId.length > 0
    && order?.user_id === currentUserId
}

function price(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100000000 ? value : null
}
function sumKnown(values) {
  return values.length > 0 && values.every(v => v !== null) ? values.reduce((sum, v) => sum + v, 0) : null
}
function currentAmount(menu, order) {
  let dishes = menu.menu_items ?? menu.items
  if (!Array.isArray(dishes)) {
    try { dishes = JSON.parse(menu.note ?? '').dishes } catch { return null }
  }
  if (!Array.isArray(dishes)) return null
  if (Array.isArray(order.menu_item_ids) && order.menu_item_ids.length) {
    return sumKnown(order.menu_item_ids.map(id => {
      const matches = dishes.filter(d => d.id === id)
      return matches.length === 1 ? price(matches[0].price) : null
    }))
  }
  const names = String(order.item_text ?? '').split('\n')
  return sumKnown(names.map(name => {
    const matches = dishes.filter(d => d.name === name)
    return matches.length === 1 ? price(matches[0].price) : null
  }))
}
export function orderSettlement(menu = {}, order = {}, closureItems) {
  const closure = Array.isArray(menu.current_closure) ? menu.current_closure[0] : menu.current_closure
  const frozen = closureItems ?? (menu.is_closed && closure ? (closure.items ?? []).filter(item => item.order_id === order.id) : undefined)
  const priceSource = frozen !== undefined ? 'frozen' : menu.is_closed ? 'legacy_unknown' : 'current'
  const vendorAmount = frozen !== undefined ? sumKnown(frozen.map(item => price(item.unit_price)))
    : menu.is_closed ? null : currentAmount(menu, order)
  const sponsored = (menu.is_closed && closure ? closure.payment_mode ?? menu.payment_mode : menu.payment_mode) === 'sponsored'
  return { vendorAmount, amountDue: sponsored ? 0 : vendorAmount,
    paymentState: sponsored ? 'sponsored' : order.is_paid ? 'paid' : 'unpaid', priceSource }
}
export function isOutstanding(menu = {}, order = {}) {
  return menu.payment_mode !== 'sponsored' && !order.is_paid
}

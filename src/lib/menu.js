export function parseMenuNote(note) {
  try {
    const value = JSON.parse(note)
    if (!Array.isArray(value?.dishes) || !value.dishes.every(d => typeof d?.name === 'string' && d.name.trim())) return null
    return value
  } catch { return null }
}

export function normalizeMenu(menu) {
  if (!menu) return menu
  const parsed = parseMenuNote(menu.note)
  const items = menu.menu_items?.length ? [...menu.menu_items].sort((a, b) => a.position - b.position) : parsed?.dishes
  return items ? { ...menu, note: JSON.stringify({ ...parsed, dishes: items }) } : menu
}

export function menuDishes(menuOrNote) {
  if (typeof menuOrNote === 'string') return parseMenuNote(menuOrNote)?.dishes ?? []
  return parseMenuNote(normalizeMenu(menuOrNote)?.note)?.dishes ?? []
}

export function serializeMenu(dishes, notes = '') {
  return JSON.stringify({ notes, dishes })
}

export function reviewForItem(item) {
  const value = item?.review ?? item?.dish_reviews
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

export function exportMenuCsv(menu) {
  const cell = value => {
    let text = String(value ?? '')
    if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text
    return '"' + text.replaceAll('"', '""') + '"'
  }
  const rows = [['Ngày', 'Quán', 'Người đặt', 'Món', 'Ghi chú', 'Thanh toán']]
  for (const order of menu.orders ?? []) {
    rows.push([menu.menu_date, menu.restaurant?.name ?? '', order.user?.full_name ?? '', order.item_text, order.note ?? '', order.is_paid ? 'Đã trả' : 'Chưa trả'])
  }
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n')
}

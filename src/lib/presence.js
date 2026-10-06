const online = () => ({ page: 'online', label: 'Đang online', menuId: null, restaurantName: null, picks: [] })
const text = (value, length) => typeof value === 'string' ? value.replace(/[\r\n]/g, ' ').trim().slice(0, length) : ''
export function serializePresenceContext({ path, menu = null, picks = [] } = {}) {
  const pathname = typeof path === 'string' ? path.split(/[?#]/)[0] : ''
  if (pathname === '/') return { ...online(), page: 'today', label: 'Đang xem Hôm nay' }
  const match = /^\/menu\/([^/]+)$/.exec(pathname)
  if (!match) return online()
  let routeId
  try { routeId = decodeURIComponent(match[1]) } catch { return online() }
  const id = text(menu?.id, 128)
  const validMenu = id && id === routeId
  return { ...online(), page: 'menu', label: 'Đang xem menu',
    menuId: validMenu ? id : null,
    restaurantName: validMenu ? text(menu?.restaurantName, 240) || null : null,
    picks: validMenu && Array.isArray(picks) ? [...new Set(picks.map(value => text(value, 240)).filter(Boolean))].slice(0, 20) : [] }
}
export function normalizePresenceEntry(entry) {
  if (!entry || typeof entry !== 'object' || typeof entry.userId !== 'string' || !entry.userId.trim() || entry.userId.length > 160) return null
  const context = serializePresenceContext({ path: entry.page === 'today' ? '/' : entry.page === 'menu' && entry.menuId ? '/menu/' + encodeURIComponent(entry.menuId) : '',
    menu: { id: entry.menuId, restaurantName: entry.restaurantName }, picks: entry.picks })
  return { id: entry.userId, name: text(entry.name, 120) || 'Thành viên', ...context,
    updatedAt: Number.isFinite(entry.updatedAt) ? Math.min(entry.updatedAt, Date.now()) : 0 }
}
export function dedupeViewers(state) {
  const groups = new Map()
  for (const values of Object.values(state ?? {})) for (const value of Array.isArray(values) ? values : []) {
    const entry = normalizePresenceEntry(value)
    if (!entry) continue
    if (!groups.has(entry.id)) groups.set(entry.id, [])
    groups.get(entry.id).push(entry)
  }
  return [...groups.values()].map(entries => {
    entries.sort((a, b) => b.updatedAt - a.updatedAt)
    // Choose one active context. Never union dish names from different menus/tabs.
    return entries.find(entry => entry.page !== 'online') || entries[0]
  }).sort((a, b) => a.name.localeCompare(b.name, 'vi'))
}

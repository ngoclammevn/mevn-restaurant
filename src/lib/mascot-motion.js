// Direction math ported from nilbuild/page-mascot (MIT); shared Vue lifecycle.
const CLOCKWISE = ['right', 'down-right', 'down', 'down-left', 'left', 'up-left', 'up', 'up-right']
const SECTOR = Math.PI / 4
export function directionForPointer(rect, point, previousSector = -1) {
  const dx = point.x - (rect.left + rect.width / 2), dy = point.y - (rect.top + rect.height / 2)
  if (Math.hypot(dx, dy) < 70) return { direction: 'center', sector: -1 }
  const angle = Math.atan2(dy, dx)
  const delta = Math.atan2(Math.sin(angle - previousSector * SECTOR), Math.cos(angle - previousSector * SECTOR))
  const sector = previousSector >= 0 && Math.abs(delta) < SECTOR / 2 + 0.12
    ? previousSector : (Math.round(angle / SECTOR) + 8) % 8
  return { direction: CLOCKWISE[sector], sector }
}
const entries = new Map()
let observer, reduced, fine, pointer = null, frame = 0, listening = false
function aim() {
  frame = 0
  if (!pointer) return
  for (const [element, entry] of entries) {
    if (!entry.active) continue
    const next = directionForPointer(element.getBoundingClientRect(), pointer, entry.sector)
    entry.sector = next.sector
    entry.onDirection(next.direction)
  }
}
function schedule() { if (!frame && listening) frame = window.requestAnimationFrame(aim) }
function move(event) { pointer = { x: event.clientX, y: event.clientY }; schedule() }
function reconcile() {
  let active = false
  for (const entry of entries.values()) {
    const next = entry.visible && document.visibilityState !== 'hidden' && !reduced.matches
    if (entry.active !== next) {
      entry.active = next
      entry.onActivity?.(next)
      if (!next) { entry.sector = -1; entry.onDirection('center') }
    }
    active ||= next
  }
  const shouldListen = active && fine.matches
  if (shouldListen === listening) return
  listening = shouldListen
  if (listening) {
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('scroll', schedule, { passive: true, capture: true })
    schedule()
  } else {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('scroll', schedule, true)
    if (frame) window.cancelAnimationFrame(frame)
    frame = 0; pointer = null
  }
}
export function registerMascotMotion(element, onDirection, { onActivity } = {}) {
  if (typeof window === 'undefined') return () => {}
  if (!entries.size) {
    reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    fine = window.matchMedia('(hover: hover) and (pointer: fine)')
    reduced.addEventListener('change', reconcile); fine.addEventListener('change', reconcile)
    document.addEventListener('visibilitychange', reconcile)
    if (typeof IntersectionObserver !== 'undefined') observer = new IntersectionObserver(records => {
      for (const record of records) { const entry = entries.get(record.target); if (entry) entry.visible = record.isIntersecting }
      reconcile()
    })
  }
  entries.set(element, { onDirection, onActivity, visible: !observer, active: false, sector: -1 })
  observer?.observe(element)
  reconcile()
  let disposed = false
  return () => {
    if (disposed) return
    disposed = true
    entries.get(element)?.onActivity?.(false)
    entries.delete(element); observer?.unobserve(element)
    reconcile()
    if (!entries.size) {
      observer?.disconnect(); observer = undefined
      reduced.removeEventListener('change', reconcile); fine.removeEventListener('change', reconcile)
      document.removeEventListener('visibilitychange', reconcile)
    }
  }
}

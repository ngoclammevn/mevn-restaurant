import { ref, shallowRef, provide, inject, watch, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useUser, useSession } from '@clerk/vue'
import { useSupabaseClient } from '../lib/supabase'
import { serializePresenceContext, dedupeViewers } from '../lib/presence'
const KEY = Symbol('app-presence')
const noopContext = { viewers: ref([]), connected: ref(false), setMenuDraft() {}, clearMenuDraft() {}, notifyOrderChanged() {}, onOrderChanged() { return () => {} } }
export function useAppPresence() { return inject(KEY, noopContext) }
export function provideAppPresence() {
  const route = useRoute(), { user } = useUser(), { session } = useSession(), sb = useSupabaseClient()
  const viewers = shallowRef([]), connected = ref(false), draft = shallowRef({ menu: null, names: [] })
  const callbacks = new Set(), pendingEvents = new Set(), received = new Map()
  let channel = null, epoch = 0, trackTimer, eventTimer, alive = true, trackQueue = Promise.resolve()
  const deviceId = crypto.randomUUID()
  function payload() {
    return { userId: user.value?.id, name: user.value?.fullName || user.value?.firstName || 'Thành viên', updatedAt: Date.now(),
      ...serializePresenceContext({ path: route.path, menu: draft.value.menu, picks: draft.value.names }) }
  }
  function track(immediate = false) {
    clearTimeout(trackTimer)
    const current = epoch
    const run = () => {
      trackQueue = trackQueue.catch(() => {}).then(async () => {
        if (!alive || epoch !== current || !connected.value || !channel || !user.value) return
        const result = await channel.track(payload())
        if (current === epoch && result !== 'ok') connected.value = false
      }).catch(() => { if (epoch === current) connected.value = false })
    }
    if (immediate) run(); else trackTimer = setTimeout(run, 250)
  }
  function cleanup() {
    epoch++; clearTimeout(trackTimer); clearTimeout(eventTimer); pendingEvents.clear(); received.clear()
    const old = channel; channel = null; connected.value = false; viewers.value = []; draft.value = { menu: null, names: [] }
    if (old) { old.untrack().catch(() => {}); sb.removeChannel(old).catch(() => {}) }
  }
  async function connect() {
    cleanup()
    const uid = user.value?.id, sid = session.value?.id, current = epoch
    if (!uid || !sid || !alive) return
    try {
      const token = await session.value.getToken()
      if (!token || !alive || current !== epoch || user.value?.id !== uid) return
      await sb.realtime.setAuth(token)
      if (!alive || current !== epoch || user.value?.id !== uid) return
      const active = sb.channel('lunch-activity:v1', { config: { presence: { key: deviceId }, broadcast: { self: false } } })
      channel = active
      active.on('presence', { event: 'sync' }, () => { if (channel === active && current === epoch) viewers.value = dedupeViewers(active.presenceState()) })
        .on('broadcast', { event: 'menu_changed' }, ({ payload: event }) => {
          if (channel !== active || current !== epoch) return
          const id = event?.menuId
          if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return
          const now = Date.now()
          if (now - (received.get(id) || 0) < 750) return
          if (received.size > 100) received.clear()
          received.set(id, now)
          for (const callback of callbacks) callback(id)
        })
        .subscribe(status => {
          if (channel !== active || epoch !== current) return
          connected.value = status === 'SUBSCRIBED'
          if (connected.value) track(true)
          else viewers.value = []
        })
    } catch { if (current === epoch) connected.value = false }
  }
  function setMenuDraft(menu, names) {
    const context = serializePresenceContext({ path: route.path, menu, picks: names })
    if (context.page !== 'menu' || !context.menuId) return
    draft.value = { menu: { id: context.menuId, restaurantName: context.restaurantName }, names: context.picks }
    track()
  }
  function clearMenuDraft() { draft.value = { menu: null, names: [] }; track(true) }
  function notifyOrderChanged(menuId) {
    if (typeof menuId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(menuId) || !user.value) return
    pendingEvents.add(menuId); clearTimeout(eventTimer)
    const current = epoch
    eventTimer = setTimeout(() => {
      if (current !== epoch || !alive) return
      for (const id of pendingEvents) {
        for (const callback of callbacks) callback(id)
        if (channel && connected.value) channel.send({ type: 'broadcast', event: 'menu_changed', payload: { menuId: id } }).catch(() => {})
      }
      pendingEvents.clear()
    }, 250)
  }
  function onOrderChanged(callback) { callbacks.add(callback); return () => callbacks.delete(callback) }
  watch(() => route.path, () => { clearMenuDraft() }, { flush: 'sync' })
  watch([() => user.value?.id, () => session.value?.id], connect, { immediate: true })
  onUnmounted(() => { alive = false; cleanup(); callbacks.clear() })
  const context = { viewers, connected, setMenuDraft, clearMenuDraft, notifyOrderChanged, onOrderChanged }
  provide(KEY, context)
  return context
}

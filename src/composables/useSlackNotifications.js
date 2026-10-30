import { onUnmounted, ref, watch } from 'vue'
import { useSession } from '@clerk/vue'
import { useLunchApi } from '../lib/lunch-api'

export function useSlackNotifications() {
  const { session } = useSession()
  const { callLunchApi } = useLunchApi()
  const states = ref({})
  const controllers = new Set()
  const requests = new Map()
  let ownedMenuIds = []
  function cancel() { for (const controller of controllers) controller.abort(); controllers.clear(); requests.clear(); ownedMenuIds=[]; states.value = {} }
  watch(() => session.value?.id, cancel)
  onUnmounted(cancel)
  async function send(action, body, key = body.menu_id || body.event_id) {
    if (!session.value) return { status: 'pending', error: 'unauthenticated' }
    const sessionId = session.value.id
    const controller = new AbortController()
    controllers.add(controller)
    const request = {action,body:{...body}}
    // A durable retry names its own event. A new action must never inherit the
    // previous action's event ID merely because both belong to the same menu.
    const eventId = action === 'retry' || action === 'resolve' ? body.event_id : undefined
    if (action !== 'sync') {
      requests.set(key,request)
      states.value = { ...states.value, [key]: { status:'sending', ...(eventId ? {eventId} : {}) } }
    }
    try {
      const result = await callLunchApi(`/v1/slack/${action}`, body, { signal: controller.signal })
      if (action !== 'sync' && requests.get(key) === request && session.value?.id === sessionId && !controller.signal.aborted) states.value = { ...states.value, [key]: result }
      return result
    } catch (error) {
      const result = { status: 'pending', error: error.code || 'request_interrupted', ...(eventId ? {eventId} : {}) }
      if (action !== 'sync' && requests.get(key) === request && session.value?.id === sessionId && !controller.signal.aborted) states.value = { ...states.value, [key]: result }
      return result
    } finally { controllers.delete(controller) }
  }
  const menuId = value => typeof value === 'string' ? value : value.menu_id || value.menuId || value.id
  const publishMenu = id => send('publish', { menu_id: menuId(id) })
  const shareMenu = (id, revision = 1) => send('share', { menu_id: menuId(id), revision })
  const notifyClosure = result => send('closed', { menu_id: menuId(result), ...(result.revision == null ? {} : { revision: result.revision }) })
  const notifyReopened = result => send('reopened', { menu_id: menuId(result) })
  const notifyPickupChanged = result => send('pickup-changed', { menu_id: menuId(result) })
  const notifyReceived = result => send('received', { menu_id: menuId(result) })
  const syncReminder = id => send('reminder', { menu_id: menuId(id) })
  const retryEvent = (eventId, menuId) => send('retry', { event_id: eventId }, menuId || eventId)
  const resolveEvent = (eventId, resolution, menuId) => send('resolve', { event_id: eventId, resolution }, menuId || eventId)
  const linkSlackAccount = memberId => send('link-account', { member_id: memberId }, 'account')
  function retryPending(id) {
    const key = menuId(id), state = states.value[key]
    if (state?.eventId) return retryEvent(state.eventId,key)
    const request = requests.get(key)
    return request ? send(request.action,request.body,key) : Promise.resolve({status:'pending',error:'no_pending_action'})
  }
  async function syncPendingForMyMenus(menuIds = ownedMenuIds) {
    ownedMenuIds = menuIds.map(menuId)
    const id = session.value?.id
    for (const menu of ownedMenuIds) {
      if (!id || session.value?.id !== id) break
      if (states.value[menu]?.status === 'pending' && requests.has(menu)) await retryPending(menu)
      else await publishMenu(menu)
      const result = await send('sync', { menu_id: menu }, menu)
      for (const event of result.events || []) {
        if (session.value?.id !== id) break
        if (['pending', 'retryable', 'cancel_pending'].includes(event.status) && (!event.next_attempt_at || Date.parse(event.next_attempt_at) <= Date.now())) await retryEvent(event.id, menu)
        else if (event.status === 'unknown') states.value = { ...states.value, [menu]: { status: 'unknown', eventId: event.id } }
      }
    }
  }
  const online = () => { void syncPendingForMyMenus() }
  if (typeof window !== 'undefined') window.addEventListener('online', online)
  onUnmounted(() => { if (typeof window !== 'undefined') window.removeEventListener('online', online) })
  return { states, publishMenu, shareMenu, notifyClosure, notifyReopened, notifyPickupChanged, notifyReceived, syncReminder, retryEvent, retryPending, resolveEvent, linkSlackAccount, syncPendingForMyMenus }
}

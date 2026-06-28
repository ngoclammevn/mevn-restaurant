import { ref, onUnmounted, watch } from 'vue'
import { useUser, useSession } from '@clerk/vue'
import { useSupabaseClient } from '../lib/supabase'

const PERSON_COLORS = ['#e85d3a','#3b82f6','#f59e0b','#8b5cf6','#10b981','#ec4899','#f97316','#06b6d4']
const ANIMALS = ['Gấu','Voi','Hổ','Cáo','Thỏ','Cá heo','Rùa','Mèo','Bướm','Nai','Sói','Gà con']
const ANIMAL_EMOJI = {
  'Gấu': '🐻',
  'Voi': '🐘',
  'Hổ': '🐯',
  'Cáo': '🦊',
  'Thỏ': '🐰',
  'Cá heo': '🐬',
  'Rùa': '🐢',
  'Mèo': '🐱',
  'Bướm': '🦋',
  'Nai': '🦌',
  'Sói': '🐺',
  'Gà con': '🐥',
}

export function getPersonColor(id) {
  if (!id) return PERSON_COLORS[0]
  let h = 0
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0
  return PERSON_COLORS[Math.abs(h) % PERSON_COLORS.length]
}

function getDeviceId() {
  try {
    let id = localStorage.getItem('presence_device_id')
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem('presence_device_id', id)
    }
    return id
  } catch {
    return crypto.randomUUID()
  }
}

function getAnonIdentity() {
  try {
    const s = localStorage.getItem('presence_anon')
    if (s) return JSON.parse(s)
  } catch {}
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)]
  const id = `guest:${crypto.randomUUID()}`
  const identity = { presenceKey: id, name: `${animal} ẩn danh`, emoji: ANIMAL_EMOJI[animal] ?? '❓', color: getPersonColor(id), isAnon: true }
  try { localStorage.setItem('presence_anon', JSON.stringify(identity)) } catch {}
  return identity
}

export function usePresence(menuId) {
  const sb = useSupabaseClient()
  const { user, isLoaded } = useUser()
  const { session } = useSession()
  const viewers = ref([])
  const isMorphingIn = ref(false)
  const myActiveDish = ref(null)
  const currentPicks = ref([])
  const selfRemotePicks = ref([])
  const myPresenceKey = ref(null)
  let channel = null
  let trackTimer = null  // unified debounce for all track calls
  let keepaliveTimer = null  // periodic re-track to keep presence alive
  let myKey = null
  let bc = null
  const cartCallbacks = []
  
  // Grace period: keep departed viewers visible for 10s to hide reconnect flicker
  const viewerGrace = new Map()  // presenceKey → { payload, expiresAt }

  function getMyPayload() {
    const anon = getAnonIdentity()
    if (user.value) {
      return {
        presenceKey: user.value.id,
        name: user.value.fullName || 'Bạn',
        avatar: user.value.imageUrl || null,
        color: getPersonColor(user.value.id),
        isAnon: false,
        activeDish: myActiveDish.value,
        picks: [...currentPicks.value],  // plain array — avoids DataCloneError in BC postMessage
      }
    }
    return { ...anon, activeDish: myActiveDish.value, picks: [...currentPicks.value] }
  }

  // Unified debounced track — at most 1 track per 80ms regardless of how many things change
  function scheduleTrack() {
    if (trackTimer) clearTimeout(trackTimer)
    trackTimer = setTimeout(async () => {
      if (channel) await channel.track(getMyPayload())
      trackTimer = null
    }, 80)
  }

  function updateMyPresenceKey() {
    const anon = getAnonIdentity()
    myPresenceKey.value = user.value?.id ?? anon.presenceKey
  }

  function onCartUpdated(cb) {
    cartCallbacks.push(cb)
  }

  function updateAnonName(newName) {
    if (!newName?.trim()) return
    try {
      const anon = getAnonIdentity()
      anon.name = newName.trim()
      localStorage.setItem('presence_anon', JSON.stringify(anon))
      updateMyPresenceKey()
      scheduleTrack()
    } catch (e) {
      console.error('Failed to update anon name:', e)
    }
  }

  function broadcastCartChange(action, itemName) {
    if (!channel) return
    channel.send({
      type: 'broadcast',
      event: 'cart_updated',
      payload: {
        presenceKey: myPresenceKey.value,
        name: getMyPayload().name,
        picks: [...currentPicks.value],
        action,
        itemName
      }
    }).catch(err => console.error('Failed to send broadcast:', err))
  }

  async function connect() {
    if (channel) return Promise.resolve()
    const anon = getAnonIdentity()
    myKey = getDeviceId()
    updateMyPresenceKey()
    const channelName = `menu-presence:${menuId}`
    channel = sb.channel(channelName, { config: { presence: { key: myKey } } })
    
    // Register Presence sync
    channel.on('presence', { event: 'sync' }, () => {
      const activeState = channel.presenceState()
      console.log(`[Presence Sync] Key=${myKey} State=`, JSON.stringify(activeState))

      const state = { ...activeState }
      const now = Date.now()
      const GRACE_MS = 10_000

      // 1. Restore departed slots from grace map (mapped by deviceId slot key)
      for (const [deviceId, grace] of viewerGrace) {
        if (!state[deviceId]) {
          if (grace.expiresAt > now) {
            state[deviceId] = grace.entries
          } else {
            viewerGrace.delete(deviceId)
          }
        }
      }

      // 2. Update grace map for currently active slots
      for (const [deviceId, entries] of Object.entries(activeState)) {
        viewerGrace.set(deviceId, { entries, expiresAt: now + GRACE_MS })
      }

      // Extract own remote picks across all devices/slots for my user ID
      const myUserSlots = []
      const currentUserId = user.value?.id ?? getAnonIdentity().presenceKey
      for (const entries of Object.values(state)) {
        for (const entry of entries) {
          if (entry.presenceKey === currentUserId) {
            myUserSlots.push(entry)
          }
        }
      }
      selfRemotePicks.value = [...new Set(myUserSlots.flatMap(s => s.picks || []))]

      // Deduplicate viewers by presenceKey, merging activeDish and picks across slots
      const byKey = new Map()
      for (const [deviceId, entries] of Object.entries(state)) {
        const hasRealUser = entries.some(e => !e.isAnon)
        const filteredEntries = hasRealUser ? entries.filter(e => !e.isAnon) : entries

        for (const entry of filteredEntries) {
          const existing = byKey.get(entry.presenceKey)
          if (!existing) {
            byKey.set(entry.presenceKey, { ...entry, deviceId, picks: [...(entry.picks || [])] })
          } else {
            if (entry.activeDish && !existing.activeDish) existing.activeDish = entry.activeDish
            if (entry.picks?.length) {
              const merged = new Set([...existing.picks, ...entry.picks])
              existing.picks = [...merged]
            }
          }
        }
      }

      viewers.value = [...byKey.values()]
    })

    // Register Broadcast listener
    channel.on('broadcast', { event: 'cart_updated' }, ({ payload }) => {
      console.log(`[Broadcast Received] Key=${myKey} Payload=`, JSON.stringify(payload))
      // 1. Optimistic update viewers picks and name
      viewers.value = viewers.value.map(v => 
        v.presenceKey === payload.presenceKey ? { ...v, picks: payload.picks, name: payload.name } : v
      )
      // 2. Trigger callbacks
      cartCallbacks.forEach(cb => cb(payload))
    })

    let resolved = false
    return new Promise((resolve) => {
      channel.subscribe(async (status) => {
        console.log(`[Subscribe Status] Key=${myKey} Status=${status}`)
        if (status === 'SUBSCRIBED') {
          const payload = getMyPayload()
          console.log(`[Subscribed Tracking] Key=${myKey} Payload=`, JSON.stringify(payload))
          await channel.track(payload)
          // Keepalive: schedule a re-track every 25s through the debounce queue
          if (keepaliveTimer) clearInterval(keepaliveTimer)
          keepaliveTimer = setInterval(() => {
            scheduleTrack()  // goes through 80ms debounce — no rapid-fire even if user is active
          }, 25_000)
          if (!resolved) { resolved = true; resolve() }
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          if (keepaliveTimer) { clearInterval(keepaliveTimer); keepaliveTimer = null }
        }
      })
    })
  }

  function setActiveDish(dishName) {
    myActiveDish.value = dishName || null
    scheduleTrack()
  }

  let broadcastDebounceTimer = null
  function setMyPicks(names, lastAction = null, lastItem = null) {
    console.log(`[setMyPicks] Key=${myKey} Names=`, names)
    currentPicks.value = [...names]
    scheduleTrack()

    if (lastAction && lastItem) {
      if (broadcastDebounceTimer) clearTimeout(broadcastDebounceTimer)
      broadcastDebounceTimer = setTimeout(() => {
        broadcastCartChange(lastAction, lastItem)
      }, 300)
    }

    if (bc) {
      const payload = getMyPayload()
      bc.postMessage({ picks: payload.picks, payload })  // payload.picks is already plain array
    }
  }

  function handleVisibility() {
    if (!document.hidden) scheduleTrack()
  }

  // Connect once Clerk loads
  watch(isLoaded, (loaded) => { if (loaded && !channel) connect() }, { immediate: true })

  // Re-track when user signs in or out (anon ↔ real user)
  watch(user, async (newUser, oldUser) => {
    updateMyPresenceKey()
    
    // Disconnect and reconnect the channel to ensure the new auth context (JWT token) is loaded on the socket connection
    if (channel) {
      try {
        await channel.untrack()
      } catch (e) {}
      sb.removeChannel(channel)
      channel = null
    }

    try {
      const token = await session.value?.getToken()
      if (token) {
        sb.realtime.setAuth(token)
      }
    } catch (e) {
      console.error('Failed to update realtime auth token:', e)
    }

    isMorphingIn.value = true
    selfRemotePicks.value = []
    setTimeout(() => { isMorphingIn.value = false }, 1600)
    
    await connect()
  })

  if (typeof BroadcastChannel !== 'undefined') {
    bc = new BroadcastChannel(`menu-picks:${menuId}`)
    bc.onmessage = ({ data }) => {
      const incoming = data.picks ?? []
      if (incoming.length) selfRemotePicks.value = incoming
      // Optimistically update viewer chip instantly (Supabase sync confirms ~200ms later)
      if (data.payload?.presenceKey) {
        viewers.value = viewers.value.map(v =>
          v.presenceKey === data.payload.presenceKey ? { ...v, ...data.payload } : v
        )
      }
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibility)
    // Clean up presence immediately on page unload (so slot expires instantly, not after 30s)
    window.addEventListener('beforeunload', () => {
      if (channel) channel.untrack().catch(() => {})
    })
  }

  onUnmounted(() => {
    cartCallbacks.length = 0
    if (bc) { bc.close(); bc = null }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibility)
    }
    if (trackTimer) clearTimeout(trackTimer)
    if (keepaliveTimer) clearInterval(keepaliveTimer)
    viewerGrace.clear()
    if (channel) sb.removeChannel(channel)
  })

  return { viewers, setActiveDish, isMorphingIn, getPersonColor, setMyPicks, selfRemotePicks, myPresenceKey, updateAnonName, onCartUpdated }
}

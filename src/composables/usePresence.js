import { ref, onUnmounted, watch } from 'vue'
import { useUser } from '@clerk/vue'
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

function getAnonIdentity() {
  try {
    const s = localStorage.getItem('presence_anon')
    if (s) return JSON.parse(s)
  } catch {}
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)]
  const id = crypto.randomUUID()
  const identity = { presenceKey: id, name: `${animal} ẩn danh`, emoji: ANIMAL_EMOJI[animal] ?? '❓', color: getPersonColor(id), isAnon: true }
  try { localStorage.setItem('presence_anon', JSON.stringify(identity)) } catch {}
  return identity
}

export function usePresence(menuId) {
  const sb = useSupabaseClient()
  const { user, isLoaded } = useUser()
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

  async function connect() {
    if (channel) return Promise.resolve()
    const anon = getAnonIdentity()
    myKey = user.value?.id ?? anon.presenceKey
    myPresenceKey.value = myKey
    const channelName = `menu-presence:${menuId}`
    channel = sb.channel(channelName, { config: { presence: { key: myKey } } })
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()

      // Extract own remote picks (union across all slots for myKey, before dedup)
      const mySlots = state[myKey] || []
      selfRemotePicks.value = [...new Set(mySlots.flatMap(s => s.picks || []))]

      // Deduplicate viewers by presenceKey, merging activeDish and picks across slots
      const byKey = new Map()
      for (const entries of Object.values(state)) {
        for (const entry of entries) {
          const existing = byKey.get(entry.presenceKey)
          if (!existing) {
            byKey.set(entry.presenceKey, { ...entry, picks: [...(entry.picks || [])] })
          } else {
            if (entry.activeDish && !existing.activeDish) existing.activeDish = entry.activeDish
            if (entry.picks?.length) {
              const merged = new Set([...existing.picks, ...entry.picks])
              existing.picks = [...merged]
            }
          }
        }
      }

      // Grace period: keep recently-departed viewers for 10s to hide reconnect flicker
      const now = Date.now()
      const GRACE_MS = 10_000
      for (const [key, grace] of viewerGrace) {
        if (!byKey.has(key) && grace.expiresAt > now) {
          byKey.set(key, grace.payload)  // restore temporarily
        } else if (grace.expiresAt <= now) {
          viewerGrace.delete(key)  // expired, remove
        }
      }
      // Update grace map for ALL current viewers
      for (const [key, payload] of byKey) {
        viewerGrace.set(key, { payload, expiresAt: now + GRACE_MS })
      }

      viewers.value = [...byKey.values()]
    })
    let resolved = false
    return new Promise((resolve) => {
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track(getMyPayload())
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

  function setMyPicks(names) {
    currentPicks.value = [...names]
    scheduleTrack()
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

  // Re-connect when user signs in (anon → real user)
  watch(user, async (newUser, oldUser) => {
    if (!newUser || oldUser || !channel) return
    isMorphingIn.value = true
    selfRemotePicks.value = []
    setTimeout(() => { isMorphingIn.value = false }, 1600)
    const oldChannel = channel
    channel = null          // let connect() proceed
    myPresenceKey.value = null
    await connect()         // B appears (subscribed + tracked)
    await sb.removeChannel(oldChannel)  // Cáo disappears
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
    if (bc) { bc.close(); bc = null }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibility)
    }
    if (trackTimer) clearTimeout(trackTimer)
    if (keepaliveTimer) clearInterval(keepaliveTimer)
    viewerGrace.clear()
    if (channel) sb.removeChannel(channel)
  })

  return { viewers, setActiveDish, isMorphingIn, getPersonColor, setMyPicks, selfRemotePicks, myPresenceKey }
}

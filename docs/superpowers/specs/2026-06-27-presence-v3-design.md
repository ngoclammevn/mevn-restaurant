# Presence v3 — Hide Self, Grid Ripple, Cross-Tab Picks Sync

**Date:** 2026-06-27  
**Branch:** nhat  
**Files affected:** `src/composables/usePresence.js`, `src/pages/MenuPage.vue`

---

## Scope

Three incremental improvements to the realtime presence system:

1. **Hide self** from sidebar/pill avatar list
2. **Grid centering + join ripple** animation
3. **Cross-tab picks sync** — merge union, realtime via Supabase Presence

---

## 1. Hide Self from Sidebar

### Motivation
Showing your own avatar in the "who's here" sidebar is redundant — the dish row already highlights your color when you hover/select. Removing self from the list makes the panel a pure "who else is here" display.

### Design

Add a computed in `MenuPage.vue`:

```js
const otherViewers = computed(() =>
  viewers.value.filter(v => v.presenceKey !== myId.value)
)
```

- All `v-for` loops in the mobile pill and desktop card use `otherViewers` instead of `viewers`
- Count label ("X người đang xem") uses `otherViewers.length`
- Solo state ("Bạn là người đầu tiên ✨") still triggers when `viewers.value.length === 1`
- Sidebar card is hidden when `otherViewers.length === 0`

---

## 2. Grid Centering + Join Ripple

### Motivation
The current grid mask is off-center (`at 55% 35%`). When a new person joins, the grid should visually "pulse" to draw attention.

### Design

**Centering:** Change mask gradient origin to `at 50% 50%`.

**Ripple trigger:** In `MenuPage.vue`, watch `viewers.length`. When it increases (new joiner), add CSS class `presence-card-grid--ripple` to the grid element for 1500ms then remove.

```js
watch(() => viewers.value.length, (newLen, oldLen) => {
  if (newLen > oldLen) {
    gridRippling.value = true
    setTimeout(() => { gridRippling.value = false }, 1500)
  }
})
const gridRippling = ref(false)
```

**Animation:** A radial glow that expands from center and fades out:

```css
@keyframes grid-join-ripple {
  0%   { opacity: 0.25; transform: scale(0.3); }
  40%  { opacity: 0.12; transform: scale(1.1); }
  100% { opacity: 0;    transform: scale(1.6); }
}

.presence-card-grid::after {
  content: '';
  position: absolute; inset: 0;
  border-radius: inherit;
  background: radial-gradient(ellipse 60% 60% at 50% 50%, var(--primary) 0%, transparent 70%);
  opacity: 0;
  pointer-events: none;
}

.presence-card-grid--ripple::after {
  animation: grid-join-ripple 1.5s ease-out forwards;
}
```

---

## 3. Cross-Tab Picks Sync

### Motivation
When the same user has multiple tabs open on the same menu, selecting a dish on Tab A should automatically appear on Tab B — merged, not replaced (union). Supabase Presence is already the channel, so we extend the payload.

### Design

#### Payload extension

`getMyPayload()` in `usePresence.js` includes:

```js
picks: currentPicks.value,        // string[] — dish names
```

`currentPicks` is a `ref([])` inside `usePresence`, updated via `setMyPicks(names)`.

#### New exports from `usePresence`

| Export | Type | Purpose |
|---|---|---|
| `setMyPicks(names: string[])` | function | Update picks payload + `channel.track()` immediately (no debounce) |
| `selfRemotePicks` | `ComputedRef<string[]>` | Picks from Supabase for the current user's presenceKey (other tabs) |

`selfRemotePicks` is derived from the raw `presenceState()` — specifically the merged picks of all slots for `myKey`, BEFORE dedup collapses them. This lets MenuPage detect what other tabs have selected.

#### Sync handler update

The existing dedup code merges `activeDish`; extend it to also union `picks` across slots of the same key:

```js
if (entry.picks?.length) {
  const merged = new Set([...(existing.picks || []), ...entry.picks])
  existing.picks = [...merged]
}
```

#### MenuPage watcher

After `toggleDish()`:
```js
setMyPicks(Object.keys(picks))   // track immediately
```

Watch `selfRemotePicks`:
```js
watch(selfRemotePicks, (remotePicks) => {
  if (!remotePicks?.length) return
  let changed = false
  for (const dishName of remotePicks) {
    if (!picks[dishName]) {
      const dish = findDishByName(dishName, menu.value)
      if (dish) { picks[dishName] = dish; changed = true }
    }
  }
  if (changed) {
    draft.item_text = Object.values(picks).map(d => d.name).join('\n')
    setMyPicks(Object.keys(picks))   // re-track merged result
  }
})
```

Loop safety: `setMyPicks` is only called when `changed === true`. When Tab B re-tracks with the merged picks, Tab A receives them but `changed` will be `false` (no new dishes) — loop stops.

On order submit (`submitOrder`), call `setMyPicks([])` to clear remote picks.

#### Realtime improvements

- Picks tracking: **no debounce** — fires immediately on click
- Hover/activeDish: keep 300ms debounce (high-frequency events)
- Add `document.addEventListener('visibilitychange', () => { if (!document.hidden && channel) channel.track(getMyPayload()) })` to re-track when tab becomes active

#### Helper function

Add `findDishByName(name, menu)` in `MenuPage.vue`:

```js
function findDishByName(name, menu) {
  if (!menu?.note) return null
  try {
    const data = JSON.parse(menu.note)
    for (const section of data.dishes ?? []) {
      const found = section.items?.find(d => d.name === name)
      if (found) return found
    }
  } catch {}
  return null
}
```

---

## Data Flow Summary

```
Tab A: toggleDish('Cơm lòng')
  → picks = { 'Cơm lòng': dish }
  → setMyPicks(['Cơm lòng'])
  → channel.track({ picks: ['Cơm lòng'], activeDish: null, ... })

Tab B: presenceState() sync
  → selfRemotePicks = ['Cơm lòng']   ← from own presenceKey, other slot
  → merge: picks['Cơm lòng'] = dish
  → draft.item_text = 'Cơm lòng'
  → setMyPicks(['Cơm lòng'])          ← re-track with merged picks
  → channel.track({ picks: ['Cơm lòng'], ... })

Tab A: sync again
  → selfRemotePicks = ['Cơm lòng']
  → merge check: already have it → changed = false → no re-track ✓ STOP
```

---

## Out of Scope

- Syncing `note` / `orderFor` fields across tabs (only picks and activeDish)
- Removing picks remotely (deselect on one tab doesn't deselect on another — merge is additive)
- Persistence beyond the Supabase Presence TTL

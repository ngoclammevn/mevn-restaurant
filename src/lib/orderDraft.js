const VERSION = 1
const TTL_MS = 24 * 60 * 60 * 1000

export const draftKey = (menuId) => `lunch-order-draft:v1:${menuId}`

function normalizeDraft(draft = {}) {
  return {
    itemText: typeof draft.itemText === 'string' ? draft.itemText : '',
    note: typeof draft.note === 'string' ? draft.note : '',
    orderFor: typeof draft.orderFor === 'string' ? draft.orderFor : '',
    dishNames: Array.isArray(draft.dishNames)
      ? draft.dishNames.filter((name) => typeof name === 'string')
      : [],
  }
}

function parseDishes(note) {
  try {
    const parsed = JSON.parse(note)
    return Array.isArray(parsed?.dishes)
      ? parsed.dishes.filter((dish) => typeof dish?.name === 'string')
      : null
  } catch {
    return null
  }
}

export function saveOrderDraft(storage, menuId, draft, now) {
  const payload = {
    version: VERSION,
    savedAt: now,
    ...normalizeDraft(draft),
  }

  try {
    storage.setItem(draftKey(menuId), JSON.stringify(payload))
  } catch {
    // Local storage can be unavailable or full; submitting an order must still work.
  }
}

export function clearOrderDraft(storage, menuId) {
  try {
    storage.removeItem(draftKey(menuId))
  } catch {
    // Local storage can be unavailable or blocked by browser privacy settings.
  }
}

export function restoreOrderDraft(storage, menu, profiles, now) {
  const menuId = menu?.id
  let payload

  try {
    const saved = storage.getItem(draftKey(menuId))
    if (!saved) return null
    payload = JSON.parse(saved)
  } catch {
    clearOrderDraft(storage, menuId)
    return null
  }

  if (payload?.version !== VERSION || !Number.isFinite(payload.savedAt)) {
    clearOrderDraft(storage, menuId)
    return null
  }

  if (now - payload.savedAt > TTL_MS) {
    clearOrderDraft(storage, menuId)
    return null
  }

  const draft = normalizeDraft(payload)
  const dishes = parseDishes(menu?.note)
  let removedDishNames = []

  if (dishes) {
    const availableNames = dishes.map((dish) => dish.name)
    removedDishNames = draft.dishNames.filter((name) => !availableNames.includes(name))
    draft.dishNames = draft.dishNames.filter((name) => availableNames.includes(name))
    draft.itemText = draft.dishNames.join('\n')
  }

  const orderForRemoved = Boolean(draft.orderFor)
    && !profiles?.some((profile) => profile?.id === draft.orderFor)
  if (orderForRemoved) draft.orderFor = ''

  return { draft, removedDishNames, orderForRemoved }
}

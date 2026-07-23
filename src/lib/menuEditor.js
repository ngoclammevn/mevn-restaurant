function isJsonContainer(text) {
  const trimmed = text.trim()
  return trimmed.startsWith('{') || trimmed.startsWith('[')
}

function normalizePrice(value) {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return Number.NaN

  const cleaned = value.trim().replace(/[^0-9,.-]/g, '')
  if (!cleaned || !/^-?[0-9.,]+$/.test(cleaned)) return Number.NaN

  const sign = cleaned.startsWith('-') ? '-' : ''
  const unsigned = sign ? cleaned.slice(1) : cleaned
  const separators = [...unsigned.matchAll(/[.,]/g)]

  if (!separators.length) return Number(`${sign}${unsigned}`)

  const lastSeparator = separators.at(-1).index
  const fractionalPart = unsigned.slice(lastSeparator + 1)
  const integerPart = unsigned.slice(0, lastSeparator).replace(/[.,]/g, '')
  const hasBothSeparators = unsigned.includes('.') && unsigned.includes(',')
  const isThousandsSeparator = fractionalPart.length === 3 && !hasBothSeparators

  if (isThousandsSeparator) return Number(`${sign}${unsigned.replace(/[.,]/g, '')}`)
  return Number(`${sign}${integerPart}.${fractionalPart}`)
}

export function parseMenuEditorDraft(note) {
  const text = typeof note === 'string' ? note : ''

  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Array.isArray(parsed.dishes)) {
      return {
        kind: 'structured',
        notes: typeof parsed.notes === 'string' ? parsed.notes : '',
        dishes: parsed.dishes,
      }
    }

    return isJsonContainer(text) ? { kind: 'invalid', raw: text } : { kind: 'plain', text }
  } catch {
    return isJsonContainer(text) ? { kind: 'invalid', raw: text } : { kind: 'plain', text }
  }
}

export function serializeMenuEditorDraft(draft) {
  if (draft?.kind !== 'structured' || !Array.isArray(draft.dishes)) return null
  return JSON.stringify({ notes: draft.notes ?? '', dishes: draft.dishes })
}

export function validateMenuEditorDraft(draft) {
  if (draft?.kind === 'plain') return { valid: true, error: null }
  if (draft?.kind !== 'structured' || !Array.isArray(draft.dishes)) {
    return { valid: false, error: 'Dữ liệu menu không hợp lệ.' }
  }

  for (const dish of draft.dishes) {
    if (!dish || typeof dish.name !== 'string' || !dish.name.trim()) {
      return { valid: false, error: 'Mỗi món cần có tên.' }
    }
    const price = normalizePrice(dish.price)
    if (!Number.isFinite(price) || price < 0) {
      return { valid: false, error: 'Giá món không hợp lệ.' }
    }
  }

  return { valid: true, error: null }
}

export function getOrderedDishUsage(dishes, orders) {
  const dishNames = new Set((dishes ?? []).map(dish => dish?.name).filter(name => typeof name === 'string'))
  const orderedNames = new Set()
  const paidNames = new Set()
  const counts = new Map()

  for (const order of orders ?? []) {
    const namesInOrder = new Set(
      String(order?.item_text ?? '').split('\n').map(line => line.trim()).filter(name => dishNames.has(name)),
    )
    for (const name of namesInOrder) {
      orderedNames.add(name)
      counts.set(name, (counts.get(name) ?? 0) + 1)
      if (order?.is_paid) paidNames.add(name)
    }
  }

  return { orderedNames, paidNames, counts }
}

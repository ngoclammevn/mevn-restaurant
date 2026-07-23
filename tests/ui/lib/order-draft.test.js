import { describe, expect, it } from 'vitest'
import {
  clearOrderDraft,
  draftKey,
  restoreOrderDraft,
  saveOrderDraft,
} from '../../../src/lib/orderDraft'

function memoryStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
}

const now = Date.UTC(2026, 6, 23, 5)
const menu = {
  id: 'menu-1',
  note: JSON.stringify({ dishes: [{ name: 'Cơm gà', price: 45000 }] }),
}

describe('order draft', () => {
  it('round-trips a current structured draft', () => {
    const storage = memoryStorage()
    saveOrderDraft(storage, menu.id, {
      itemText: 'Cơm gà',
      note: 'Ít cơm',
      orderFor: 'user-a',
      dishNames: ['Cơm gà'],
    }, now)

    expect(restoreOrderDraft(
      storage,
      menu,
      [{ id: 'user-a' }],
      now + 1000,
    )).toEqual({
      draft: {
        itemText: 'Cơm gà',
        note: 'Ít cơm',
        orderFor: 'user-a',
        dishNames: ['Cơm gà'],
      },
      removedDishNames: [],
      orderForRemoved: false,
    })
  })

  it('removes missing exact dish names and an unavailable beneficiary', () => {
    const storage = memoryStorage()
    saveOrderDraft(storage, menu.id, {
      itemText: 'Cơm gà\nBún bò',
      note: '',
      orderFor: 'missing-user',
      dishNames: ['Cơm gà', 'Bún bò'],
    }, now)
    expect(restoreOrderDraft(storage, menu, [], now + 1000)).toMatchObject({
      draft: { itemText: 'Cơm gà', orderFor: '', dishNames: ['Cơm gà'] },
      removedDishNames: ['Bún bò'],
      orderForRemoved: true,
    })
  })

  it('drops drafts older than 24 hours', () => {
    const storage = memoryStorage()
    saveOrderDraft(storage, menu.id, { itemText: 'Cơm gà' }, now)
    expect(restoreOrderDraft(storage, menu, [], now + 24 * 60 * 60 * 1000 + 1)).toBeNull()
    expect(storage.getItem(draftKey(menu.id))).toBeNull()
  })

  it('clears a saved draft', () => {
    const storage = memoryStorage()
    saveOrderDraft(storage, menu.id, { itemText: 'Cơm gà' }, now)
    clearOrderDraft(storage, menu.id)
    expect(storage.getItem(draftKey(menu.id))).toBeNull()
  })
})

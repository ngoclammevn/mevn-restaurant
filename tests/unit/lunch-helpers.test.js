import { afterEach, describe, expect, it, vi } from 'vitest'
import { monthDays, monthBounds, shiftMonth } from '../../src/lib/calendar.js'
import { todayInVN } from '../../src/lib/date.js'
import { exportMenuCsv, menuDishes, normalizeMenu, parseMenuNote, reviewForItem } from '../../src/lib/menu.js'
import { fallbackLabels, validateLabels } from '../../shared/feedback.js'

afterEach(() => vi.useRealTimers())

describe('meal calendar', () => {
  it('shows complete Monday-start weeks spanning leap day and both neighboring months', () => {
    const days = monthDays('2024-02')
    expect(days).toHaveLength(42)
    expect(days[0]).toBe('2024-01-29')
    expect(days.at(-1)).toBe('2024-03-10')
    expect(days).toContain('2024-02-29')
    expect(new Set(days).size).toBe(42)
    expect(monthBounds('2024-02')).toEqual({ from: '2024-01-29', to: '2024-03-10' })
  })
  it('moves between December and January without dropping the year', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(() => monthDays('2026-13')).toThrow()
  })
  it('changes the meal day at midnight in Vietnam', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-02T16:59:59Z'))
    expect(todayInVN()).toBe('2026-10-02')
    vi.setSystemTime(new Date('2026-10-02T17:00:00Z'))
    expect(todayInVN()).toBe('2026-10-03')
  })
})

describe('legacy menus and stable dish identity', () => {
  it('keeps plain text and malformed structured notes as plain menus', () => {
    expect(parseMenuNote('Cơm gà 35k')).toBeNull()
    expect(parseMenuNote('{"dishes":[{"name":""}]}')).toBeNull()
    expect(parseMenuNote('{"dishes":[{"name":"Cơm gà"},null]}')).toBeNull()
    expect(menuDishes('Cơm gà')).toEqual([])
  })
  it('prefers ordered relational records and preserves distinct canonical IDs for identical names', () => {
    const one = normalizeMenu({ note: '{"notes":"Hôm nay","dishes":[{"name":"cũ"}]}', menu_items: [
      { id: 'm2', name: 'Rau', position: 1, available: false },
      { id: 'm1', name: 'Cơm gà', position: 0, restaurant_dish_id: 'shop-a-dish' },
    ] })
    const two = normalizeMenu({ menu_items: [{ id: 'm3', name: 'Cơm gà', position: 0, restaurant_dish_id: 'shop-b-dish' }] })
    expect(menuDishes(one).map(d => d.id)).toEqual(['m1', 'm2'])
    expect(parseMenuNote(one.note).notes).toBe('Hôm nay')
    expect(menuDishes(one)[0].restaurant_dish_id).not.toBe(menuDishes(two)[0].restaurant_dish_id)
    expect(menuDishes(one)[1].available).toBe(false)
  })
  it('accepts embedded one-to-one review shapes and missing reviews', () => {
    expect(reviewForItem({ review: [{ id: 'review' }] })).toEqual({ id: 'review' })
    expect(reviewForItem({ review: { id: 'review' } })).toEqual({ id: 'review' })
    expect(reviewForItem({ review: [] })).toBeNull()
  })
})

describe('selectable dish feedback and exports', () => {
  it('offers balanced dish-specific labels and no automatic score', () => {
    expect(fallbackLabels('GÀ CHIÊN')).toContain('Lớp ngoài giòn')
    expect(fallbackLabels('Gà chiên')).toContain('Chưa đủ giòn')
    expect(fallbackLabels('Canh rau')).toContain('Nước đậm vị')
    expect(fallbackLabels('Canh rau')).toContain('Hơi nhạt')
    expect(fallbackLabels('Món mới')).toHaveLength(12)
    expect(fallbackLabels('Gà chiên')).not.toEqual(fallbackLabels('Canh rau'))
  })
  it('bounds and sanitizes untrusted label output', () => {
    expect(validateLabels(null)).toEqual([])
    expect(validateLabels(['  Ngon   miệng ', 'Ngon miệng', 5, '<script>', '', 'x'.repeat(49), 'Hơi khô'])).toEqual(['Ngon miệng', 'Hơi khô'])
    expect(validateLabels(Array.from({ length: 10 }, (_, i) => `Nhãn ${i}`))).toHaveLength(6)
  })
  it('exports Vietnamese CSV with quoting and neutralizes spreadsheet formulas', () => {
    const csv = exportMenuCsv({ menu_date: '2026-10-03', restaurant: { name: 'Quán A' }, orders: [
      { user: { full_name: '=SUM(1,2)' }, item_text: 'Cơm "gà"\nRau', note: '\t@attack', is_paid: false },
    ] })
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('"\'=SUM(1,2)"')
    expect(csv).toContain('"Cơm ""gà""\nRau"')
    expect(csv).toContain('"\'\t@attack"')
    expect(csv).toContain('"Chưa trả"')
  })
})

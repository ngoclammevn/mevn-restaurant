import { describe, expect, it } from 'vitest'
import {
  buildQuickDeadline,
  fromDeadlineInputValue,
  getDeadlineState,
  isOrderContentLocked,
  toDeadlineInputValue,
} from '../../../src/lib/orderDeadline'

const base = new Date('2026-07-23T03:00:00.000Z') // 10:00 VN

describe('order deadline helpers', () => {
  it('returns unlimited/open/closing-soon/closed states', () => {
    expect(getDeadlineState(null, base).kind).toBe('open-unlimited')
    expect(getDeadlineState('2026-07-23T04:00:00.000Z', base).kind).toBe('open')
    expect(getDeadlineState('2026-07-23T03:20:00.000Z', base).kind).toBe('closing-soon')
    expect(getDeadlineState('2026-07-23T02:59:00.000Z', base).kind).toBe('closed')
  })

  it('builds quick deadlines in UTC for VN display', () => {
    expect(buildQuickDeadline('plus-30m', base)).toBe('2026-07-23T03:30:00.000Z')
    expect(buildQuickDeadline('plus-1h', base)).toBe('2026-07-23T04:00:00.000Z')
  })

  it('round-trips local datetime input', () => {
    const iso = fromDeadlineInputValue('2026-07-23T10:30')
    expect(toDeadlineInputValue(iso)).toBe('2026-07-23T10:30')
  })

  it('builds the 11:00 Vietnam quick deadline even after it is in the past', () => {
    expect(buildQuickDeadline('today-11am', base)).toBe('2026-07-23T04:00:00.000Z')
    expect(buildQuickDeadline('today-11am', new Date('2026-07-23T05:00:00.000Z')))
      .toBe('2026-07-23T04:00:00.000Z')
  })

  it('locks content exactly at a deadline and reports zero remaining time when closed', () => {
    const state = getDeadlineState('2026-07-23T03:00:00.000Z', base)

    expect(state).toMatchObject({ kind: 'closed', remainingMs: 0, isLocked: true })
    expect(isOrderContentLocked('2026-07-23T03:00:00.000Z', base)).toBe(true)
    expect(isOrderContentLocked(null, base)).toBe(false)
  })

  it('returns blank/null for malformed deadline values', () => {
    expect(toDeadlineInputValue('not-a-deadline')).toBe('')
    expect(fromDeadlineInputValue('2026-07-23')).toBeNull()
    expect(buildQuickDeadline('unknown', base)).toBeNull()
  })
})

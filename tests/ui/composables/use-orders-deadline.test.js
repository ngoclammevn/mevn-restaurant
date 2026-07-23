import { describe, expect, it } from 'vitest'
import { isDeadlineError } from '../../../src/composables/useOrders'

describe('isDeadlineError', () => {
  it('recognizes only the stable database deadline error', () => {
    expect(isDeadlineError({ message: 'ORDER_DEADLINE_PASSED' })).toBe(true)
    expect(isDeadlineError({ message: 'ORDER_DEADLINE_PASSED: extra context' })).toBe(false)
    expect(isDeadlineError({ message: 'permission denied' })).toBe(false)
    expect(isDeadlineError(null)).toBe(false)
  })
})

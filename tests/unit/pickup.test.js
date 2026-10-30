import { expect, test } from 'vitest'
import { normalizePickupPhone, choosePickupCandidate } from '../../shared/pickup.js'

test('normalizes a reusable VN phone and rejects invalid numbers', () => {
  expect(normalizePickupPhone('090 123 4567')).toBe('+84901234567')
  expect(normalizePickupPhone('+84 (901) 234-567')).toBe('+84901234567')
  for (const invalid of ['123', '+14155551234', '090abc1234567', '09012345678']) {
    expect(() => normalizePickupPhone(invalid)).toThrow()
  }
})
test('randomizes only unique volunteers with the least completed deliveries', () => {
  const candidates = [{userId:'a',receivedCount:2},{userId:'b',receivedCount:0},{userId:'c',receivedCount:0},{userId:'b',receivedCount:0}]
  let bound
  expect(choosePickupCandidate(candidates, n => { bound=n; return 1 }).userId).toBe('c')
  expect(bound).toBe(2)
  expect(choosePickupCandidate([], () => 0)).toBeNull()
})

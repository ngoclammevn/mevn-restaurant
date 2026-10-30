export function normalizePickupPhone(input) {
  const phone = String(input ?? '').trim().replace(/[\s().-]/g, '').replace(/^0/, '+84')
  if (!/^\+84[35789][0-9]{8}$/.test(phone)) throw new Error('Số điện thoại Việt Nam không hợp lệ.')
  return phone
}

// Rejection sampling avoids modulo bias when the candidate count does not divide 2^32.
export function secureRandomIndex(upperExclusive) {
  if (!Number.isSafeInteger(upperExclusive) || upperExclusive < 1 || upperExclusive > 0x100000000) throw new RangeError('Invalid random bound')
  const limit = Math.floor(0x100000000 / upperExclusive) * upperExclusive
  const value = new Uint32Array(1)
  do { globalThis.crypto.getRandomValues(value) } while (value[0] >= limit)
  return value[0] % upperExclusive
}

export function choosePickupCandidate(candidates, randomIndex = secureRandomIndex) {
  const unique = [...new Map(candidates.filter(c => c.available !== false).map(c => [c.userId ?? c.user_id, c])).values()]
  if (!unique.length) return null
  const count = c => Number(c.receivedCount ?? c.received_count ?? 0)
  const minimum = Math.min(...unique.map(count))
  const eligible = unique.filter(c => count(c) === minimum)
  const index = randomIndex(eligible.length)
  if (!Number.isInteger(index) || index < 0 || index >= eligible.length) throw new RangeError('Invalid random index')
  return eligible[index]
}

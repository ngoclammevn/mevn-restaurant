function parts(monthKey) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)) throw new Error('Tháng không hợp lệ')
  return monthKey.split('-').map(Number)
}
function iso(date) { return date.toISOString().slice(0, 10) }
export function monthDays(monthKey) {
  const [year, month] = parts(monthKey)
  const first = new Date(Date.UTC(year, month - 1, 1))
  first.setUTCDate(first.getUTCDate() - (first.getUTCDay() + 6) % 7)
  return Array.from({ length: 42 }, (_, index) => iso(new Date(first.getTime() + index * 86400000)))
}
export function monthBounds(monthKey) {
  const days = monthDays(monthKey)
  return { from: days[0], to: days.at(-1) }
}
export function shiftMonth(monthKey, offset) {
  const [year, month] = parts(monthKey)
  return iso(new Date(Date.UTC(year, month - 1 + offset, 1))).slice(0, 7)
}

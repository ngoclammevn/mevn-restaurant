const VN_TIMEZONE = 'Asia/Ho_Chi_Minh'
const CLOSING_SOON_MS = 30 * 60 * 1000

function isValidDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime())
}

function localDateParts(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  return Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]))
}

function timeZoneOffsetMs(date, timezone) {
  const timeZoneName = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'longOffset',
  }).formatToParts(date).find(part => part.type === 'timeZoneName')?.value
  const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(timeZoneName ?? '')
  if (!match) return 0

  const [, sign, hours, minutes] = match
  const offset = (Number(hours) * 60 + Number(minutes)) * 60 * 1000
  return sign === '+' ? offset : -offset
}

function formatRemaining(remainingMs) {
  const minutes = Math.ceil(remainingMs / 60000)
  if (minutes < 60) return `Còn ${minutes} phút`
  const hours = Math.floor(minutes / 60)
  const leftoverMinutes = minutes % 60
  return leftoverMinutes ? `Còn ${hours} giờ ${leftoverMinutes} phút` : `Còn ${hours} giờ`
}

export function getDeadlineState(deadline, now = new Date()) {
  if (!deadline) {
    return { kind: 'open-unlimited', remainingMs: null, label: 'Không giới hạn', isLocked: false }
  }

  const deadlineDate = new Date(deadline)
  const nowDate = new Date(now)
  if (!isValidDate(deadlineDate) || !isValidDate(nowDate)) {
    return { kind: 'closed', remainingMs: 0, label: 'Đã chốt đơn', isLocked: true }
  }

  const remainingMs = deadlineDate.getTime() - nowDate.getTime()
  if (remainingMs <= 0) {
    return { kind: 'closed', remainingMs: 0, label: 'Đã chốt đơn', isLocked: true }
  }
  if (remainingMs <= CLOSING_SOON_MS) {
    return { kind: 'closing-soon', remainingMs, label: `Sắp chốt · ${formatRemaining(remainingMs)}`, isLocked: false }
  }
  return { kind: 'open', remainingMs, label: formatRemaining(remainingMs), isLocked: false }
}

export function toDeadlineInputValue(deadline, timezone = VN_TIMEZONE) {
  if (!deadline) return ''
  const date = new Date(deadline)
  if (!isValidDate(date)) return ''

  const { year, month, day, hour, minute } = localDateParts(date, timezone)
  return `${year}-${month}-${day}T${hour}:${minute}`
}

export function fromDeadlineInputValue(value, timezone = VN_TIMEZONE) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value ?? '')
  if (!match) return null

  const [, year, month, day, hour, minute] = match
  const naiveUtc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute))
  const naiveDate = new Date(naiveUtc)
  if (
    naiveDate.getUTCFullYear() !== Number(year)
    || naiveDate.getUTCMonth() !== Number(month) - 1
    || naiveDate.getUTCDate() !== Number(day)
    || naiveDate.getUTCHours() !== Number(hour)
    || naiveDate.getUTCMinutes() !== Number(minute)
  ) return null

  let instant = naiveUtc - timeZoneOffsetMs(naiveDate, timezone)
  instant = naiveUtc - timeZoneOffsetMs(new Date(instant), timezone)
  return new Date(instant).toISOString()
}

export function buildQuickDeadline(kind, now = new Date()) {
  const nowDate = new Date(now)
  if (!isValidDate(nowDate)) return null
  if (kind === 'plus-30m') return new Date(nowDate.getTime() + 30 * 60 * 1000).toISOString()
  if (kind === 'plus-1h') return new Date(nowDate.getTime() + 60 * 60 * 1000).toISOString()
  if (kind === 'today-11am') {
    const { year, month, day } = localDateParts(nowDate, VN_TIMEZONE)
    return fromDeadlineInputValue(`${year}-${month}-${day}T11:00`, VN_TIMEZONE)
  }
  return null
}

export function isOrderContentLocked(deadline, now = new Date()) {
  return getDeadlineState(deadline, now).isLocked
}

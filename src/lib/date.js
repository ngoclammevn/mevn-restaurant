// Day boundaries follow Vietnam time (UTC+7), never UTC.
export function todayInVN() {
  // en-CA gives YYYY-MM-DD; timeZone pins the day to Vietnam
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date())
}

export function formatVNDate(dateStr) {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

export function formatVNTime(iso) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

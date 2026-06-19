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

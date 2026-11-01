const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh'

const ANNUAL_EVENTS = [
  {
    id: 'halloween',
    start: '10-31',
    end: '11-02',
    priority: 110,
    hint: 'mở bí mật Halloween',
    title: 'Bí mật Halloween!',
    message: 'Kẹo ngọt và chút phép thuật 🎃',
    particles: ['👻', '🎃', '✨', '🍬', '🦇', '🕸️', '🕷️'],
  },
  {
    id: 'teachers-day',
    start: '11-19',
    end: '11-21',
    priority: 100,
    hint: 'gửi một lời cảm ơn 20/11',
    title: 'Một lời cảm ơn 20/11',
    message: 'Gửi lời tri ân đến người truyền cảm hứng 🌷',
    particles: ['🌷', '💐', '✨', '🌼', '💚', '🌸', '⭐'],
  },
  {
    id: 'vietnam-culture-day',
    start: '11-23',
    end: '11-25',
    priority: 100,
    hint: 'mở chút sắc Việt',
    title: 'Mừng Ngày Văn hóa Việt Nam',
    message: 'Thêm chút sắc Việt cho giờ trưa 🪷',
    particles: ['🪷', '🌾', '✨', '🌿', '⭐', '🌼', '💚'],
  },
  {
    id: 'hanoi-autumn',
    start: '11-03',
    end: '11-30',
    priority: 10,
    hint: 'ngắm lá vàng Hà Nội',
    title: 'Lá vàng Hà Nội',
    message: 'Lá thu khẽ bay qua giờ trưa 🍂',
    particles: ['🍂', '🍁', '🍃', '✨', '🍂', '🌾', '🍁'],
  },
  {
    id: 'christmas',
    start: '12-01',
    end: '12-25',
    priority: 50,
    hint: 'mở bất ngờ Noel',
    title: 'Bất ngờ mùa Noel',
    message: 'Chúc bạn một giờ trưa ấm áp 🎄',
    particles: ['❄️', '🎄', '✨', '🎁', '⭐', '❄️', '🔔'],
  },
  {
    id: 'new-year',
    start: '12-26',
    end: '01-03',
    priority: 70,
    hint: 'đón khoảnh khắc năm mới',
    title: 'Chúc mừng năm mới!',
    message: 'Chúc năm mới có nhiều bữa trưa ngon 🎉',
    particles: ['🎉', '✨', '🥂', '🎊', '⭐', '💚', '🎆'],
  },
  {
    id: 'womens-day',
    start: '03-06',
    end: '03-09',
    priority: 70,
    hint: 'nhận một nhành hoa',
    title: 'Một nhành hoa tháng Ba',
    message: 'Chúc bạn luôn vui và ăn trưa ngon 🌷',
    particles: ['🌷', '🌸', '💐', '✨', '🌼', '💚', '⭐'],
  },
  {
    id: 'reunification-and-labour-day',
    start: '04-29',
    end: '05-04',
    priority: 70,
    hint: 'mở sắc màu ngày lễ',
    title: 'Chúc kỳ nghỉ vui vẻ',
    message: 'Chúc bạn có những ngày nghỉ thật vui 🇻🇳',
    particles: ['⭐', '✨', '🌟', '🎉', '💚', '🌼', '🎊'],
  },
  {
    id: 'national-day',
    start: '09-01',
    end: '09-05',
    priority: 70,
    hint: 'mở sắc đỏ vàng ngày Quốc khánh',
    title: 'Mừng Quốc khánh',
    message: 'Thêm một chút sắc đỏ vàng 🇻🇳',
    particles: ['⭐', '🇻🇳', '✨', '🌟', '🎉', '💚', '🎊'],
  },
]

const DATED_EVENTS = [
  {
    id: 'tet',
    year: 2027,
    start: '2027-02-03',
    end: '2027-02-11',
    priority: 120,
    hint: 'hái lộc đầu năm',
    title: 'Bí mật Tết Đinh Mùi',
    message: 'Chúc bạn năm mới nhiều niềm vui 🌸',
    particles: ['🌸', '🧧', '✨', '🐐', '🌼', '🧧', '⭐'],
  },
  {
    id: 'hung-kings-day',
    year: 2027,
    start: '2027-04-15',
    end: '2027-04-19',
    priority: 90,
    hint: 'mở điều bất ngờ ngày Giỗ Tổ',
    title: 'Nhớ ngày Giỗ Tổ Hùng Vương',
    message: 'Một chút sắc Việt trong giờ trưa 🥁',
    particles: ['🥁', '🌾', '⭐', '✨', '🌿', '💚', '🌟'],
  },
  {
    id: 'mid-autumn',
    year: 2027,
    start: '2027-09-12',
    end: '2027-09-18',
    priority: 90,
    hint: 'rước đèn Trung thu',
    title: 'Trăng rằm Trung thu',
    message: 'Trăng tròn, thêm chút bánh vui 🏮',
    particles: ['🏮', '🌕', '✨', '🐇', '🍡', '⭐', '🏮'],
  },
]

const DEFAULT_EVENT = {
  id: 'lunch',
  hint: 'mở bí mật bữa trưa',
  title: 'Bí mật bữa trưa!',
  message: 'Chúc bạn ăn trưa vui vẻ 🍜',
  particles: ['♥', '✨', '🍜', '💚', '🥢', '🌱', '♥'],
}

export const MASCOT_EGG_UNLOCKED_EVENT = 'lunch:mascot-egg-unlocked'

const EVENT_THEMES = {
  halloween: { accent: '#a66d49', surface: '#fbf4eb' },
  'teachers-day': { accent: '#a96578', surface: '#fbf2f4' },
  'vietnam-culture-day': { accent: '#94783d', surface: '#f8f5e9' },
  'hanoi-autumn': { accent: '#a87835', surface: '#faf4e8' },
  christmas: { accent: '#327552', surface: '#eef6ef' },
  'new-year': { accent: '#a97832', surface: '#faf4e8' },
  'womens-day': { accent: '#a96578', surface: '#fbf2f4' },
  'reunification-and-labour-day': { accent: '#a95449', surface: '#faf2ed' },
  'national-day': { accent: '#a95449', surface: '#faf2ed' },
  tet: { accent: '#a95449', surface: '#faf2ed' },
  'hung-kings-day': { accent: '#94783d', surface: '#f8f5e9' },
  'mid-autumn': { accent: '#a87835', surface: '#faf4e8' },
  lunch: { accent: '#397653', surface: '#eff6f0' },
}

function getVietnamDateParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: VIETNAM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return {
    year: Number(values.year),
    date: values.year + '-' + values.month + '-' + values.day,
    monthDay: values.month + '-' + values.day,
  }
}

function annualEventYear(event, year, monthDay) {
  const crossesYear = event.start > event.end
  return crossesYear && monthDay >= event.start ? year + 1 : year
}

function matchesAnnualEvent(event, monthDay) {
  if (event.start <= event.end) {
    return monthDay >= event.start && monthDay <= event.end
  }

  return monthDay >= event.start || monthDay <= event.end
}

export function getMascotEggEvent(date = new Date()) {
  const { year, date: dateKey, monthDay } = getVietnamDateParts(date)
  const annualMatches = ANNUAL_EVENTS
    .filter(event => matchesAnnualEvent(event, monthDay))
    .map(event => ({
      ...event,
      year: annualEventYear(event, year, monthDay),
    }))
  const datedMatches = DATED_EVENTS.filter(event => dateKey >= event.start && dateKey <= event.end)
  const event = [...annualMatches, ...datedMatches]
    .sort((left, right) => right.priority - left.priority)[0] || { ...DEFAULT_EVENT, year }

  return {
    ...event,
    eventKey: event.id + ':' + event.year,
  }
}

export function getMascotSeasonTheme(date = new Date()) {
  const event = getMascotEggEvent(date)
  return { eventId: event.id, ...(EVENT_THEMES[event.id] || EVENT_THEMES.lunch) }
}

const unlockedEventsInMemory = new Set()

function storageKey(eventKey) {
  return 'lunch.mascot-egg.v1.' + eventKey
}

export function hasUnlockedMascotEgg(eventKey) {
  if (unlockedEventsInMemory.has(eventKey)) return true

  try {
    const unlocked = window.localStorage.getItem(storageKey(eventKey)) === '1'
    if (unlocked) unlockedEventsInMemory.add(eventKey)
    return unlocked
  } catch {
    return false
  }
}

export function markMascotEggUnlocked(eventKey) {
  unlockedEventsInMemory.add(eventKey)

  try {
    window.localStorage.setItem(storageKey(eventKey), '1')
  } catch {
    // The in-memory record still prevents repeat unlocks during this session.
  }
}

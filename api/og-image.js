import { createClient } from '@supabase/supabase-js'
import chromium from '@sparticuz/chromium-min'
import puppeteer from 'puppeteer-core'

// ── Palettes ────────────────────────────────────────────────────────────────
const PALETTES = [
  { bg: 'linear-gradient(155deg,#1c0900 0%,#3d1500 45%,#1a2010 100%)', a1: '#f59e0b', a2: '#fb923c', a3: '#34d399', dark: '#1c0900' },
  { bg: 'linear-gradient(155deg,#0c2318 0%,#143324 45%,#0a1a0f 100%)', a1: '#4ade80', a2: '#22d3ee', a3: '#fbbf24', dark: '#0c2318' },
  { bg: 'linear-gradient(155deg,#2d1008 0%,#4a1a08 45%,#1a2010 100%)', a1: '#fb923c', a2: '#fbbf24', a3: '#4ade80', dark: '#2d1008' },
  { bg: 'linear-gradient(155deg,#0a1628 0%,#0c2d48 45%,#0d1f1a 100%)', a1: '#60a5fa', a2: '#22d3ee', a3: '#4ade80', dark: '#0a1628' },
  { bg: 'linear-gradient(155deg,#170d2a 0%,#2e1065 45%,#0f2420 100%)', a1: '#c084fc', a2: '#f472b6', a3: '#34d399', dark: '#170d2a' },
  { bg: 'linear-gradient(155deg,#1f0a12 0%,#3d1020 45%,#0a1810 100%)', a1: '#f9a8d4', a2: '#fb923c', a3: '#4ade80', dark: '#1f0a12' },
  { bg: 'linear-gradient(155deg,#022c2c 0%,#034040 45%,#0a1a15 100%)', a1: '#2dd4bf', a2: '#60a5fa', a3: '#fbbf24', dark: '#022c2c' },
  { bg: 'linear-gradient(155deg,#1a0005 0%,#3d0010 45%,#1a1008 100%)', a1: '#f43f5e', a2: '#fb923c', a3: '#fbbf24', dark: '#1a0005' },
  { bg: 'linear-gradient(155deg,#120a04 0%,#2d1c08 45%,#1a1408 100%)', a1: '#d97706', a2: '#f59e0b', a3: '#86efac', dark: '#120a04' },
  { bg: 'linear-gradient(155deg,#041a10 0%,#063020 45%,#0a1f0a 100%)', a1: '#22c55e', a2: '#84cc16', a3: '#facc15', dark: '#041a10' },
  { bg: 'linear-gradient(155deg,#1a0a04 0%,#2d1408 45%,#1a1020 100%)', a1: '#f97316', a2: '#ec4899', a3: '#fbbf24', dark: '#1a0a04' },
  { bg: 'linear-gradient(155deg,#0f0318 0%,#1e0530 45%,#0a1418 100%)', a1: '#a855f7', a2: '#e879f9', a3: '#2dd4bf', dark: '#0f0318' },
  { bg: 'linear-gradient(155deg,#1a0c00 0%,#301800 45%,#181010 100%)', a1: '#ea580c', a2: '#ca8a04', a3: '#4ade80', dark: '#1a0c00' },
  { bg: 'linear-gradient(155deg,#060b1a 0%,#0f1a3d 45%,#0a180a 100%)', a1: '#818cf8', a2: '#67e8f9', a3: '#34d399', dark: '#060b1a' },
]

const EMOJIS = ['🍱', '🥘', '🍛', '🍜', '🍗', '🥗', '🌶️', '🥦', '🫕', '🥕', '🌽', '🧄', '🥩', '🌿', '🍽️']

// ── Helpers ─────────────────────────────────────────────────────────────────

function getPalette() {
  return PALETTES[Math.floor(Math.random() * PALETTES.length)]
}

function formatDate(dateStr) {
  const d = new Date(dateStr)
  const days = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']
  return `${days[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function fmt(v) {
  return v == null ? '' : new Intl.NumberFormat('vi-VN').format(v) + 'đ'
}

function truncate(str, n) {
  return str && str.length > n ? str.slice(0, n - 1) + '…' : (str ?? '')
}

function buildEmojiCSS() {
  const pick = () => EMOJIS[Math.floor(Math.random() * EMOJIS.length)]
  const rn = (lo, hi) => lo + Math.random() * (hi - lo)
  let html = ''

  // Big (3)
  const bigPos = [
    `top:${rn(-24, -4).toFixed(0)}px;left:${rn(-18, -4).toFixed(0)}px`,
    `top:${rn(-24, -4).toFixed(0)}px;right:${rn(-12, 2).toFixed(0)}px`,
    `bottom:${rn(-18, -4).toFixed(0)}px;right:${rn(-12, 2).toFixed(0)}px`,
  ]
  for (const pos of bigPos) {
    html += `<span style="position:absolute;${pos};font-size:${Math.floor(rn(72, 88))}px;opacity:${rn(0.50, 0.60).toFixed(2)};transform:rotate(${rn(-35, 35).toFixed(1)}deg);line-height:1;font-family:'Segoe UI Emoji','Noto Color Emoji','Apple Color Emoji',sans-serif">${pick()}</span>`
  }

  // Medium (5)
  const medPos = [
    `top:${rn(4, 12).toFixed(1)}%;right:${rn(4, 9).toFixed(1)}%`,
    `bottom:${rn(4, 10).toFixed(1)}%;left:${rn(4, 9).toFixed(1)}%`,
    `top:${rn(35, 50).toFixed(1)}%;left:${rn(1, 4).toFixed(1)}%`,
    `top:${rn(10, 25).toFixed(1)}%;left:${rn(10, 20).toFixed(1)}%`,
    `bottom:${rn(25, 40).toFixed(1)}%;right:${rn(2, 6).toFixed(1)}%`,
  ]
  for (const pos of medPos) {
    html += `<span style="position:absolute;${pos};font-size:${Math.floor(rn(26, 40))}px;opacity:${rn(0.20, 0.28).toFixed(2)};transform:rotate(${rn(-22, 22).toFixed(1)}deg);line-height:1;font-family:'Segoe UI Emoji','Noto Color Emoji','Apple Color Emoji',sans-serif">${pick()}</span>`
  }

  // Small (7)
  const smPos = [
    `top:${rn(8, 18).toFixed(1)}%;right:${rn(15, 28).toFixed(1)}%`,
    `bottom:${rn(15, 25).toFixed(1)}%;left:${rn(15, 25).toFixed(1)}%`,
    `top:${rn(55, 70).toFixed(1)}%;right:${rn(3, 8).toFixed(1)}%`,
    `bottom:${rn(10, 18).toFixed(1)}%;right:${rn(12, 22).toFixed(1)}%`,
    `top:${rn(25, 38).toFixed(1)}%;left:${rn(3, 7).toFixed(1)}%`,
    `top:${rn(65, 78).toFixed(1)}%;left:${rn(8, 16).toFixed(1)}%`,
    `bottom:${rn(30, 45).toFixed(1)}%;right:${rn(1, 4).toFixed(1)}%`,
  ]
  for (const pos of smPos) {
    html += `<span style="position:absolute;${pos};font-size:${Math.floor(rn(11, 18))}px;opacity:${rn(0.12, 0.18).toFixed(2)};transform:rotate(${rn(-60, 60).toFixed(1)}deg);line-height:1;font-family:'Segoe UI Emoji','Noto Color Emoji','Apple Color Emoji',sans-serif">${pick()}</span>`
  }

  return html
}

// ── HTML Template ────────────────────────────────────────────────────────────
function buildHTML(menu, dishes, orderCount, pal) {
  const dateStr = formatDate(menu.menu_date)
  const totalDishes = dishes.length
  const posterName = menu.poster?.full_name ?? ''
  const posterAvatar = menu.poster?.avatar_url ?? null
  const posterInitials = posterName.split(' ').map(w => w[0]).filter(Boolean).slice(-2).join('').toUpperCase() || '?'

  // Group categories (max 3)
  const catMap = {}
  for (const d of dishes) {
    const cat = d.category || 'Món ăn'
    if (!catMap[cat]) catMap[cat] = []
    catMap[cat].push(d)
  }
  const catEntries = Object.entries(catMap).slice(0, 3)
  const shownDishes = catEntries.reduce((s, [, ds]) => s + ds.length, 0)
  const teaserN = totalDishes - shownDishes
  const showTeaser = totalDishes > 12 && teaserN > 0

  const orderMsg = orderCount === 0
    ? 'Hãy là người đầu tiên đặt nhé! 🙋'
    : `${orderCount} người đã đặt — vẫn còn nhận món!`

  const catColors = [pal.a1, pal.a2, pal.a3]

  const catRowsHTML = catEntries.map(([catName, catDishes], i) => {
    const cc = catColors[i]
    const show3 = catDishes.slice(0, 3)
    const extra = catDishes.length - show3.length
    const dishLine = show3.map(d =>
      `<span style="color:rgba(255,255,255,0.88)">${d.name}</span>&nbsp;<b style="color:${cc}">${fmt(d.price)}</b>`
    ).join('<span style="color:rgba(255,255,255,0.25)"> · </span>')
    const extraTag = extra > 0 ? `<span style="color:${cc};opacity:0.55;font-style:italic"> +${extra} món</span>` : ''
    const isLast = i === catEntries.length - 1

    return `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:${!isLast ? '1px solid rgba(255,255,255,0.07)' : 'none'}">
        <span style="font-size:14px;font-weight:800;color:${cc};letter-spacing:0.06em;text-transform:uppercase;white-space:nowrap;flex-shrink:0">${catName.toUpperCase()}</span>
        <div style="width:1px;height:18px;background:${cc}55;flex-shrink:0"></div>
        <div style="font-size:16px;flex:1;white-space:nowrap;overflow:hidden">${dishLine}${extraTag}</div>
      </div>`
  }).join('')

  const teaserHTML = showTeaser ? `
    <div style="display:flex;align-items:center;gap:10px;margin-top:8px">
      <div style="height:1px;flex:1;background:${pal.a1}2a"></div>
      <span style="font-size:11px;color:${pal.a1};opacity:0.85;font-style:italic;white-space:nowrap">và ${teaserN} món ngon khác đang chờ bạn...</span>
      <span style="font-size:14px;color:${pal.a1};font-weight:900">→</span>
      <div style="height:1px;flex:1;background:${pal.a1}2a"></div>
    </div>` : ''

  const avatarHTML = posterAvatar
    ? `<img src="${posterAvatar}" style="width:38px;height:38px;border-radius:50%;object-fit:cover;border:2px solid ${pal.a1}99;flex-shrink:0" />`
    : `<div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,${pal.a1},${pal.dark});display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#fff;border:2px solid ${pal.a1}99;flex-shrink:0">${posterInitials}</div>`

  const hatSVG = `<svg viewBox="0 0 20 16" xmlns="http://www.w3.org/2000/svg" style="position:absolute;top:-10px;right:-8px;width:18px;height:14px;transform:rotate(20deg);filter:drop-shadow(0 1px 2px rgba(0,0,0,0.9))"><ellipse cx="10" cy="9.5" rx="7" ry="2.8" fill="white"/><path d="M5 9.5 Q4.5 4 6.5 2 Q10 0 13.5 2 Q15.5 4 15 9.5 Z" fill="white"/><rect x="3" y="9" width="14" height="2.8" rx="1.4" fill="white"/><rect x="3" y="11.2" width="14" height="1.8" rx="0.9" fill="rgba(180,180,180,0.45)"/></svg>`

  const badgeHTML = ''

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1200px; height: 630px; overflow: hidden;
    font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
    background: ${pal.bg};
    position: relative;
  }
  .content {
    position: absolute; inset: 0;
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 36px 54px 30px;
  }
</style>
</head>
<body>
  <!-- Emoji background -->
  ${buildEmojiCSS()}

  <!-- Content -->
  <div class="content">

    <!-- Header -->
    <div style="display:flex;align-items:center;justify-content:center;gap:18px">
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
        <span style="font-size:10px;letter-spacing:0.28em;color:${pal.a1};opacity:0.65;text-transform:uppercase">-- THỰC ĐƠN HÔM NAY --</span>
        <div style="display:flex;align-items:baseline;gap:8px">
          <span style="font-size:34px;font-weight:900;color:#fff">Cơm trưa ngày</span>
          <span style="font-size:34px;font-weight:900;color:${pal.a1}">${dateStr}</span>
        </div>
      </div>
      ${badgeHTML}
    </div>

    <!-- Categories -->
    <div style="display:flex;flex-direction:column;flex:1;justify-content:space-evenly;padding:4px 0">
      ${catRowsHTML}
      ${teaserHTML}
    </div>

    <!-- Footer -->
    <div style="display:flex;align-items:center;justify-content:space-between;padding-top:14px">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="position:relative;width:38px;height:38px;flex-shrink:0">
          ${avatarHTML}
          ${hatSVG}
        </div>
        <div style="display:flex;flex-direction:column;gap:3px">
          <div style="font-size:10px;color:rgba(255,255,255,0.5)">Mở bởi <span style="color:#fff;font-weight:700">${truncate(posterName, 24)}</span></div>
          <div style="font-size:12px;color:${orderCount === 0 ? pal.a2 : pal.a1};font-weight:700">${orderMsg}</div>
        </div>
      </div>
      <div style="background:${pal.a1};color:${pal.dark};font-size:16px;font-weight:900;padding:12px 28px;border-radius:28px;letter-spacing:0.02em;white-space:nowrap">
        Đặt cơm ngay!
      </div>
    </div>

  </div>
</body>
</html>`
}

// ── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const id = req.query.id
  if (!id) { res.status(400).send('Missing id'); return }

  const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY)

  let menu = null
  try {
    const { data } = await sb.from('menus')
      .select('id, title, menu_date, image_url, note, poster:profiles!menus_poster_id_fkey(full_name, avatar_url), orders(id)')
      .eq('id', id).single()
    menu = data
  } catch { }

  if (!menu) { res.status(404).send('Not found'); return }

  // Parse OCR
  let dishes = [], isStructured = false
  try {
    const parsed = JSON.parse(menu.note)
    if (parsed?.dishes?.length) { dishes = parsed.dishes; isStructured = true }
  } catch { }

  // No OCR + has image → use photo directly
  if (!isStructured && menu.image_url) { res.redirect(307, menu.image_url); return }

  const pal = getPalette()
  const orderCount = menu.orders?.length ?? 0
  const html = buildHTML(menu, dishes, orderCount, pal)

  // Launch Puppeteer
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 1200, height: 630 },
    executablePath: await chromium.executablePath(
      'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar'
    ),
    headless: chromium.headless,
  })

  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 })
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1200, height: 630 } })

    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60')
    res.send(png)
  } finally {
    await browser.close()
  }
}

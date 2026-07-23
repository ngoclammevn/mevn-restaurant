import fs from 'fs'
import path from 'path'
import { createServerSupabaseClient } from './_supabase.js'
import { buildOgImagePath } from './_og-image.js'

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function formatDate(dateStr) {
  const d = new Date(dateStr)
  const days = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']
  const dd = d.getDate().toString().padStart(2, '0')
  const mm = (d.getMonth() + 1).toString().padStart(2, '0')
  return `${days[d.getDay()]}, ${dd}/${mm}`
}

export default async function handler(req, res) {
  const { id } = req.query

  if (!id) {
    res.redirect(307, '/')
    return
  }

  let menu = null
  try {
    const sb = createServerSupabaseClient()
    const { data, error } = await sb
      .from('menus')
      .select('id, title, menu_date, image_url, note, poster:profiles!menus_poster_id_fkey(full_name), orders(id)')
      .eq('id', id)
      .single()
    if (!error) menu = data
  } catch {
    console.error('Could not load share menu metadata')
  }

  const protocol = req.headers['x-forwarded-proto'] || 'https'
  const origin = `${protocol}://${req.headers.host}`

  const posterName = menu?.poster?.full_name ?? 'Đồng nghiệp'
  const menuTitle = menu?.title ?? 'Menu cơm trưa'

  // Parse OCR dishes from note JSON
  let dishCount = 0
  let dishNames = ''
  try {
    const parsed = JSON.parse(menu?.note)
    if (parsed?.dishes?.length) {
      dishCount = parsed.dishes.length
      dishNames = parsed.dishes.slice(0, 3).map(d => d.name).join(', ')
    }
  } catch {}

  const orderCount = menu?.orders?.length ?? 0
  const dateStr = menu?.menu_date ? formatDate(menu.menu_date) : 'Hôm nay'

  const ogTitle = menu
    ? `🍱 ${posterName} rủ đặt cơm trưa — ${menuTitle}`
    : '🍱 Menu cơm trưa'
  const ogDesc = menu
    ? (dishCount > 0
        ? `Hôm nay có ${dishCount} món ngon nè! ${dishNames}... • ${orderCount} người đã đặt rồi • ${dateStr} • Đặt nhanh kẻo hết chỗ nhé 😄`
        : `${posterName} vừa đăng menu cơm trưa hôm nay! ${orderCount} người đã đặt • ${dateStr} • Click vào xem và đặt ngay nhé 🍽️`)
    : 'Mở menu để xem món và đặt cơm cùng mọi người.'
  const seoDesc = ogDesc.replace(/[🍱😄🍽️]/gu, '').replace(/\s+/g, ' ').trim()

  const ogImage = `${origin}${buildOgImagePath(req.query.image)}`
  const menuUrl = `/menu/${id}`

  // Read the built SPA HTML file
  let html = ''
  try {
    const indexPath = path.join(process.cwd(), 'dist', 'index.html')
    html = fs.readFileSync(indexPath, 'utf8')
  } catch (err) {
    try {
      const rootIndexPath = path.join(process.cwd(), 'index.html')
      html = fs.readFileSync(rootIndexPath, 'utf8')
    } catch (e) {
      html = `<!DOCTYPE html><html lang="vi"><head><title>Cơm Trưa</title></head><body><div id="app"></div></body></html>`
    }
  }

  // Define dynamic OpenGraph meta tags
  const metaTags = `
    <title>${escapeHtml(ogTitle)}</title>
    <meta property="og:title"        content="${escapeHtml(ogTitle)}" />
    <meta property="og:description"  content="${escapeHtml(ogDesc)}" />
    <meta property="og:image"        content="${escapeHtml(ogImage)}" />
    <meta property="og:url"          content="${escapeHtml(origin + menuUrl)}" />
    <meta property="og:type"         content="website" />
    <meta property="og:site_name"    content="Cơm Trưa" />
    <meta name="description"         content="${escapeHtml(seoDesc)}" />
    <meta name="twitter:card"        content="summary_large_image" />
    <meta name="twitter:title"       content="${escapeHtml(ogTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(ogDesc)}" />
    <meta name="twitter:image"       content="${escapeHtml(ogImage)}" />
  `

  // Remove existing title if present to avoid duplicates
  html = html.replace(/<title>.*?<\/title>/gi, '')

  // Inject meta tags inside the head tag
  html = html.replace('</head>', `${metaTags}\n</head>`)

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60')
  res.status(200).send(html)
}

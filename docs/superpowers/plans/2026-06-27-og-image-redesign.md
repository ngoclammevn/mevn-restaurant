# OG Image Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `api/og-image.js` to render a vibrant 1200×630 OG image: 14 random palettes, 3-layer scattered emoji background, category dish rows, chef-hat avatar, teaser row.

**Architecture:** Single file rewrite. All logic (PRNG, palettes, emoji layout, JSX-less render) lives in `api/og-image.js`. No new dependencies — `react`, `@vercel/og`, `@supabase/supabase-js` are already installed. SVG chef hat encoded as base64 data URI at module level.

**Tech Stack:** `@vercel/og` (ImageResponse), `react` (createElement), `@supabase/supabase-js`, Node.js serverless (Vercel)

## Global Constraints

- Only `api/og-image.js` is modified
- No JSX — use `createElement as e` throughout
- Every `<div>` with >1 child must have `display: 'flex'`
- No `text-overflow: ellipsis` — use JS `truncate(str, n)` instead
- `position: 'absolute'` requires parent with `position: 'relative'`
- No special Unicode chars (◆ etc.) — use plain ASCII `-` or `--`
- `Cache-Control: public, max-age=60, s-maxage=60`
- Supabase env vars: `process.env.VITE_SUPABASE_URL`, `process.env.VITE_SUPABASE_PUBLISHABLE_KEY`

---

## Task 1: Complete rewrite of api/og-image.js

**Files:**
- Modify: `api/og-image.js` (full rewrite)

**Interfaces:**
- Produces: `GET /api/og-image?id=UUID` → PNG 1200×630 or redirect

- [ ] **Step 1: Write the complete file**

Replace the entire contents of `api/og-image.js` with:

```js
import { ImageResponse } from '@vercel/og'
import { createClient } from '@supabase/supabase-js'
import { createElement as e } from 'react'

// ── Constants ──────────────────────────────────────────────────────────────
const EMOJIS = ['🍱','🥘','🍛','🍜','🍗','🥗','🌶️','🥦','🫕','🥕','🌽','🧄','🥩','🌿','🍽️']

const PALETTES = [
  { bg:['#1c0900','#3d1500','#1a2010'], a1:'#f59e0b', a2:'#fb923c', a3:'#34d399', dark:'#1c0900' },
  { bg:['#0c2318','#143324','#0a1a0f'], a1:'#4ade80', a2:'#22d3ee', a3:'#fbbf24', dark:'#0c2318' },
  { bg:['#2d1008','#4a1a08','#1a2010'], a1:'#fb923c', a2:'#fbbf24', a3:'#4ade80', dark:'#2d1008' },
  { bg:['#0a1628','#0c2d48','#0d1f1a'], a1:'#60a5fa', a2:'#22d3ee', a3:'#4ade80', dark:'#0a1628' },
  { bg:['#170d2a','#2e1065','#0f2420'], a1:'#c084fc', a2:'#f472b6', a3:'#34d399', dark:'#170d2a' },
  { bg:['#1f0a12','#3d1020','#0a1810'], a1:'#f9a8d4', a2:'#fb923c', a3:'#4ade80', dark:'#1f0a12' },
  { bg:['#022c2c','#034040','#0a1a15'], a1:'#2dd4bf', a2:'#60a5fa', a3:'#fbbf24', dark:'#022c2c' },
  { bg:['#1a0005','#3d0010','#1a1008'], a1:'#f43f5e', a2:'#fb923c', a3:'#fbbf24', dark:'#1a0005' },
  { bg:['#120a04','#2d1c08','#1a1408'], a1:'#d97706', a2:'#f59e0b', a3:'#86efac', dark:'#120a04' },
  { bg:['#041a10','#063020','#0a1f0a'], a1:'#22c55e', a2:'#84cc16', a3:'#facc15', dark:'#041a10' },
  { bg:['#1a0a04','#2d1408','#1a1020'], a1:'#f97316', a2:'#ec4899', a3:'#fbbf24', dark:'#1a0a04' },
  { bg:['#0f0318','#1e0530','#0a1418'], a1:'#a855f7', a2:'#e879f9', a3:'#2dd4bf', dark:'#0f0318' },
  { bg:['#1a0c00','#301800','#181010'], a1:'#ea580c', a2:'#ca8a04', a3:'#4ade80', dark:'#1a0c00' },
  { bg:['#060b1a','#0f1a3d','#0a180a'], a1:'#818cf8', a2:'#67e8f9', a3:'#34d399', dark:'#060b1a' },
]

const CHEF_HAT_B64 = 'data:image/svg+xml;base64,' + Buffer.from(
  '<svg viewBox="0 0 20 16" xmlns="http://www.w3.org/2000/svg">' +
  '<ellipse cx="10" cy="9.5" rx="7" ry="2.8" fill="white"/>' +
  '<path d="M5 9.5 Q4.5 4 6.5 2 Q10 0 13.5 2 Q15.5 4 15 9.5 Z" fill="white"/>' +
  '<rect x="3" y="9" width="14" height="2.8" rx="1.4" fill="white"/>' +
  '<rect x="3" y="11.2" width="14" height="1.8" rx="0.9" fill="rgba(180,180,180,0.45)"/>' +
  '</svg>'
).toString('base64')

// ── Helpers ────────────────────────────────────────────────────────────────
function seededRand(seed) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i) | 0
  return () => { h = Math.imul(h ^ h >>> 16, 0x45d9f3b); return (h >>> 0) / 4294967296 }
}

function getPalette(id) {
  const rand = seededRand(id)
  return PALETTES[Math.floor(rand() * PALETTES.length)]
}

function formatDate(dateStr) {
  const d = new Date(dateStr)
  const days = ['CN', 'Thu 2', 'Thu 3', 'Thu 4', 'Thu 5', 'Thu 6', 'Thu 7']
  return `${days[d.getDay()]}, ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`
}

function fmt(v) {
  if (v == null) return ''
  return new Intl.NumberFormat('vi-VN').format(v) + 'đ'
}

function truncate(str, n) {
  return str && str.length > n ? str.slice(0, n - 1) + '...' : (str ?? '')
}

function buildEmojiElements(menuId) {
  const rand = seededRand(menuId + '_emoji')
  const pick = () => EMOJIS[Math.floor(rand() * EMOJIS.length)]
  const rn = (lo, hi) => lo + rand() * (hi - lo)
  const elements = []

  // Big layer (3 items) — near corners, pixel offsets
  const bigCorners = [
    { top: Math.floor(rn(-20, 0)), left: Math.floor(rn(-15, 0)) },
    { top: Math.floor(rn(-20, 0)), right: Math.floor(rn(-10, 5)) },
    { bottom: Math.floor(rn(-15, 0)), right: Math.floor(rn(-10, 5)) },
  ]
  for (const pos of bigCorners) {
    elements.push(e('span', {
      key: `b${elements.length}`,
      style: { position: 'absolute', fontSize: `${Math.floor(rn(56,65))}px`, opacity: rn(0.33,0.38).toFixed(2), transform: `rotate(${rn(-35,35).toFixed(1)}deg)`, lineHeight: '1', ...pos }
    }, pick()))
  }

  // Medium layer (5 items) — edges, percent positions
  const medPos = [
    { top: `${rn(4,12).toFixed(1)}%`, right: `${rn(4,9).toFixed(1)}%` },
    { bottom: `${rn(4,10).toFixed(1)}%`, left: `${rn(4,9).toFixed(1)}%` },
    { top: `${rn(35,50).toFixed(1)}%`, left: `${rn(1,4).toFixed(1)}%` },
    { top: `${rn(10,25).toFixed(1)}%`, left: `${rn(10,20).toFixed(1)}%` },
    { bottom: `${rn(25,40).toFixed(1)}%`, right: `${rn(2,6).toFixed(1)}%` },
  ]
  for (const pos of medPos) {
    elements.push(e('span', {
      key: `m${elements.length}`,
      style: { position: 'absolute', fontSize: `${Math.floor(rn(26,40))}px`, opacity: rn(0.20,0.28).toFixed(2), transform: `rotate(${rn(-22,22).toFixed(1)}deg)`, lineHeight: '1', ...pos }
    }, pick()))
  }

  // Small layer (7 items) — scattered throughout
  const smallPos = [
    { top: `${rn(8,18).toFixed(1)}%`,  right: `${rn(15,28).toFixed(1)}%` },
    { bottom: `${rn(15,25).toFixed(1)}%`, left: `${rn(15,25).toFixed(1)}%` },
    { top: `${rn(55,70).toFixed(1)}%`,  right: `${rn(3,8).toFixed(1)}%` },
    { bottom: `${rn(10,18).toFixed(1)}%`, right: `${rn(12,22).toFixed(1)}%` },
    { top: `${rn(25,38).toFixed(1)}%`,  left: `${rn(3,7).toFixed(1)}%` },
    { top: `${rn(65,78).toFixed(1)}%`,  left: `${rn(8,16).toFixed(1)}%` },
    { bottom: `${rn(30,45).toFixed(1)}%`, right: `${rn(1,4).toFixed(1)}%` },
  ]
  for (const pos of smallPos) {
    elements.push(e('span', {
      key: `s${elements.length}`,
      style: { position: 'absolute', fontSize: `${Math.floor(rn(11,18))}px`, opacity: rn(0.12,0.18).toFixed(2), transform: `rotate(${rn(-60,60).toFixed(1)}deg)`, lineHeight: '1', ...pos }
    }, pick()))
  }

  return elements
}

// ── Handler ────────────────────────────────────────────────────────────────
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
  } catch {}

  if (!menu) { res.status(404).send('Not found'); return }

  // Parse OCR
  let dishes = [], isStructured = false
  try {
    const parsed = JSON.parse(menu.note)
    if (parsed?.dishes?.length) { dishes = parsed.dishes; isStructured = true }
  } catch {}

  // Routing: no OCR + has image → use the photo directly
  if (!isStructured && menu.image_url) { res.redirect(307, menu.image_url); return }

  // ── Setup ──
  const pal = getPalette(menu.id)
  const [bg1, bg2, bg3] = pal.bg
  const bgGradient = `linear-gradient(155deg, ${bg1} 0%, ${bg2} 45%, ${bg3} 100%)`

  const posterName    = menu.poster?.full_name ?? ''
  const posterAvatar  = menu.poster?.avatar_url ?? null
  const posterInitials = posterName.split(' ').map(w => w[0]).filter(Boolean).slice(-2).join('').toUpperCase() || '?'
  const orderCount    = menu.orders?.length ?? 0
  const totalDishes   = dishes.length
  const dateStr       = formatDate(menu.menu_date)

  // Group into categories, show max 3
  const catMap = {}
  for (const d of dishes) {
    const cat = d.category || 'Mon an'
    if (!catMap[cat]) catMap[cat] = []
    catMap[cat].push(d)
  }
  const catEntries = Object.entries(catMap).slice(0, 3)
  const shownDishes = catEntries.reduce((s, [, ds]) => s + ds.length, 0)
  const teaserN     = totalDishes - shownDishes
  const showTeaser  = totalDishes > 12 && teaserN > 0

  const orderMsg = orderCount === 0
    ? 'Hay la nguoi dau tien dat nhe!'
    : `${orderCount} nguoi da dat - van con nhan mon!`

  const catAccents = [pal.a1, pal.a2, pal.a3]
  const catTextColors = ['rgba(255,243,192,0.9)', 'rgba(207,250,254,0.9)', 'rgba(220,252,231,0.9)']

  const emojiEls = buildEmojiElements(menu.id)

  const img = new ImageResponse(
    e('div', {
      style: {
        width: '1200px', height: '630px',
        position: 'relative', display: 'flex',
        background: bgGradient,
        fontFamily: 'system-ui, sans-serif',
        overflow: 'hidden',
      }
    },
      // ── Top accent bar ──
      e('div', {
        style: {
          position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
          background: `linear-gradient(90deg, ${pal.a1}, ${pal.a2}, ${pal.a1})`,
        }
      }),

      // ── Emoji background (z-index 1) ──
      ...emojiEls,

      // ── Content (z-index 2, full overlay) ──
      e('div', {
        style: {
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', flexDirection: 'column',
          padding: '36px 52px 28px',
        }
      },

        // Header
        e('div', {
          style: {
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '16px', marginBottom: '14px',
          }
        },
          e('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' } },
            e('span', { style: { fontSize: '9px', letterSpacing: '0.28em', color: pal.a1, opacity: '0.65', textTransform: 'uppercase' } }, '-- THUC DON HOM NAY --'),
            e('div', { style: { display: 'flex', alignItems: 'baseline', gap: '6px' } },
              e('span', { style: { fontSize: '21px', fontWeight: '900', color: '#fff' } }, 'Com trua ngay '),
              e('span', { style: { fontSize: '21px', fontWeight: '900', color: pal.a1 } }, dateStr)
            )
          ),
          totalDishes > 0 && e('div', {
            style: {
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              background: 'rgba(0,0,0,0.18)',
              border: `1px solid ${pal.a1}55`,
              borderRadius: '20px', padding: '5px 14px', flexShrink: 0,
            }
          },
            e('span', { style: { fontSize: '18px', fontWeight: '900', color: pal.a1, lineHeight: '1' } }, String(totalDishes)),
            e('span', { style: { fontSize: '7px', color: 'rgba(255,255,255,0.5)', fontWeight: '600', letterSpacing: '0.05em' } }, 'MON')
          )
        ),

        // Category rows
        e('div', { style: { display: 'flex', flexDirection: 'column', gap: '0' } },
          ...catEntries.map(([catName, catDishes], i) => {
            const cc  = catAccents[i] || pal.a1
            const dtc = catTextColors[i] || 'rgba(255,255,255,0.85)'
            const show3  = catDishes.slice(0, 3)
            const extra  = catDishes.length - show3.length
            const dishLine = show3.map(d => `${truncate(d.name, 14)} ${fmt(d.price)}`).join(' · ')
              + (extra > 0 ? ` +${extra} mon` : '')
            const isLast = i === catEntries.length - 1

            return e('div', {
              key: catName,
              style: {
                display: 'flex', alignItems: 'center', gap: '10px',
                paddingTop: i > 0 ? '5px' : '0',
                paddingBottom: '5px',
                borderBottom: !isLast ? '1px solid rgba(255,255,255,0.06)' : 'none',
                position: 'relative',
              }
            },
              e('span', {
                style: {
                  fontSize: '8px', fontWeight: '800', color: cc,
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  whiteSpace: 'nowrap', width: '80px', flexShrink: 0,
                }
              }, truncate(catName.toUpperCase(), 12)),
              e('div', { style: { width: '1px', height: '12px', background: `${cc}44`, flexShrink: 0 } }),
              e('span', { style: { fontSize: '9px', color: dtc, flex: 1, minWidth: 0, overflow: 'hidden' } }, dishLine),
              // Fade overlay on last category row
              isLast && e('div', {
                style: {
                  position: 'absolute', right: 0, top: 0, bottom: 0, width: '32%',
                  background: `linear-gradient(to right, transparent, ${bg3} 90%)`,
                }
              })
            )
          })
        ),

        // Teaser row
        showTeaser && e('div', {
          style: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }
        },
          e('div', { style: { height: '1px', flex: 1, background: `${pal.a1}2a` } }),
          e('span', { style: { fontSize: '9px', color: pal.a1, opacity: '0.82', fontStyle: 'italic', whiteSpace: 'nowrap' } },
            `va ${teaserN} mon ngon khac dang cho ban...`
          ),
          e('span', { style: { fontSize: '12px', color: pal.a1, fontWeight: '900' } }, '->'),
          e('div', { style: { height: '1px', flex: 1, background: `${pal.a1}2a` } })
        ),

        // Spacer
        e('div', { style: { flex: 1 } }),

        // Footer
        e('div', {
          style: {
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            paddingTop: '12px',
            borderTop: `1px solid ${pal.a1}26`,
          }
        },
          // Avatar + poster info
          e('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
            e('div', { style: { position: 'relative', display: 'flex', width: '34px', height: '34px', flexShrink: 0 } },
              posterAvatar
                ? e('img', { src: posterAvatar, style: { width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${pal.a1}99` } })
                : e('div', {
                    style: {
                      display: 'flex', width: '34px', height: '34px', borderRadius: '50%',
                      background: `linear-gradient(135deg, ${pal.a1}, ${pal.dark})`,
                      alignItems: 'center', justifyContent: 'center',
                      fontSize: '12px', fontWeight: '800', color: '#fff',
                      border: `2px solid ${pal.a1}99`,
                    }
                  }, posterInitials),
              e('img', {
                src: CHEF_HAT_B64,
                style: { position: 'absolute', top: '-9px', right: '-7px', width: '16px', height: '13px', transform: 'rotate(20deg)' }
              })
            ),
            e('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px' } },
              e('div', { style: { display: 'flex', gap: '4px', alignItems: 'center' } },
                e('span', { style: { fontSize: '9px', color: 'rgba(255,255,255,0.5)' } }, 'Mo boi'),
                e('span', { style: { fontSize: '9px', color: '#fff', fontWeight: '700' } }, truncate(posterName, 22))
              ),
              e('span', { style: { fontSize: '10px', color: orderCount === 0 ? pal.a2 : pal.a1, fontWeight: '700' } }, orderMsg)
            )
          ),
          // CTA
          e('div', {
            style: {
              display: 'flex',
              background: pal.a1, color: pal.dark,
              fontSize: '11px', fontWeight: '900',
              padding: '8px 20px', borderRadius: '22px',
              letterSpacing: '0.02em', flexShrink: 0,
            }
          }, 'Dat com ngay !')
        )
      )
    ),
    { width: 1200, height: 630 }
  )

  res.setHeader('Content-Type', 'image/png')
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60')
  const buf = await img.arrayBuffer()
  res.send(Buffer.from(buf))
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: `✓ built in ...ms` — no errors.

- [ ] **Step 3: Deploy to Vercel and verify**

```bash
vercel --prod
```

Test 3 URLs (substitute real menu IDs):

```
# Menu có OCR → generated image
https://YOUR-URL.vercel.app/api/og-image?id=MENU_WITH_OCR_ID

# Menu không OCR, có ảnh → redirect 307 to image_url
curl -I "https://YOUR-URL.vercel.app/api/og-image?id=MENU_NO_OCR_ID"
# Expected: HTTP/2 307 + Location: https://...supabase.co/storage/...

# Invalid ID → 404
https://YOUR-URL.vercel.app/api/og-image?id=00000000-0000-0000-0000-000000000000
# Expected: text "Not found"
```

Visual checks on the generated image:
- [ ] Top accent bar 3px visible with gradient
- [ ] Emoji scattered at varying sizes (big at corners, small throughout)
- [ ] Emoji positions differ when testing 2 different menu IDs
- [ ] `-- THUC DON HOM NAY --` sublabel present
- [ ] Date shows in accent color
- [ ] `X MON` badge next to title
- [ ] Up to 3 category rows, each with: label (uppercase, accent color) + dishes + price
- [ ] Last category row has fade gradient on right
- [ ] Teaser row only appears when menu has >12 total dishes
- [ ] Footer: avatar (or initials) + chef hat SVG + "Mo boi [Name]" + order message
- [ ] CTA button in accent color
- [ ] Different menus get visibly different color palettes

- [ ] **Step 4: Commit**

```bash
git add api/og-image.js
git commit -m "feat: redesign OG image — 14 palettes, scatter emoji, category rows, chef hat SVG"
```

---

## Self-Review

**Spec coverage:**
- ✅ Top accent bar → `linear-gradient(90deg, a1, a2, a1)`
- ✅ 3-layer emoji (Big/Medium/Small) with PRNG → `buildEmojiElements()`
- ✅ 14 palettes, random by menu ID → `getPalette()`
- ✅ Header: sublabel + title + date accent + badge → header block
- ✅ Max 3 categories, each 3 dishes inline + "+N món" → `catEntries.map()`
- ✅ Row dividers between categories
- ✅ Fade gradient on last category row
- ✅ Teaser row when `totalDishes > 12` → `showTeaser`
- ✅ Footer: avatar/initials + SVG chef hat + "Mo boi" + order message → footer block
- ✅ Order messages: 0="Hay la...", >0="N nguoi...con nhan mon"
- ✅ CTA: `"Dat com ngay !"` in `pal.a1` color
- ✅ Routing: no OCR + image → 307 redirect; else → generate
- ✅ `Cache-Control: public, max-age=60, s-maxage=60`
- ✅ Satori constraints: display:flex everywhere, no text-overflow, truncate() used

**Placeholder scan:** No TBD/TODO/placeholders.

**Type consistency:** `pal.a1/a2/a3/dark/bg` used consistently throughout. `buildEmojiElements(menuId)` returns `ReactElement[]`. `getPalette(id)` returns palette object with `bg`, `a1`, `a2`, `a3`, `dark`.

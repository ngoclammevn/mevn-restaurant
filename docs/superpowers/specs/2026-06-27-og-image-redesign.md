# Spec: OG Image Redesign (api/og-image.js)

**Date:** 2026-06-27  
**File:** `api/og-image.js`

---

## Mục tiêu

Redesign ảnh OG 1200×630 để khi share lên Slack trông hấp dẫn, kích thích click. Implement **1:1 theo mockup** đã approved.

---

## Case routing

| Điều kiện | Hành động |
|---|---|
| `isStructured(menu.note)` = true (có OCR) | Render generated image (spec bên dưới) |
| Không có OCR, có `image_url` | `res.redirect(307, menu.image_url)` |
| Không có OCR, không có ảnh | Render generated image (no dishes, chỉ title + poster) |

---

## Layout tổng thể

```
┌─────────────────────────────────────────────────────────┐
│  [gold/accent top bar 3px]                              │
│                                                         │
│  [emoji scattered background — 3 depth layers]         │
│                                                         │
│           ── THỰC ĐƠN HÔM NAY ──    [X MÓN badge]     │
│              Cơm trưa ngày DD/MM                        │
│                                                         │
│  CAT 1  │  Món A 35k · Món B 40k · Món C 45k +N món    │
│  ───────────────────────────────────────────────────    │
│  CAT 2  │  Món X 45k · Món Y 45k                       │
│  ───────────────────────────────────────────────────    │
│  CAT 3  │  Món Z 35k · ██████████████████████░░░░░░    │
│                                                         │
│       ── và N món ngon khác đang chờ bạn... →          │
│                                                         │
│  [Avatar+hat] Mở bởi Name · [order msg]   [CTA btn]   │
└─────────────────────────────────────────────────────────┘
```

Padding: `44px` trái-phải, `36px` trên-dưới (tăng thêm khi không có ảnh bên trái).

---

## 1. Top accent bar

- Height: `3px`
- Background: `linear-gradient(90deg, accent1, accent2, accent1)` theo palette ngày

---

## 2. Emoji background — 3 lớp depth

Emoji list: `['🍱','🥘','🍛','🍜','🍗','🥗','🌶️','🥦','🫕','🥕','🌽','🧄','🥩','🌿','🍽️']`

Seeded PRNG: dùng simple hash từ `menu.id` (chuỗi UUID) → generate array số:
```js
function seededRand(seed) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i) | 0
  return () => { h = Math.imul(h ^ h >>> 16, 0x45d9f3b); return (h >>> 0) / 4294967296 }
}
```

**Lớp Big** (3 emoji, tạo cảm giác gần):
- Size: 56–64px
- Opacity: 0.33–0.38
- Positions: gần 4 góc nhưng OFFSET ngẫu nhiên (không cố định góc)
- Rotation: ±20–35°

**Lớp Medium** (4–5 emoji):
- Size: 26–40px
- Opacity: 0.20–0.28
- Positions: rải giữa các cạnh, không chồng content area
- Rotation: ±8–22°

**Lớp Small** (6–8 emoji, tạo cảm giác xa):
- Size: 11–17px
- Opacity: 0.12–0.18
- Positions: rải vào cả vùng giữa (nhưng `z-index` dưới content)
- Rotation: ±15–60° (rotate nhiều hơn)

Tất cả positions, sizes, rotations đều derive từ seeded PRNG — **deterministic cho cùng 1 menu ID**, nhưng khác hoàn toàn giữa các menu.

---

## 3. Header

```
── THỰC ĐƠN HÔM NAY ──        [badge]
Cơm trưa ngày <date accent>
```

- Sub-label: `9px`, `letter-spacing: 0.28em`, màu `accent1` opacity 60%, uppercase
- Title: `21px`, `font-weight: 900`, `color: #fff`
- Date part: màu `accent1` (nổi bật)
- **Badge "X MÓN"** — ngay cạnh phải title:
  - Background: `rgba(accent1, 0.15)`, border `rgba(accent1, 0.35)`, border-radius `20px`
  - Số: `16px`, `font-weight: 900`, màu `accent1`
  - Label "MÓN": `7px`, mờ

---

## 4. Category rows

Hiển thị tối đa **3 categories** đầu tiên (theo thứ tự xuất hiện trong OCR data).

Mỗi row:
```
[CATEGORY NAME]  │  Món A Xk · Món B Xk · Món C Xk  +N món
```

- Category label: `8px`, `font-weight: 800`, `letter-spacing: 0.1em`, uppercase, màu `catColor[i]`
- Separator dọc: `1px`, `height: 12px`, màu `rgba(catColor[i], 0.25)`
- Dishes: `9px`, màu `dishText[i]`, `white-space: nowrap`, `overflow: hidden`, `text-overflow: ellipsis`
- Price: `font-weight: bold`, màu `catColor[i]`
- "+N món" suffix: `font-style: italic`, opacity 50%, chỉ hiện khi category có >3 dishes
- Divider ngang giữa rows: `1px solid rgba(255,255,255,0.06)`

**Row thứ 3 (cuối)**: overlay gradient fade:
- `position: absolute`, right side
- `width: 35%`, `background: linear-gradient(to right, transparent, bgColor 90%)`

**Teaser row** sau 3 categories:
- Chỉ hiện khi `totalDishes > 12` (tổng số món nhiều)
- Format: `── và N món ngon khác đang chờ bạn... →`
- `9px`, `font-style: italic`, màu `accent1` opacity 80%
- Flanked by thin lines

---

## 5. Footer

```
[Avatar+hat]  Mở bởi [Name]        [order-msg]       [CTA]
```

**Avatar (32×32px):**
- Nếu có `poster.avatar_url`: `<img>` với `border-radius: 50%`, `border: 2px solid accent1`
- Fallback: div tròn gradient `accent1→accent1Dark`, chữ initials
- **SVG Chef Hat** overlay (top-right, rotate 20°, drop-shadow):
  ```
  width: 16px, height: 13px, position: absolute, top: -9px, right: -7px
  SVG path: ellipse + dome + brim + band
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.9))
  ```

**Poster info:**
- Line 1: `"Mở bởi"` (9px, opacity 50%) + `[Name]` (9px, white, font-weight 700)
- Line 2 — order count message:
  - `0` đơn: `"Hãy là người đầu tiên đặt nhé! 🙋"` — màu `accent2`, 10px, bold
  - `1–5` đơn: `"N người đã đặt — vẫn còn nhận món!"` — màu `accent1`, 10px, bold
  - `>5` đơn: `"N người đã đặt — vẫn còn nhận món!"` — màu `accent1`, 10px, bold

**CTA button:**
- Background: `accent1`
- Color: `bgDark` (tối, tương phản)
- Text: `"Đặt cơm ngay !"` — 10px, font-weight 900, border-radius 22px, padding `7px 18px`

**Top border**: `1px solid rgba(accent1, 0.15)`

---

## 6. Color Palettes — 14 palettes, random per menu

`paletteIndex = seededHash(menu.id) % PALETTES.length`  
(Dùng cùng seeded PRNG từ menu.id — deterministic nhưng khác nhau hoàn toàn giữa các menu)

```js
const PALETTES = [
  // 0 — Warm Amber (mật ong nướng)
  { name:'Warm Amber',    bg:'#1c0900,#3d1500,#1a2010', a1:'#f59e0b', a2:'#fb923c', a3:'#34d399', dark:'#1c0900' },
  // 1 — Forest Green (lá chuối, cơm Việt)
  { name:'Forest Green',  bg:'#0c2318,#143324,#0a1a0f', a1:'#4ade80', a2:'#22d3ee', a3:'#fbbf24', dark:'#0c2318' },
  // 2 — Terracotta (đất nung, ẩm thực truyền thống)
  { name:'Terracotta',    bg:'#2d1008,#4a1a08,#1a2010', a1:'#fb923c', a2:'#fbbf24', a3:'#4ade80', dark:'#2d1008' },
  // 3 — Deep Navy (nhà hàng fine dining)
  { name:'Deep Navy',     bg:'#0a1628,#0c2d48,#0d1f1a', a1:'#60a5fa', a2:'#22d3ee', a3:'#4ade80', dark:'#0a1628' },
  // 4 — Midnight Purple (tím dạ yến)
  { name:'Midnight Purple',bg:'#170d2a,#2e1065,#0f2420',a1:'#c084fc', a2:'#f472b6', a3:'#34d399', dark:'#170d2a' },
  // 5 — Rose Gold (hồng nâu sang trọng)
  { name:'Rose Gold',     bg:'#1f0a12,#3d1020,#0a1810', a1:'#f9a8d4', a2:'#fb923c', a3:'#4ade80', dark:'#1f0a12' },
  // 6 — Ocean Teal (hải sản tươi)
  { name:'Ocean Teal',    bg:'#022c2c,#034040,#0a1a15', a1:'#2dd4bf', a2:'#60a5fa', a3:'#fbbf24', dark:'#022c2c' },
  // 7 — Crimson Fire (ớt đỏ, BBQ)
  { name:'Crimson Fire',  bg:'#1a0005,#3d0010,#1a1008', a1:'#f43f5e', a2:'#fb923c', a3:'#fbbf24', dark:'#1a0005' },
  // 8 — Espresso (cà phê, nâu đậm)
  { name:'Espresso',      bg:'#120a04,#2d1c08,#1a1408', a1:'#d97706', a2:'#f59e0b', a3:'#86efac', dark:'#120a04' },
  // 9 — Jade Moss (rau xanh, fresh)
  { name:'Jade Moss',     bg:'#041a10,#063020,#0a1f0a', a1:'#22c55e', a2:'#84cc16', a3:'#facc15', dark:'#041a10' },
  // 10 — Coral Sunset (nhiệt đới, tươi sáng)
  { name:'Coral Sunset',  bg:'#1a0a04,#2d1408,#1a1020', a1:'#f97316', a2:'#ec4899', a3:'#fbbf24', dark:'#1a0a04' },
  // 11 — Dark Plum (rượu vang, cao cấp)
  { name:'Dark Plum',     bg:'#0f0318,#1e0530,#0a1418', a1:'#a855f7', a2:'#e879f9', a3:'#2dd4bf', dark:'#0f0318' },
  // 12 — Burnt Sienna (đất sét, bánh mì nướng)
  { name:'Burnt Sienna',  bg:'#1a0c00,#301800,#181010', a1:'#ea580c', a2:'#ca8a04', a3:'#4ade80', dark:'#1a0c00' },
  // 13 — Indigo Dusk (tối dịu, chiều muộn)
  { name:'Indigo Dusk',   bg:'#060b1a,#0f1a3d,#0a180a', a1:'#818cf8', a2:'#67e8f9', a3:'#34d399', dark:'#060b1a' },
]
```

- `accent1` (a1) → title date highlight, CTA bg, category 1, badge
- `accent2` (a2) → category 2, "0 đơn" message
- `accent3` (a3) → category 3
- Top bar gradient: `a1 → a2 → a1`
- bgGradient dùng 3 stops của `bg` field: `linear-gradient(155deg, stop1, stop2 45%, stop3 100%)`

---

## 7. SVG Chef Hat path

```js
const CHEF_HAT_SVG = `<svg viewBox="0 0 20 16" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="10" cy="9.5" rx="7" ry="2.8" fill="white"/>
  <path d="M5 9.5 Q4.5 4 6.5 2 Q10 0 13.5 2 Q15.5 4 15 9.5 Z" fill="white"/>
  <rect x="3" y="9" width="14" height="2.8" rx="1.4" fill="white"/>
  <rect x="3" y="11.2" width="14" height="1.8" rx="0.9" fill="rgba(180,180,180,0.45)"/>
</svg>`
```

Encode thành `data:image/svg+xml;base64,...` để dùng trong `<img src>` của Satori.

---

## 8. Satori constraints

- Mọi `<div>` có >1 child phải có `display: 'flex'`
- Không dùng `text-overflow: ellipsis` trực tiếp — thay bằng JS `truncate(str, n)`
- `position: 'absolute'` cần parent có `position: 'relative'`
- Tránh ký tự Unicode đặc biệt trong text (◆ etc.) — dùng `-` hoặc text thường
- Emoji trong text được Satori render qua twemoji — OK

---

## 9. Không thay đổi

- `api/share.js` — giữ nguyên
- SPA, router, PostMenuPage — không đụng
- Supabase schema — không thay đổi

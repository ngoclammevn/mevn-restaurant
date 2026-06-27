# OG Share Link (Slack Unfurl) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tạo `/share/:id` link để paste vào Slack — unfurl ra OG preview đẹp (warm paper + dish list), click về `/menu/:id` (public, guest xem được, login để đặt).

**Architecture:** Hai Vercel serverless functions (`api/share/[id].js` trả OG HTML, `api/og/[id].jsx` trả PNG 1200×630 bằng @vercel/og). Router thêm `public: true` cho `/menu/:id`. MenuPage ẩn form đặt món với guest. PostMenuPage lưu menuId và thêm nút copy Slack link.

**Tech Stack:** `@vercel/og` (Edge Runtime, JSX→PNG), `@supabase/supabase-js` (anon key, read-only), Vue 3, Vercel Serverless Functions

## Global Constraints

- Không dùng service_role key — chỉ anon key (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`)
- `api/og/[id].jsx` chạy Edge Runtime: `export const config = { runtime: 'edge' }`
- `api/share/[id].js` chạy Node.js runtime (default, không cần config)
- OG image: 1200×630px, style Warm Paper (#faf5e6), tối đa 6 món, ngày định dạng "Thứ N, DD/MM"
- Không thay đổi Supabase schema
- TodayPage/HistoryPage/DashboardPage giữ nguyên auth guard

---

## Task 1: Cài @vercel/og + cập nhật vercel.json

**Files:**
- Modify: `package.json`
- Modify: `vercel.json`

**Interfaces:**
- Produces: rewrite `/share/:id` → `api/share/[id].js`; `@vercel/og` available cho Task 3

- [ ] **Step 1: Cài dependency**

```bash
npm install @vercel/og
```

Verify `package.json` có `"@vercel/og": "^0.x.x"` trong `dependencies`.

- [ ] **Step 2: Cập nhật vercel.json**

File hiện tại:
```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

Thay bằng:
```json
{
  "rewrites": [
    { "source": "/share/:id", "destination": "/api/share/:id" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

> Vercel tự route `/api/*` sang serverless functions — rewrite cho `/share/:id` là cần thiết để map về function.

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: `✓ built in ...ms` không có lỗi.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json vercel.json
git commit -m "feat: add @vercel/og dep + vercel.json rewrite for /share/:id"
```

---

## Task 2: api/share/[id].js — OG HTML + redirect

**Files:**
- Create: `api/share/[id].js`

**Interfaces:**
- Consumes: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` từ `process.env`
- Consumes: Supabase table `menus` với select pattern từ `useMenus.js`: `*, poster:profiles!menus_poster_id_fkey(full_name), orders(id)`
- Produces: `GET /api/share/:id` → HTML với OG meta tags + JS redirect về `/menu/:id`

- [ ] **Step 1: Tạo api/share/[id].js**

```js
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY
)

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
    const { data, error } = await sb
      .from('menus')
      .select('id, title, menu_date, image_url, note, poster:profiles!menus_poster_id_fkey(full_name), orders(id)')
      .eq('id', id)
      .single()
    if (!error) menu = data
  } catch {}

  if (!menu) {
    res.redirect(307, '/')
    return
  }

  const protocol = req.headers['x-forwarded-proto'] || 'https'
  const origin = `${protocol}://${req.headers.host}`

  const posterName = menu.poster?.full_name ?? 'Unknown'

  // Parse OCR dishes
  let dishCount = 0
  let dishNames = ''
  try {
    const parsed = JSON.parse(menu.note)
    if (parsed?.dishes?.length) {
      dishCount = parsed.dishes.length
      dishNames = parsed.dishes.slice(0, 3).map(d => d.name).join(', ')
    }
  } catch {}

  const orderCount = menu.orders?.length ?? 0
  const dateStr = formatDate(menu.menu_date)

  const ogTitle = `🍱 ${posterName} chia sẻ cơm trưa — ${menu.title}`
  const ogDesc = dishCount > 0
    ? `${dishCount} món (${dishNames}...) • ${orderCount} người đã đặt • ${dateStr}`
    : `${orderCount} người đã đặt • ${dateStr} • Click để xem và đặt ngay`

  const ogImage = `${origin}/api/og/${id}`
  const menuUrl = `/menu/${id}`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60')
  res.send(`<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(ogTitle)}</title>
  <meta property="og:title"       content="${escapeHtml(ogTitle)}" />
  <meta property="og:description" content="${escapeHtml(ogDesc)}" />
  <meta property="og:image"       content="${escapeHtml(ogImage)}" />
  <meta property="og:url"         content="${escapeHtml(origin + menuUrl)}" />
  <meta property="og:type"        content="website" />
  <meta name="twitter:card"       content="summary_large_image" />
  <meta name="twitter:title"      content="${escapeHtml(ogTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(ogDesc)}" />
  <meta name="twitter:image"      content="${escapeHtml(ogImage)}" />
  <script>location.replace(${JSON.stringify(menuUrl)})</script>
</head>
<body></body>
</html>`)
}
```

- [ ] **Step 2: Verify thủ công (local)**

```bash
npm run dev
```

Mở: `http://localhost:5173/api/share/SOME_MENU_ID`  
Expected: Browser redirect ngay về `/menu/SOME_MENU_ID`. Xem source HTML để kiểm tra OG tags có nội dung đúng.

> Lưu ý: Vercel dev server (`vercel dev`) mới chạy serverless functions local. Dùng `npx vercel dev` thay vì `npm run dev` để test function thật. Nếu chưa có `vercel` CLI: `npm i -g vercel`.

- [ ] **Step 3: Commit**

```bash
git add api/share/[id].js
git commit -m "feat: api/share/[id].js — OG HTML page with Slack meta tags"
```

---

## Task 3: api/og/[id].jsx — PNG image generation

**Files:**
- Create: `api/og/[id].jsx`

**Interfaces:**
- Consumes: `@vercel/og` (`ImageResponse`)
- Consumes: `@supabase/supabase-js` (Edge-compatible)
- Consumes: Supabase `menus` table, same select as Task 2
- Produces: `GET /api/og/:id` → PNG 1200×630 hoặc redirect 307 → `menu.image_url`

- [ ] **Step 1: Tạo api/og/[id].jsx**

```jsx
import { ImageResponse } from '@vercel/og'
import { createClient } from '@supabase/supabase-js'

export const config = { runtime: 'edge' }

function formatDate(dateStr) {
  const d = new Date(dateStr)
  const days = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${days[d.getDay()]}, ${dd}/${mm}`
}

function fmt(v) {
  if (v == null) return ''
  return new Intl.NumberFormat('vi-VN').format(v) + 'đ'
}

export default async function handler(req) {
  const url = new URL(req.url)
  const id = url.pathname.replace(/^\/api\/og\//, '')

  if (!id) return new Response('Missing id', { status: 400 })

  const sb = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  )

  let menu = null
  try {
    const { data } = await sb
      .from('menus')
      .select('id, title, menu_date, image_url, note, poster:profiles!menus_poster_id_fkey(full_name), orders(id)')
      .eq('id', id)
      .single()
    menu = data
  } catch {}

  if (!menu) return new Response('Not found', { status: 404 })

  // Parse OCR
  let dishes = []
  let menuNotes = ''
  let isStructured = false
  try {
    const parsed = JSON.parse(menu.note)
    if (parsed?.dishes?.length) {
      dishes = parsed.dishes
      menuNotes = parsed.notes ?? ''
      isStructured = true
    }
  } catch {}

  // Fallback: image only, no OCR → redirect to image
  if (!isStructured && menu.image_url) {
    return Response.redirect(menu.image_url, 307)
  }

  const posterName = menu.poster?.full_name ?? 'Unknown'
  const posterInitials = posterName.split(' ').map(w => w[0]).filter(Boolean).slice(-2).join('').toUpperCase()
  const orderCount = menu.orders?.length ?? 0
  const dateStr = formatDate(menu.menu_date)
  const displayDishes = dishes.slice(0, 6)
  const extraCount = dishes.length - displayDishes.length

  const hasPhoto = !!menu.image_url

  return new ImageResponse(
    <div
      style={{
        width: '1200px',
        height: '630px',
        display: 'flex',
        fontFamily: 'system-ui, sans-serif',
        overflow: 'hidden',
        background: '#faf5e6',
      }}
    >
      {/* Left: food photo */}
      {hasPhoto && (
        <div
          style={{
            flex: '0 0 44%',
            backgroundImage: `url(${menu.image_url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            position: 'relative',
            display: 'flex',
          }}
        >
          {/* Gradient fade to right */}
          <div
            style={{
              position: 'absolute',
              inset: '0',
              background: 'linear-gradient(to right, transparent 55%, #faf5e6 100%)',
            }}
          />
        </div>
      )}

      {/* Right: warm paper content */}
      <div
        style={{
          flex: '1',
          background: 'radial-gradient(circle at top left, #fffdfa 0%, #faf5e6 100%)',
          padding: '44px 48px 36px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
        }}
      >
        {/* Inner frame top-right area */}
        <div
          style={{
            position: 'absolute',
            inset: '14px',
            border: '1px solid rgba(140,110,51,0.18)',
            borderRadius: '6px',
            pointerEvents: 'none',
          }}
        />

        {/* Header: ◆ THỰC ĐƠN ◆ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ height: '1px', flex: '1', background: 'rgba(140,110,51,0.35)' }} />
            <span style={{ color: '#be9a5b', fontSize: '16px' }}>◆</span>
            <span style={{ fontSize: '15px', fontWeight: '700', letterSpacing: '0.28em', color: '#8c6e33', textTransform: 'uppercase' }}>
              THỰC ĐƠN
            </span>
            <span style={{ color: '#be9a5b', fontSize: '16px' }}>◆</span>
            <div style={{ height: '1px', flex: '1', background: 'rgba(140,110,51,0.35)' }} />
          </div>
          {menuNotes ? (
            <p style={{ fontSize: '13px', color: '#8c6e33', fontStyle: 'italic', margin: '0', textAlign: 'center' }}>
              {menuNotes}
            </p>
          ) : null}
        </div>

        {/* Dish list */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            flex: '1',
            margin: '24px 0 16px',
            position: 'relative',
          }}
        >
          {displayDishes.map((dish, i) => (
            <div
              key={i}
              style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}
            >
              <span style={{ fontSize: '18px', fontWeight: '500', color: '#2a1f12', whiteSpace: 'nowrap', maxWidth: '75%', overflow: 'hidden' }}>
                {dish.name}
              </span>
              <div style={{ flex: '1', borderBottom: '1px dashed rgba(140,110,51,0.38)', marginBottom: '4px', minWidth: '12px' }} />
              <span style={{ fontSize: '15px', fontWeight: '600', color: '#8c6e33', whiteSpace: 'nowrap' }}>
                {fmt(dish.price)}
              </span>
            </div>
          ))}
          {extraCount > 0 && (
            <span style={{ fontSize: '14px', color: 'rgba(140,110,51,0.65)', fontStyle: 'italic' }}>
              +{extraCount} món khác
            </span>
          )}
        </div>

        {/* Footer: poster + date + order count */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid rgba(140,110,51,0.2)',
            paddingTop: '14px',
            position: 'relative',
          }}
        >
          {/* Poster */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: '#8c6e33',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                fontWeight: '700',
              }}
            >
              {posterInitials}
            </div>
            <span style={{ fontSize: '14px', color: '#8c6e33', fontWeight: '600' }}>{posterName}</span>
          </div>

          {/* Date + orders */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
            <span style={{ fontSize: '14px', color: '#8c6e33', fontWeight: '700' }}>{dateStr}</span>
            <span style={{ fontSize: '12px', color: 'rgba(140,110,51,0.7)' }}>🍱 {orderCount} người đã đặt</span>
          </div>
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    }
  )
}
```

- [ ] **Step 2: Verify thủ công**

```bash
npx vercel dev
```

Mở: `http://localhost:3000/api/og/SOME_MENU_ID_WITH_OCR`  
Expected: Trình duyệt hiện ảnh PNG 1200×630 — nền giấy ấm, danh sách món, tên poster, ngày.

Mở: `http://localhost:3000/api/og/SOME_MENU_ID_NO_OCR_HAS_IMAGE`  
Expected: Redirect về `menu.image_url`.

- [ ] **Step 3: Commit**

```bash
git add "api/og/[id].jsx"
git commit -m "feat: api/og/[id].jsx — OG image generation with @vercel/og (warm paper style)"
```

---

## Task 4: Router public + MenuPage guest mode

**Files:**
- Modify: `src/router.js` — line 7
- Modify: `src/pages/MenuPage.vue` — script setup + template

**Interfaces:**
- Consumes: `useUser()` từ `@clerk/vue` (đã có trong MenuPage)
- Produces: `/menu/:id` accessible khi không login; form đặt món ẩn với guest

- [ ] **Step 1: Thêm meta public vào router.js**

Tìm dòng 7 trong `src/router.js`:
```js
{ path: '/menu/:id', component: () => import('./pages/MenuPage.vue') },
```

Thay bằng:
```js
{ path: '/menu/:id', component: () => import('./pages/MenuPage.vue'), meta: { public: true } },
```

- [ ] **Step 2: Thêm guest detection vào MenuPage.vue script**

Trong `<script setup>` của `src/pages/MenuPage.vue`, sau `const myId = computed(...)`:

```js
const isGuest = computed(() => !user.value)
```

- [ ] **Step 3: Thay form đặt món bằng guest banner trong template**

Trong `src/pages/MenuPage.vue`, tìm đoạn `<!-- Order form -->`:

```html
<!-- Order form -->
<form class="stack-sm" @submit.prevent="submitOrder">
```

Wrap form hiện tại với `v-if="!isGuest"` và thêm `v-else` cho banner:

```html
<!-- Order form -->
<template v-if="!isGuest">
  <form class="stack-sm" @submit.prevent="submitOrder">
    <div class="eyebrow">Đặt món</div>
    <div class="field">
      <label>Đặt cho</label>
      <select v-model="draft.orderFor" class="input">
        <option value="">Tôi (chính mình)</option>
        <option v-for="p in profiles" :key="p.id" :value="p.id">
          {{ p.full_name }}
        </option>
      </select>
    </div>
    <TextArea
      v-model="draft.item_text"
      label="Món bạn muốn đặt"
      placeholder="Ví dụ: cơm tấm sườn bì chả"
      :rows="3"
    />
    <TextField
      v-model="draft.note"
      label="Ghi chú (tuỳ chọn)"
      placeholder="Ví dụ: ít cay, không hành"
    />
    <p v-if="draft.submitError" class="alert">{{ draft.submitError }}</p>
    <AppButton
      type="submit"
      :loading="draft.submitting"
      :disabled="!draft.item_text.trim()"
    >
      Đặt món
    </AppButton>
  </form>
</template>

<template v-else>
  <div class="guest-banner">
    <p class="guest-banner-text">Đăng nhập để đặt cơm trưa 🍱</p>
    <AppButton :to="'/sign-in'">Đăng nhập</AppButton>
  </div>
</template>
```

- [ ] **Step 4: Thêm CSS guest-banner vào MenuPage.vue**

Trong `<style scoped>` của `src/pages/MenuPage.vue`:

```css
.guest-banner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1.5rem;
  background: var(--primary-soft);
  border: 1px solid rgba(31,110,69,0.2);
  border-radius: var(--radius-sm);
  text-align: center;
}
.guest-banner-text {
  font-size: var(--fs-sm);
  color: var(--primary-ink);
  font-weight: 600;
  margin: 0;
}
```

- [ ] **Step 5: Verify thủ công**

1. Chạy `npm run dev`
2. Logout khỏi Clerk hoặc mở incognito
3. Vào `http://localhost:5173/menu/SOME_MENU_ID`
4. Expected: Trang load bình thường, thấy menu, danh sách đơn, nhưng thay vì form là banner "Đăng nhập để đặt cơm trưa 🍱"
5. Click nút "Đăng nhập" → redirect về `/sign-in` ✓
6. Login xong, quay lại `/menu/:id` → thấy form đặt món ✓

- [ ] **Step 6: Commit**

```bash
git add src/router.js src/pages/MenuPage.vue
git commit -m "feat: /menu/:id public route + guest view-only mode with login banner"
```

---

## Task 5: PostMenuPage — lưu menuId + nút Copy Slack link

**Files:**
- Modify: `src/pages/PostMenuPage.vue` — script setup + template (success state)

**Interfaces:**
- Consumes: `createMenu()` trả `{ data, error }` với `data.id` (UUID của menu vừa tạo)
- Produces: nút "📋 Copy link Slack" copy `window.location.origin + '/share/' + createdMenuId`

- [ ] **Step 1: Thêm state createdMenuId + slackCopied**

Trong `<script setup>` của `src/pages/PostMenuPage.vue`, sau `const posted = ref(false)`:

```js
const createdMenuId = ref(null)
const slackCopied   = ref(false)
```

- [ ] **Step 2: Capture data.id trong submit()**

Tìm dòng hiện tại trong `submit()`:
```js
const { error } = await createMenu({
```

Thay bằng:
```js
const { data: createdMenu, error } = await createMenu({
```

Và thêm sau `posted.value = true`:
```js
posted.value = true
createdMenuId.value = createdMenu?.id ?? null
resetForm()
```

> Xóa dòng `resetForm()` cũ ngay phía dưới nếu bị trùng.

- [ ] **Step 3: Thêm hàm copySlackLink()**

Trong `<script setup>`, sau khai báo `createdMenuId` và `slackCopied`:

```js
function copySlackLink() {
  if (!createdMenuId.value) return
  const url = `${window.location.origin}/share/${createdMenuId.value}`
  navigator.clipboard.writeText(url).then(() => {
    slackCopied.value = true
    setTimeout(() => { slackCopied.value = false }, 2000)
  }).catch(() => {})
}
```

- [ ] **Step 4: Thêm nút vào template success state**

Tìm trong template phần success state:
```html
<template v-if="posted">
  <div class="stack-sm">
    <span class="badge badge--paid">Đã đăng ✓</span>
    <p class="meta">Menu của bạn đã được đăng thành công.</p>
  </div>
  <div class="row">
    <AppButton :to="'/'">Xem menu hôm nay</AppButton>
    <AppButton variant="ghost" @click="posted = false">Đăng thêm menu</AppButton>
  </div>
</template>
```

Thay bằng:
```html
<template v-if="posted">
  <div class="stack-sm">
    <span class="badge badge--paid">Đã đăng ✓</span>
    <p class="meta">Menu của bạn đã được đăng thành công.</p>
  </div>
  <div class="row" style="flex-wrap: wrap; gap: 0.5rem;">
    <AppButton :to="'/'">Xem menu hôm nay</AppButton>
    <AppButton variant="ghost" @click="copySlackLink" :disabled="!createdMenuId">
      {{ slackCopied ? '✓ Đã copy!' : '📋 Copy link Slack' }}
    </AppButton>
    <AppButton variant="ghost" @click="posted = false; createdMenuId = null">Đăng thêm menu</AppButton>
  </div>
</template>
```

- [ ] **Step 5: Verify thủ công**

1. Chạy `npm run dev`
2. Vào `/post`, đăng một menu mới
3. Sau khi đăng xong, thấy 3 nút: "Xem menu hôm nay", "📋 Copy link Slack", "Đăng thêm menu"
4. Click "📋 Copy link Slack" → nút đổi thành "✓ Đã copy!" trong 2 giây
5. Paste vào text editor → kiểm tra URL dạng `http://localhost:5173/share/UUID`
6. Vào URL đó → browser redirect về `/menu/UUID` ✓

- [ ] **Step 6: Commit**

```bash
git add src/pages/PostMenuPage.vue
git commit -m "feat: PostMenuPage — capture createdMenuId, add Copy Slack link button"
```

---

## Self-Review

**Spec coverage:**
- ✅ `api/share/[id].js` — OG HTML + redirect → Task 2
- ✅ `api/og/[id].jsx` — PNG 1200×630 warm paper → Task 3
- ✅ OCR: dish list tối đa 6 + `+N món khác` → Task 3
- ✅ Footer: poster initials + tên + ngày + đơn count → Task 3
- ✅ Fallback image-only → 307 redirect → Task 3
- ✅ Fallback no-image no-OCR → simple card → Task 3 (handled by `isStructured=false && !image_url` → still renders card with just title/poster/date)
- ✅ vercel.json rewrite → Task 1
- ✅ `/menu/:id` public → Task 4
- ✅ Guest banner → Task 4
- ✅ PostMenuPage copy button → Task 5
- ✅ createdMenuId captured from `createMenu()` response → Task 5
- ✅ Ngày trên ảnh ("Thứ N, DD/MM") → Task 3 `formatDate()`

**Placeholder scan:** Không có TBD/TODO.

**Type consistency:**
- `createdMenuId` (ref string | null) → dùng nhất quán ở Task 5
- `formatDate(dateStr)` → defined trong cả Task 2 và Task 3 (mỗi file tự chứa, không share)
- `fmt(v)` → defined trong Task 3 (chỉ dùng trong OG image)

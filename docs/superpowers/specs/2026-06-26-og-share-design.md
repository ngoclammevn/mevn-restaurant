# Spec: OG Share Link cho Slack

**Date:** 2026-06-26  
**Scope:** `api/og/[id].js`, `api/share/[id].js`, `src/router.js`, `src/pages/MenuPage.vue`, `src/pages/PostMenuPage.vue`

---

## Mục tiêu

Khi người đăng cơm paste link `/share/:id` vào Slack, Slack unfurl ra preview đẹp kích thích click. Khi click, user đến `/menu/:id` trong app — guest xem được, chỉ cần login khi đặt món.

---

## Architecture

```
POST /share/:id  (Slackbot crawl)
  └── api/share/[id].js
        ├── fetch menu từ Supabase (anon key)
        ├── trả HTML: og:title, og:description, og:image → /api/og/:id
        └── <script>location.replace('/menu/:id')</script>

GET /api/og/:id  (Slack tải ảnh preview)
  └── api/og/[id].js (@vercel/og)
        ├── has OCR + has image  → Warm Paper card (layout A)
        ├── has image, no OCR   → redirect 307 → menu.image_url
        └── no image, no OCR   → Warm Paper card chỉ có title + poster

User click link trong Slack → /share/:id → redirect → /menu/:id
```

**Env vars dùng trong serverless (đọc từ process.env):**
- `VITE_SUPABASE_URL` (đã có)
- `VITE_SUPABASE_PUBLISHABLE_KEY` (anon key, đã có — đọc public menu)

**Dependency mới:**
- `@vercel/og` (generate PNG, Edge Runtime)

---

## api/og/[id].js

**Route:** `GET /api/og/:id`  
**Runtime:** Edge (Vercel)  
**Output:** PNG 1200×630  
**Cache:** `Cache-Control: public, max-age=3600, s-maxage=3600`

### Layout A — Warm Paper (khi có OCR)

```
┌──────────────────────────────────────────────┐
│  Food photo (45%)  │  Nền giấy #faf5e6 (55%) │
│  object-fit: cover │  ◆ THỰC ĐƠN ◆           │
│  gradient fade →   │  ─────────────────────  │
│                    │  Category name           │
│                    │  Món A ........ 35.000đ  │
│                    │  Món B ........ 40.000đ  │
│                    │  Món C ........ 45.000đ  │
│                    │  +N món khác             │
│                    │  ─────────────────────  │
│                    │  [Avatar] Poster · Thứ 3, 25/06│
│                    │  X/Y người đã đặt 🍱    │
└──────────────────────────────────────────────┘
```

- Tối đa 6 món hiển thị; nếu nhiều hơn: `+N món khác`
- Dùng font: `Noto Sans` (embed từ Google Fonts via fetch trong Edge function)
- Double frame border bên phải (giống MenuBoard)

### Fallback — image only (khi có ảnh, không có OCR)

```js
return Response.redirect(menu.image_url, 307)
```

### Fallback — no image, no OCR

- Full 1200×630 nền giấy ấm
- Center: emoji 🍱, tên poster, menu title
- Bottom: ngày (`formatVNDate(menu.menu_date)`) + `X/Y người đã đặt`

---

## api/share/[id].js

**Route:** `GET /api/share/:id`  
**Runtime:** Node.js serverless  
**Output:** HTML

```html
<!DOCTYPE html>
<html>
<head>
  <meta property="og:title"       content="🍱 {poster} chia sẻ cơm trưa — {title}" />
  <meta property="og:description" content="{n} món • {orders}/{total} người đã đặt • {date} • Click để xem và đặt ngay" />
  <meta property="og:image"       content="{origin}/api/og/{id}" />
  <meta property="og:url"         content="{origin}/menu/{id}" />
  <meta property="og:type"        content="website" />
  <meta name="twitter:card"       content="summary_large_image" />
  <script>location.replace('/menu/{id}')</script>
</head>
<body></body>
</html>
```

**Error handling:**
- Menu không tồn tại → redirect về `/`
- Supabase lỗi → redirect về `/`

---

## vercel.json — thêm route cho /share/:id

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Vercel tự route `/api/*` sang serverless functions — không cần thêm gì. `/share/:id` cần được route đến `api/share/[id].js`:

```json
{
  "rewrites": [
    { "source": "/share/:id", "destination": "/api/share/:id" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## App changes

### 1. router.js

```js
{ path: '/menu/:id', component: MenuPage, meta: { public: true } }
```

Guard: nếu `meta.public === true` → skip auth redirect.

### 2. MenuPage.vue

- **Guest (chưa login):** hiện menu đầy đủ (ảnh, OCR board, danh sách đơn), nhưng thay form đặt món bằng:
  ```html
  <div class="guest-banner">
    <p>Đăng nhập để đặt cơm trưa</p>
    <AppButton :to="'/sign-in'">Đăng nhập</AppButton>
  </div>
  ```
- **Đã login:** form đặt món như cũ

Detect guest: `useUser()` → `user.value === null`

### 3. PostMenuPage.vue

Sau khi post thành công (state `posted === true`), thêm nút bên cạnh "Xem menu hôm nay":

```html
<AppButton variant="ghost" @click="copySlackLink">
  {{ slackCopied ? '✓ Đã copy!' : '📋 Copy link Slack' }}
</AppButton>
```

- `copySlackLink()`: `navigator.clipboard.writeText(origin + '/share/' + createdMenuId)`
- `createdMenuId`: lưu ID menu vừa tạo từ response của `createMenu()`
- `slackCopied`: ref reset về false sau 2s

---

## Không thay đổi

- TodayPage, HistoryPage, DashboardPage — giữ nguyên auth guard
- PostMenuPage OCR logic — không đụng
- Supabase schema — không thêm bảng hay cột

---

## Spec Self-Review

- ✅ Không placeholder/TBD
- ✅ Không service_role key — chỉ dùng anon key (đọc public menus)
- ✅ vercel.json rewrite cho /share/:id rõ ràng
- ✅ Fallback đầy đủ (OCR+image / image only / nothing)
- ✅ createdMenuId cần được lưu sau createMenu() — đủ để truyền vào copySlackLink
- ✅ Guest detection dùng `useUser()` — consistent với auth hiện tại

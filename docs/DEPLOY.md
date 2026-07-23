# Deployment Guide — nhat → main

> Branch `nhat` thêm: Presence system, OG share image, server-side OCR, public menu route, today page redesign.

---

## Tổng quan thay đổi

| Commit | Feature |
|---|---|
| `infra(db)` | Supabase schema, RLS policies, storage bucket, RLS tests |
| `infra(setup)` | Vercel config, router, vite, env template, project docs |
| `feat(ui)` | Component library: MenuBoard, ConfettiBurst, SparklesText, DateField… |
| `feat(ocr)` | Server-side Gemini OCR via Vercel serverless (`api/ocr.js`) |
| `feat(og)` | OG share image + Slack unfurl (`api/og-image.js`, `api/share.js`) |
| `feat(pages)` | Public `/menu/:id` route, guest view, PostMenu, Profile, History |
| `feat(presence)` | Realtime presence: live viewers, dish chips, cross-tab sync, keepalive |
| `feat(today)` | Today page redesign: social dashboard, bỏ inline form, CTA |
| `docs` | Specs, plans, changelog |

---

## 1. Supabase DB — chạy migrations

### Schema (3 tables)

| Table | Columns | RLS |
|---|---|---|
| `profiles` | `id` (PK = Clerk user ID), `full_name`, `avatar_url`, `payment_info` | select: all · insert/update: own |
| `menus` | `id` (uuid PK), `poster_id` (FK→profiles), `menu_date`, `title`, `image_url`, `note` | select: all · insert/update/delete: poster |
| `orders` | `id` (uuid PK), `menu_id` (FK→menus CASCADE), `user_id` (FK→profiles), `item_text`, `note`, `is_paid`, `paid_at`, `updated_at` | select: all · update/delete: own · insert: authenticated |

> `orders.updated_at` là cột mới — dùng để hiển thị "đã sửa lúc ..." trong UI.

### Chạy trên production (DB đã có sẵn từ main)

`0001` và `0002` **đã có trên main** — production đã chạy rồi. Với project đã chạy bản trước, apply lần lượt **`0003_prod_safe.sql`** và **`0004_menu_order_deadline.sql`**:

```bash
# Supabase Dashboard → SQL Editor → New Query
# Ưu tiên dùng CLI để ghi nhận migration history:
supabase link --project-ref <PROJECT_REF>
supabase db push

# Hoặc Supabase Dashboard → SQL Editor → New Query:
# chạy 0003_prod_safe.sql, sau đó chạy 0004_menu_order_deadline.sql
```

Thay đổi thực tế so với production hiện tại:
- `orders.updated_at timestamptz` — thêm cột mới (hiện "đã sửa lúc ...")
- Policy `orders_insert`: đổi từ `user_id = sub` → `with check (true)` — cho phép đặt hộ người khác

Script dùng `IF NOT EXISTS` và drop-recreate policies nên **an toàn chạy nhiều lần**.

`0004_menu_order_deadline.sql` thêm `menus.order_deadline` (nullable). Giá trị `null` giữ menu mở không giới hạn, vì vậy menu cũ không bị chốt ngoài ý muốn. Migration cũng thêm trigger trên `orders`:

- Chặn tạo, sửa nội dung hoặc xoá đơn khi hạn chót đã qua, với mã lỗi `ORDER_DEADLINE_PASSED`.
- Vẫn cho chủ đơn tự cập nhật `is_paid`/`paid_at` sau giờ chốt.
- Giữ nguyên RLS đặt hộ và ownership: trigger chỉ bổ sung luật thời gian, không thay thế RLS.
- Đồng hồ PostgreSQL `now()` là nguồn quyết định cuối cùng; đồng hồ trình duyệt chỉ để hiển thị countdown.

### Chạy trên DB mới (fresh Supabase project)

```bash
# Option A — Supabase CLI
supabase link --project-ref <PROJECT_REF>
supabase db push

# Option B — Dashboard SQL Editor, chạy lần lượt:
# 1. supabase/migrations/0001_schema_rls.sql
# 2. supabase/migrations/0002_storage.sql
# 3. supabase/migrations/0003_prod_safe.sql
# 4. supabase/migrations/0004_menu_order_deadline.sql
```

> **RLS dùng `auth.jwt()->>'sub'` = Clerk user ID.** Cần cấu hình Supabase JWT secret để verify Clerk tokens (xem bước Clerk bên dưới).

### Kiểm tra local trước khi deploy

Yêu cầu Docker Desktop đang chạy. Lệnh reset sẽ xoá dữ liệu **chỉ của Supabase local** rồi áp dụng toàn bộ migration từ đầu:

```bash
supabase start       # chỉ cần khi local stack chưa chạy
supabase db reset
npm run test:all
npm run build
```

Không chạy `supabase db reset` với linked remote project. Production chỉ dùng `supabase db push` sau khi đã kiểm tra migration local.

### Storage

Migration `0002_storage.sql` tạo bucket `menus` (public) với RLS policies cho upload/read/delete. Không cần tạo thủ công trên Dashboard.

---

## 2. Environment Variables

| Variable | Lấy ở đâu | Nơi set | Ghi chú |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Supabase → Settings → API | Vercel + `.env.local` | Public |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase → Settings → API → **anon public** | Vercel + `.env.local` | Anon key, protected by RLS |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk Dashboard → API Keys | Vercel + `.env.local` | Public, starts với `pk_` |
| `GEMINI_API_KEY` | Google AI Studio → API Keys | **Vercel only** | Server-side only — **không có `VITE_` prefix** |

> ⚠️ **Tuyệt đối không** để `service_role` key hay Clerk secret trong code hay env có `VITE_` prefix.

```bash
# Set qua Vercel CLI
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_PUBLISHABLE_KEY production
vercel env add VITE_CLERK_PUBLISHABLE_KEY production
vercel env add GEMINI_API_KEY production
```

---

## 3. Clerk Configuration

### Thêm production domain

Clerk Dashboard → Configure → Domains → Add domain cho production URL.

### Cấu hình JWT cho Supabase RLS

```
1. Clerk Dashboard → Configure → JWT Templates → New Template
   - Name: supabase
   - Claims:
     {
       "sub": "{{user.id}}",
       "role": "authenticated"
     }

2. Supabase Dashboard → Settings → Auth → JWT Settings
   - Paste Clerk JWKS URL:
     https://<clerk-domain>/.well-known/jwks.json
```

---

## 4. Vercel Deploy

```bash
# Option A — merge to main (recommended, Vercel auto-deploy)
git checkout main
git merge --no-ff nhat -m "feat: presence, OG share, OCR, today redesign"
git push origin main

# Option B — deploy từ branch trực tiếp
vercel --prod
```

`vercel.json` đã có sẵn trong code — không cần chỉnh:

```json
{
  "devCommand": "vite --port $PORT",
  "buildCommand": "vite build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/share/:id", "destination": "/api/share?id=:id" },
    { "source": "/menu/:id", "destination": "/api/share?id=:id" },
    {
      "source": "/((?!api/|@|src/|node_modules/|.*\\.[^/]+$).*)",
      "destination": "/index.html"
    }
  ]
}
```

### OG share preview

- Share preview uses the original uploaded menu image.
- Text-only/legacy links use `/og-default.png`.
- No Puppeteer/Chromium download or runtime rendering is required.

---

## 5. Smoke Test sau deploy

- [ ] Vào `/` (Hôm nay) — thấy danh sách menu, không thấy form đặt món inline
- [ ] Click "Vào chọn món →" → vào `/menu/:id` đúng
- [ ] Vào menu page khi chưa login (incognito) → thấy menu + orders + guest banner, không có form
- [ ] Upload ảnh menu → OCR trả về JSON dishes
- [ ] Mở `/share/<menuId>` → HTML với OG meta tags đúng (kiểm tra bằng [opengraph.xyz](https://www.opengraph.xyz))
- [ ] Share preview của menu có ảnh dùng đúng ảnh menu đã tải lên; link text-only/legacy dùng `/og-default.png`
- [ ] Deploy không tải Puppeteer/Chromium hoặc render ảnh OG khi chạy runtime
- [ ] Mở 2 tab cùng menu → sidebar hiện avatar người kia
- [ ] Chọn món ở tab A → tab B hiện chip avatar trên món đó (trong ~1s)
- [ ] Idle 30s → refresh → người kia vẫn còn trong sidebar
- [ ] Login 2 account khác nhau (laptop + điện thoại) → thấy nhau
- [ ] Đặt món → confetti, đơn xuất hiện trong danh sách
- [ ] Đăng menu không đặt hạn chót → payload có `order_deadline: null`, menu vẫn nhận đơn bình thường
- [ ] Đăng hoặc sửa menu với hạn chót tương lai → UI hiển thị giờ Việt Nam; khi sắp hết hạn có trạng thái nhắc chốt đơn
- [ ] Với menu đã chốt: tạo/sửa/xoá nội dung đơn bị chặn và báo thân thiện; gọi trực tiếp cũng nhận `ORDER_DEADLINE_PASSED`
- [ ] Với menu đã chốt: chủ đơn vẫn tự tick hoặc bỏ tick thanh toán thành công
- [ ] Người đăng mở editor để gia hạn hoặc “Bỏ giới hạn” → menu nhận đơn lại; không cần backend hay key đặc quyền
- [ ] Trong Menu của tôi, người đăng sửa menu OCR bằng editor trực quan; ảnh gốc chỉ dùng đối chiếu và giữ tỷ lệ tự nhiên
- [ ] Món đã có đơn không thể đổi tên/xoá; giá món đã có đơn đã trả bị khoá, giá món chỉ có đơn chưa trả yêu cầu xác nhận
- [ ] Kiểm tra Supabase → Authentication → JWT settings hoạt động

---

## Rollback

```bash
# Vercel Dashboard → Deployments → chọn deployment trước → Promote to Production
# Hoặc:
vercel rollback
```

DB migrations không cần rollback nếu chỉ rollback code — schema tương thích ngược với main hiện tại.

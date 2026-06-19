# Hướng dẫn setup — đưa Cơm Trưa chạy online

> Tài liệu này hướng dẫn **từng bước** cấu hình các dịch vụ ngoài (Clerk, Supabase, Vercel) để
> dự án chạy được ở local và deploy online. Không cần kiến thức backend — app không có backend,
> chỉ là static site gọi thẳng Supabase, bảo mật bằng **RLS**.
>
> Đọc kèm: `AGENTS.md` (ràng buộc dự án) và `docs/superpowers/specs/2026-06-19-lunch-order-tracker-design.md` (thiết kế sâu).

## 0. Nguyên tắc bảo mật — đọc trước khi làm

- App chỉ dùng **publishable/anon key** — tất cả đều **công khai theo thiết kế**, an toàn để ship ra browser.
- **TUYỆT ĐỐI KHÔNG** đưa **Supabase `service_role`** hay **Clerk secret key** vào code / `.env.local` / biến môi trường Vercel / git. Chúng bypass RLS và **không cần dùng ở đâu cả** trong mô hình này.
- Rào bảo mật thật sự là **RLS policy** trong Postgres (bước 4), không phải việc giấu key.
- `.env.local` đã bị `.gitignore` chặn. Chỉ commit `.env.example` (tên biến, không giá trị).

3 biến môi trường duy nhất app cần (đều public):

| Biến | Lấy từ |
|------|--------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk (bước 1) |
| `VITE_SUPABASE_URL` | Supabase (bước 2) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key (bước 2) |

## Yêu cầu

- Node.js ≥ 20 (khuyến nghị 22+), npm.
- Tài khoản miễn phí: [Clerk](https://clerk.com), [Supabase](https://supabase.com), [Vercel](https://vercel.com).
- Đã `npm install` trong thư mục dự án.

---

## Bước 1 — Tạo ứng dụng Clerk (đăng nhập Google)

1. Vào [dashboard.clerk.com](https://dashboard.clerk.com) → **Create application**.
2. Đặt tên (vd "Cơm Trưa"). Ở phần **Sign-in options**, bật **Google**. Tắt các phương thức không cần (email/password…) nếu muốn gọn — nhóm này dùng Google.
3. Tạo xong → vào **API Keys**. Copy **Publishable key** (dạng `pk_test_...` cho môi trường dev).
   - **KHÔNG** copy Secret key — dự án không dùng.
4. Giữ key này cho bước 5 (`.env.local`).

> **Dev vs Production:** key `pk_test_...` là **instance Development** của Clerk, chạy tốt ở `localhost`.
> Khi deploy lên domain thật, xem **bước 7** (cần instance Production + key `pk_live_...`).

---

## Bước 2 — Tạo project Supabase

1. Vào [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**. Chọn region gần VN (vd Singapore), đặt mật khẩu DB (lưu lại, chỉ dùng khi cần).
2. Đợi project khởi tạo (~1–2 phút).
3. Vào **Project Settings → API**:
   - Copy **Project URL** (dạng `https://xxxx.supabase.co`) → đây là `VITE_SUPABASE_URL`.
   - Copy **anon / publishable key** (key dành cho client) → đây là `VITE_SUPABASE_PUBLISHABLE_KEY`.
   - **KHÔNG** copy `service_role` key.

---

## Bước 3 — Nối Clerk ↔ Supabase (native third-party auth)

> ⚠️ Cách cũ dùng "JWT template" đã **deprecated từ 04/2025**. Dùng **native third-party auth** như dưới.
> Mục tiêu: Supabase tin token do Clerk phát, và token có claim `role: "authenticated"`.

1. **Trong Clerk dashboard:** mở phần tích hợp **Supabase** (Configure → Integrations, hoặc trang "Connect with Supabase"). Bật tích hợp. Clerk sẽ hiển thị **Clerk domain** (dạng `https://xxxx.clerk.accounts.dev` — chính là Frontend API URL / issuer). Copy domain này.
   - Tích hợp này tự thêm claim `role: "authenticated"` vào session token. Nếu bạn cấu hình claim tay, nhớ thêm `"role": "authenticated"`.
2. **Trong Supabase dashboard:** vào **Authentication → Sign In / Providers** (hoặc mục **Third-Party Auth**) → thêm **Clerk** → dán **Clerk domain** vừa copy → lưu.

Sau bước này, khi user đăng nhập bằng Clerk, mọi request Supabase từ app sẽ mang token Clerk và được nhận diện là `authenticated`.

---

## Bước 4 — Chạy migration database + RLS

> Đây là phần **bảo mật quan trọng nhất**. Làm đúng thứ tự.

### 4.1. Tạo bảng + RLS

1. Supabase dashboard → **SQL Editor** → **New query**.
2. Mở file `supabase/migrations/0001_schema_rls.sql` trong repo, copy **toàn bộ** nội dung, dán vào, bấm **Run**.
3. Kỳ vọng: *"Success. No rows returned"*. Tạo xong 3 bảng `profiles`, `menus`, `orders` + bật RLS + các policy.

### 4.2. Kiểm RLS (bắt buộc — đừng bỏ qua)

Vẫn trong SQL Editor, chạy đoạn sau để chắc rằng user A **không** đặt đơn hộ user B được:

```sql
-- seed 2 profile (chạy với quyền owner, bỏ qua RLS — chỉ để test)
insert into profiles (id, full_name) values ('user_A','A'), ('user_B','B');
insert into menus (id, poster_id, menu_date, title)
  values ('11111111-1111-1111-1111-111111111111','user_A', current_date, 'A''s menu');

-- giả lập đăng nhập là user_A
set request.jwt.claims = '{"sub":"user_A","role":"authenticated"}';
set role authenticated;

-- A đặt đơn của chính mình: OK
insert into orders (menu_id, user_id, item_text)
  values ('11111111-1111-1111-1111-111111111111','user_A','com ga');

-- A đặt đơn GIẢ DANH user_B: PHẢI LỖI ("new row violates row-level security policy")
insert into orders (menu_id, user_id, item_text)
  values ('11111111-1111-1111-1111-111111111111','user_B','com ca');

reset role; reset request.jwt.claims;
```

- Insert đầu **thành công**, insert thứ hai **PHẢI báo lỗi RLS**.
- Nếu insert thứ hai cũng thành công → policy sai, **dừng lại sửa** trước khi tiếp tục.
- (Tuỳ chọn) dọn dữ liệu test: `delete from orders; delete from menus; delete from profiles;`

### 4.3. Tạo Storage bucket cho ảnh menu

1. Supabase dashboard → **Storage → New bucket**.
2. Tên bucket: **`menus`** (đúng tên này). Chọn **Public bucket** (cho phép đọc ảnh công khai). Tạo.

### 4.4. Policy upload ảnh

1. SQL Editor → New query → dán toàn bộ `supabase/migrations/0002_storage.sql` → **Run**.
2. Policy này chỉ cho user upload vào đúng thư mục của họ: `menus/{clerk_user_id}/...`.

---

## Bước 5 — Điền `.env.local` và chạy local

1. Trong thư mục dự án, tạo file `.env.local` (copy từ `.env.example`):

```bash
cp .env.example .env.local
```

2. Điền 3 giá trị từ bước 1 & 2:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon/publishable key của Supabase>
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxx
```

3. Kiểm tra `.env.local` **không** bị git theo dõi (phải trống ở lệnh dưới):

```bash
git status --short   # .env.local KHÔNG được xuất hiện
```

4. Chạy:

```bash
npm install   # nếu chưa
npm run dev
```

5. Mở `http://localhost:5173` → bị đẩy sang `/sign-in` → đăng nhập Google → vào được app với thanh nav + nút tài khoản.

### Kiểm thử nhanh (giờ làm được vì đã có dịch vụ thật)

- **Hồ sơ:** vào `/profile`, nhập tên + thông tin chuyển khoản → Lưu. Mở Supabase → Table editor → `profiles` thấy dòng của bạn (id = Clerk id), `payment_info` đã lưu.
- **Đăng cơm:** `/post` → đăng 1 menu (ảnh hoặc text) → vào `/` (Hôm nay) thấy menu hiện ra, kèm tên + STK người đăng.
- **Đặt món:** ở Hôm nay, gõ món → "Đặt món" → đơn hiện kèm avatar/tên bạn. Bấm "Tôi đã chuyển khoản" → đóng mộc "ĐÃ TRẢ".
- **Thu tiền:** `/dashboard` (đăng nhập bằng tài khoản đã đăng menu) → thấy ai chưa trả, gom theo người.
- **Ảnh:** menu có ảnh → URL ảnh phải mở được trên browser, đường dẫn dạng `menus/<clerk id>/...`.

---

## Bước 6 — Deploy lên Vercel

1. Đẩy repo lên GitHub (nếu chưa). [vercel.com/new](https://vercel.com/new) → **Import** repo này.
2. Vercel tự nhận **Vite**:
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - (`vercel.json` trong repo đã có SPA rewrite cho vue-router — giữ nguyên.)
3. Mục **Environment Variables**, thêm đúng 3 biến (giá trị giống `.env.local`, **không** thêm secret nào):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_CLERK_PUBLISHABLE_KEY`
4. **Deploy**. Vercel build static rồi cấp domain (vd `com-trua.vercel.app`).

---

## Bước 7 — Cho domain online hoạt động với Clerk

Key `pk_test_...` (Development) chỉ chạy ở `localhost`. Để domain Vercel đăng nhập được:

**Cách A — nhanh, để test:** trong Clerk dashboard (instance Development) → thêm domain Vercel vào danh sách origins/domains được phép.

**Cách B — đúng chuẩn production:**
1. Clerk dashboard → tạo / chuyển sang **Production instance** → khai báo domain thật (vd `com-trua.vercel.app`).
2. Cấu hình lại **Google OAuth** cho production (Clerk hướng dẫn thêm redirect URI).
3. Lấy **publishable key production** `pk_live_...`, cập nhật `VITE_CLERK_PUBLISHABLE_KEY` trên Vercel → redeploy.
4. Đảm bảo tích hợp Supabase (bước 3) cũng dùng Clerk domain của instance production.

> Supabase đã chấp nhận domain Vercel sẵn (anon key + RLS không phụ thuộc origin). Việc cần lưu ý chủ yếu là **Clerk** ở môi trường production.

---

## Checklist hoàn tất

- [ ] Clerk app có Google, có publishable key.
- [ ] Supabase project có URL + anon key.
- [ ] Clerk ↔ Supabase third-party auth đã nối (Clerk domain dán vào Supabase).
- [ ] `0001_schema_rls.sql` đã chạy, test RLS PASS (insert giả danh bị chặn).
- [ ] Bucket `menus` (Public) đã tạo, `0002_storage.sql` đã chạy.
- [ ] `.env.local` đủ 3 biến, không bị git theo dõi, không có secret.
- [ ] `npm run dev` đăng nhập + đăng menu + đặt món chạy được.
- [ ] Vercel deploy, có 3 env vars, domain online đăng nhập được (bước 7).
- [ ] **Không có** `service_role` / Clerk secret ở bất kỳ đâu.

---

## Xử lý sự cố thường gặp

| Hiện tượng | Nguyên nhân & cách xử lý |
|---|---|
| Query trả **401 / "permission denied" / RLS** dù đã đăng nhập | Token Clerk chưa tới Supabase đúng. Kiểm tra lại **bước 3** (đã dán Clerk domain vào Supabase chưa) và token có claim `role: "authenticated"` chưa. |
| Đăng nhập xong vẫn trắng / lỗi `Missing VITE_CLERK_PUBLISHABLE_KEY` | `.env.local` thiếu/sai key, hoặc trên Vercel chưa thêm env var. Dev phải **restart `npm run dev`** sau khi sửa `.env.local`. |
| Domain Vercel không đăng nhập được nhưng localhost được | Clerk chưa cho phép domain đó — xem **bước 7**. |
| Menu hiện sai ngày quanh nửa đêm | App đã tính "hôm nay" theo giờ VN (`src/lib/date.js`). Nếu lệch, kiểm tra `menu_date` được gửi từ client, không hard-code UTC. |
| Upload ảnh lỗi | Bucket tên phải đúng `menus`, là **Public**, và đã chạy `0002_storage.sql`. Đường dẫn upload phải bắt đầu bằng `{clerk_user_id}/`. |
| Profile không tự tạo khi đăng nhập lần đầu | `ensureProfile()` chạy ở `App.vue` lúc đăng nhập. Kiểm tra policy `profiles_insert` và rằng `auth.jwt()->>'sub'` khớp Clerk id. |

---

## Phụ lục — vì sao không có backend / webhook

Mô hình này cố ý **không** có server riêng: provisioning profile làm bằng **client upsert** lúc đăng nhập (`ensureProfile`), không dùng Clerk webhook (webhook cần backend + secret → phá mô hình). Nếu sau này có nhu cầu "cần `service_role` / cần webhook", đó là dấu hiệu phải **bàn lại thiết kế**, không tự ý thêm. Xem `AGENTS.md`.

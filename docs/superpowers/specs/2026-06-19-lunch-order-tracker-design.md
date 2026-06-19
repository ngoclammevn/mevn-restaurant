# Thiết kế — Lunch Order Tracker (Quản lý đặt cơm trưa)

> Ngày: 2026-06-19 · Trạng thái: đã chốt nghiệp vụ, mở phần UI/UX cho Antigravity.
> Đây là **tài liệu tham chiếu sâu**. Tổng quan ngắn cho mọi agent nằm ở `AGENTS.md` (gốc repo).

## 1. Bối cảnh & vấn đề

Hiện tại việc đặt cơm trưa diễn ra trong 1 thread Slack: một người đăng ảnh menu, mọi người
comment món mình muốn ("cho em 1 cơm gà chiên mắm tỏi"), và việc theo dõi **ai đã chuyển khoản /
ai chưa** phải đọc thủ công từng comment. Khi đông người, không có cách nào thống kê hay nhìn
nhanh ai còn nợ tiền.

App thay thế thread Slack đó bằng một nơi có cấu trúc: đăng menu, đặt món, tự đánh dấu đã trả,
và một dashboard cho người thu tiền thấy ai chưa trả.

## 2. Phạm vi (đã chốt)

- Nội bộ, **< 25 người**, tin tưởng nhau.
- Đăng nhập **Google qua Clerk**.
- DB + lưu ảnh: **Supabase** (Postgres + Storage).
- Đặt món bằng **text tự do** (giống Slack). Không có danh sách món có cấu trúc, không tính tiền tự động.
- Theo dõi thanh toán chỉ ở mức **đã trả / chưa trả** (boolean). Không nhập số tiền.
- Thanh toán theo cơ chế **self-tick, tin tưởng** — người đặt tự bấm "tôi đã trả".
- **Ai đăng nhập cũng đăng được menu**; người đăng menu = người thu tiền của menu đó.
- Một ngày có thể có **nhiều menu** (nhiều người đăng, nhiều quán).
- Thông tin chuyển khoản lưu trong **profile mỗi người**, tự hiện trên menu họ đăng.

### Ngoài phạm vi (YAGNI)

- Phân quyền admin / role-based.
- Nhập giá, tính tổng tiền, chia tiền.
- Thông báo (push/email/Slack).
- Trạng thái xác nhận 2 chiều (người thu xác nhận đã nhận tiền).

## 3. Kiến trúc

**Không có backend riêng.** Vue (Vite, static) deploy lên Vercel; gọi thẳng Supabase từ trình duyệt.
Clerk lo đăng nhập và phát session token; Supabase đọc token đó và **RLS (Row Level Security) là
toàn bộ rào bảo mật**.

```
[ Trình duyệt ]
   Vue app  ──(Clerk publishable key)──  Clerk  → đăng nhập Google, phát session token
      │
      └──(Supabase publishable key + Clerk token)──  Supabase
                                                       Postgres (RLS) + Storage
```

### 3.1. Tích hợp Clerk ↔ Supabase (ĐÃ XÁC MINH với docs 2026)

> ⚠️ Cách làm **đã đổi từ 01/04/2025**. JWT template **đã deprecated**. Dùng **native third-party auth**.

**Setup (một lần, làm trong dashboard — không phải code):**
1. Clerk Dashboard → mục tích hợp Supabase → bật → copy **Clerk domain** (vd `xxx.clerk.accounts.dev`).
2. Supabase Dashboard → Authentication → Sign In / Providers → thêm **Clerk** → dán Clerk domain.
3. Đảm bảo Clerk session token có claim `role: "authenticated"` (Clerk setup page tự thêm; nếu cấu hình tay thì thêm claim này).

**Client khởi tạo Supabase với token của Clerk** (không cần fetch token riêng mỗi request):

```js
// lib/supabase.js  — pseudo, framework UI do Antigravity quyết định
import { createClient } from '@supabase/supabase-js'

// `session` lấy từ Clerk (useSession / clerk.session tuỳ binding Vue)
export function createClerkSupabaseClient(session) {
  return createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    {
      async accessToken() {
        return session?.getToken() ?? null
      },
    },
  )
}
```

**Quan trọng — định danh người dùng:**
- Clerk dùng **string id** (vd `user_2abc...`), KHÔNG phải UUID.
- → **`auth.uid()` KHÔNG dùng được.** Mọi nơi phải dùng **`auth.jwt()->>'sub'`** để lấy Clerk user id.
- → Vì vậy `profiles.id` kiểu **`text`** (không phải `uuid`), và mọi cột FK trỏ tới người dùng cũng là `text`.

### 3.2. Bảo mật & key (ràng buộc cứng)

| Key | Nơi dùng | Lộ ra browser? |
|-----|----------|----------------|
| `VITE_SUPABASE_URL` | frontend | ✅ công khai theo thiết kế |
| `VITE_SUPABASE_PUBLISHABLE_KEY` (anon) | frontend | ✅ công khai theo thiết kế — không cấp quyền gì, RLS quyết định tất cả |
| Clerk **publishable key** | frontend | ✅ công khai theo thiết kế |
| Supabase **service_role key** | ❌ KHÔNG dùng ở đâu | 🚫 bypass RLS — chỉ ở Supabase dashboard, **cấm vào code/git** |
| Clerk **secret key** | ❌ không cần (không có backend) | 🚫 không tồn tại trong dự án |

**Bất biến bảo mật:**
- Rào bảo mật = **RLS policy**, KHÔNG phải việc giấu key. Anon key lộ ra cũng vô hại nếu policy chặt.
- **Không bao giờ** đưa `service_role` / Clerk secret vào frontend, code, hay env của Vercel client build.
- `.env*` bị `.gitignore` chặn; commit `.env.example` (chỉ tên biến, không giá trị).
- Bất kỳ nhu cầu nào "cần service_role / cần Clerk webhook" = **đã phá vỡ mô hình không-backend** → phải quay lại bàn lại thiết kế, KHÔNG tự ý thêm.

## 4. Mô hình dữ liệu (Postgres)

```sql
-- 1 dòng / người dùng. id = Clerk user id.
create table profiles (
  id            text primary key,              -- Clerk user id (auth.jwt()->>'sub')
  full_name     text,
  avatar_url    text,
  payment_info  text,                          -- text tự do: "Momo 0907.../ VCB 0123... - Nguyễn A"
  created_at    timestamptz not null default now()
);

-- mỗi lần đăng cơm = 1 menu.
create table menus (
  id          uuid primary key default gen_random_uuid(),
  poster_id   text not null references profiles(id),  -- người đăng = người thu tiền
  menu_date   date not null,                          -- ngày của menu (giờ VN, xem §6)
  title       text not null,                          -- "Menu thứ 5 - Lộc Vừng"
  image_url   text,                                   -- ảnh trong Supabase Storage (nếu menu ảnh)
  note        text,                                   -- mô tả text (nếu menu text)
  created_at  timestamptz not null default now()
);

-- mỗi món 1 người đặt = 1 order.
create table orders (
  id         uuid primary key default gen_random_uuid(),
  menu_id    uuid not null references menus(id) on delete cascade,
  user_id    text not null references profiles(id),   -- người đặt
  item_text  text not null,                           -- "cơm gà chiên mắm tỏi"
  note       text,                                    -- ghi chú thêm
  is_paid    boolean not null default false,          -- người đặt tự tick
  paid_at    timestamptz,
  created_at timestamptz not null default now()
);

create index on menus (menu_date);
create index on orders (menu_id);
create index on orders (user_id);
```

**Ràng buộc nghiệp vụ:**
- `menus.image_url` HOẶC `menus.note` nên có ít nhất một (menu ảnh hoặc menu text). Không bắt buộc cứng ở DB; UI hướng dẫn.
- Xoá menu → cascade xoá orders của menu đó.
- `paid_at` set khi `is_paid` chuyển true; clear khi chuyển lại false.

## 5. RLS policies (rào bảo mật — deliverable hạng nhất, phải test)

Bật RLS trên cả 3 bảng. `sub` = `auth.jwt()->>'sub'` = Clerk user id của người gọi.

### profiles
```sql
alter table profiles enable row level security;

-- đọc: mọi người đăng nhập (để hiện tên/avatar/STK người đăng & người đặt)
create policy profiles_select on profiles
  for select to authenticated using (true);

-- tạo: chỉ tạo dòng của CHÍNH MÌNH (provisioning lúc đăng nhập lần đầu — xem §7)
create policy profiles_insert on profiles
  for insert to authenticated
  with check (id = (select auth.jwt()->>'sub'));

-- sửa: chỉ sửa dòng của chính mình (chặn giả mạo profile người khác)
create policy profiles_update on profiles
  for update to authenticated
  using (id = (select auth.jwt()->>'sub'))
  with check (id = (select auth.jwt()->>'sub'));
-- không cấp policy delete: không cho xoá profile.
```

### menus
```sql
alter table menus enable row level security;

create policy menus_select on menus
  for select to authenticated using (true);

create policy menus_insert on menus
  for insert to authenticated
  with check (poster_id = (select auth.jwt()->>'sub'));

create policy menus_update on menus
  for update to authenticated
  using (poster_id = (select auth.jwt()->>'sub'))
  with check (poster_id = (select auth.jwt()->>'sub'));

create policy menus_delete on menus
  for delete to authenticated
  using (poster_id = (select auth.jwt()->>'sub'));
```

### orders
```sql
alter table orders enable row level security;

create policy orders_select on orders
  for select to authenticated using (true);

create policy orders_insert on orders
  for insert to authenticated
  with check (user_id = (select auth.jwt()->>'sub'));

-- sửa: chỉ đơn của mình → CHẶN người khác tick "đã trả" hộ / sửa đơn người khác
create policy orders_update on orders
  for update to authenticated
  using (user_id = (select auth.jwt()->>'sub'))
  with check (user_id = (select auth.jwt()->>'sub'));

create policy orders_delete on orders
  for delete to authenticated
  using (user_id = (select auth.jwt()->>'sub'));
```

> **Hệ quả nghiệp vụ của RLS (UI KHÔNG được vi phạm):** chỉ chủ đơn mới đổi `is_paid` của đơn đó.
> Người thu tiền (poster) **không** có nút "đánh dấu đã trả hộ" — điều đó mâu thuẫn với RLS và với
> cơ chế self-tick đã chốt. Poster chỉ *xem* trạng thái.

### Storage (bucket ảnh menu)
- Bucket `menus`, đường dẫn file: **`menus/{clerk_user_id}/{filename}`**.
- Đọc: công khai (ai cũng xem ảnh menu được) — bucket public, hoặc signed URL nếu muốn chặt hơn (mặc định: public read cho đơn giản).
- Upload: chỉ vào thư mục của chính mình:
```sql
create policy "menu upload own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'menus'
    and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
  );
```

## 6. Múi giờ & "hôm nay"

- Cả nhóm ở **Việt Nam, UTC+7 (`Asia/Ho_Chi_Minh`)**.
- `menu_date` là kiểu `date` theo **giờ VN**, do client gửi lên (client tính ngày theo timezone VN, không dùng UTC trực tiếp).
- "Menu hôm nay" = các menu có `menu_date = ngày hiện tại theo giờ VN`. Client tính "hôm nay" bằng timezone VN rồi query `menu_date = $today`.
- Tránh lỗi lệch ngày: KHÔNG dùng `new Date().toISOString().slice(0,10)` (ra ngày UTC). Dùng tiện ích format theo `Asia/Ho_Chi_Minh`.

## 7. Provisioning profile (bất biến của mô hình không-backend)

Khi một Clerk user đăng nhập **lần đầu**, chưa có dòng trong `profiles`. Vì không có backend/webhook:
- Sau khi đăng nhập, client thực hiện **upsert** profile của chính mình:
```js
await supabase.from('profiles').upsert({
  id: clerkUser.id,            // = auth.jwt()->>'sub'
  full_name: clerkUser.fullName,
  avatar_url: clerkUser.imageUrl,
}, { onConflict: 'id' })       // không ghi đè payment_info nếu đã có
```
- Hợp lệ nhờ policy `profiles_insert` (`id = sub`).
- **KHÔNG** dùng Clerk webhook để provisioning — webhook cần backend + secret, phá mô hình. Đây là bất biến.
- Upsert chỉ set name/avatar; **không** đụng `payment_info` (do người dùng tự nhập ở trang Hồ sơ).

## 8. Màn hình & luồng (HỢP ĐỒNG hành vi — UI/layout để mở cho Antigravity)

> Antigravity tự do quyết định **layout, component, visual, navigation**. Phần dưới là **hành vi &
> dữ liệu bắt buộc** — không được mâu thuẫn.

1. **Đăng nhập** — nút "Đăng nhập với Google" (Clerk). Sau đăng nhập → upsert profile (§7).
2. **Hôm nay (trang chính)** — list menu của hôm nay (giờ VN). Mỗi menu hiển thị:
   - ảnh/text menu, người đăng (tên + avatar) + `payment_info` của người đăng,
   - danh sách orders của menu (ai đặt món gì, đã trả/chưa),
   - ô đặt món (text tự do + ghi chú) → insert vào `orders` với `user_id = mình`,
   - với đơn **của chính mình**: nút bật/tắt "Tôi đã chuyển khoản" → update `is_paid` + `paid_at`.
3. **Đăng cơm** — form tạo menu: ngày (mặc định hôm nay), tiêu đề, upload ảnh **hoặc** nhập text. `poster_id = mình`.
4. **Dashboard** — góc nhìn người thu tiền: chọn ngày (mặc định hôm nay), với **các menu của tôi**, hiển thị
   các đơn `is_paid = false` **gom theo người đặt** + đếm số người chưa trả. Phải xử lý nhiều menu/ngày.
   - Truy vấn tham khảo: lấy menus where `poster_id = sub and menu_date = $date`, join orders where `is_paid = false`, group by `user_id`.
5. **Lịch sử của tôi** — các đơn `user_id = mình`, theo ngày giảm dần: ngày, menu, món, đã trả chưa.
6. **Hồ sơ** — sửa `full_name`, `payment_info` (chỉ dòng của mình).

## 9. Kiểm thử

- **RLS là phần phải test kỹ nhất** (nó là toàn bộ bảo mật). Test với ≥2 user:
  - user A không insert/update được order với `user_id = B`.
  - user A không tick `is_paid` đơn của B.
  - user A không sửa/xoá menu của B.
  - user A không sửa profile của B.
  - upload ảnh chỉ vào thư mục của chính mình.
- Test "hôm nay" quanh nửa đêm giờ VN không bị lệch ngày.
- Test provisioning: user mới đăng nhập → có profile.

## 10. Triển khai

- Repo 1 project: frontend Vue (Vite) deploy Vercel (static).
- Biến môi trường Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY` (đều công khai). KHÔNG có secret nào.
- Migration SQL (bảng + RLS + bucket) lưu trong repo (`supabase/migrations/` hoặc `docs/domain/schema.sql`) để chạy trên Supabase.

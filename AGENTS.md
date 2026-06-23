# AGENTS.md — Lunch Order Tracker

> **Tài liệu chính thức cho mọi AI agent / dev làm việc trên dự án này.**
> Đọc file này TRƯỚC khi viết code. Chi tiết sâu (data model, RLS, luồng) ở
> `docs/superpowers/specs/2026-06-19-lunch-order-tracker-design.md`.

## Dự án này là gì

App quản lý **đặt cơm trưa** nội bộ, thay cho thread Slack hỗn loạn. Một người đăng menu (ảnh
hoặc text), mọi người đặt món bằng cách gõ tay, tự đánh dấu đã chuyển khoản; có dashboard cho
người thu tiền thấy **ai chưa trả**. Nhóm **< 25 người, tin tưởng nhau**.

## Stack

| Phần | Công nghệ | Ghi chú |
|------|-----------|---------|
| Frontend | **Vue (Vite)**, static | deploy Vercel |
| Auth | **Clerk** + Google OAuth | native third-party auth với Supabase |
| DB + ảnh | **Supabase** (Postgres + Storage) | free tier |
| Backend | **KHÔNG có** | frontend gọi thẳng Supabase, RLS lo bảo mật |
| Hosting | **Vercel** (free) | chỉ static site |

> Tên thư mục là `mevn-restaurent` (lịch sử) nhưng **không dùng MongoDB/Express**. Dùng Supabase/Postgres.

## Ràng buộc nền (không được phá)

1. **Miễn phí hoàn toàn.** Mọi lựa chọn phải nằm trong free tier (Vercel, Supabase, Clerk). Nhóm <25 người nên không lo quota.
2. **Không backend riêng.** Không thêm Express/serverless function/Clerk webhook trừ khi bàn lại thiết kế. Nhu cầu "cần service_role / cần webhook" = dấu hiệu đang phá mô hình.
3. **Deploy dễ trên Vercel** — chỉ là static build.

## Bảo mật — ĐỌC KỸ (yêu cầu cao nhất của chủ dự án)

- **Rào bảo mật = RLS policy trong Postgres**, KHÔNG phải việc giấu key.
- Frontend chỉ chứa **publishable/anon key** (Supabase URL, Supabase publishable key, Clerk publishable key) — đều **công khai theo thiết kế**, an toàn để ship.
- **TUYỆT ĐỐI KHÔNG** đưa `service_role` key (Supabase) hay secret key (Clerk) vào code, frontend, hay env client. Chúng bypass RLS. Trong mô hình này **không cần dùng chúng ở đâu cả**.
- `.env*` đã bị `.gitignore` chặn. Chỉ commit `.env.example` (tên biến, không giá trị).
- Clerk dùng **string id**, KHÔNG phải UUID → **`auth.uid()` không dùng được**, luôn dùng `auth.jwt()->>'sub'`.

## Bất biến nghiệp vụ (UI agent KHÔNG được mâu thuẫn)

Đây là **hợp đồng hành vi**. Layout/visual/component để mở, nhưng các quy tắc sau là cố định:

- **Đặt món = text tự do.** Không có danh sách món có cấu trúc, không tính tiền tự động.
- **Thanh toán = boolean (đã trả / chưa trả), self-tick.** Người đặt **tự** bấm "đã trả".
- **CHỈ chủ đơn mới đổi được `is_paid` của đơn đó.** KHÔNG có nút "đánh dấu đã trả hộ" cho người thu tiền (mâu thuẫn RLS + cơ chế self-tick). Người thu chỉ *xem*.
- **Đặt hộ người khác (đặt giúp người đang họp):** người đặt có thể chọn "Đặt cho" = một người khác từ danh sách profile. Đơn khi đó **thuộc về người được đặt hộ** (`orders.user_id` = id người đó), nên **người đó** mới là người tự tick "đã trả". Để cho phép, RLS `orders_insert` đã được **nới thành `with check (true)`** (nhóm <25, tin nhau). `orders_update` **giữ nguyên** (`user_id = sub`) → vẫn chỉ chủ đơn tick được. Đây là sai lệch có chủ đích so với mô hình self-tick chặt ban đầu, đã được chủ dự án duyệt.
- **Ai đăng nhập cũng đăng được menu.** Người đăng = người thu tiền của menu đó. Không có role admin.
- **Thông tin chuyển khoản** nằm ở profile mỗi người, tự hiện trên menu họ đăng.
- Một ngày có thể có **nhiều menu**.
- "Hôm nay" tính theo **giờ Việt Nam (UTC+7)**, không phải UTC.
- Provisioning profile = **client-side upsert lúc đăng nhập lần đầu** (không webhook).

## Cố định vs Mở

| Cố định (đã chốt — đừng đổi nếu không hỏi) | Mở (Antigravity / dev tự quyết) |
|---|---|
| Stack, không-backend, free | Layout, navigation, component structure |
| Data model (3 bảng) & RLS policies | Visual design, màu, typography, spacing |
| Hợp đồng hành vi ở trên | Cách trình bày từng màn hình |
| Mô hình bảo mật & key | Thư viện UI, state management |

## Cấu trúc tài liệu

- `AGENTS.md` (file này) — tổng quan + ràng buộc, đọc trước.
- `docs/superpowers/specs/2026-06-19-lunch-order-tracker-design.md` — **spec sâu**: data model, RLS SQL đầy đủ, luồng màn hình, query dashboard, kiểm thử.
- `CLAUDE.md`, `GEMINI.md` — trỏ về file này.

## Changelog — bắt buộc cập nhật trước khi commit

File `src/changelog.json` là lịch sử cập nhật hiển thị cho người dùng. **Trước mỗi lần commit**, AI phải:

1. Đọc diff các file thay đổi
2. Tóm tắt thành bullet point ngắn gọn, tiếng Việt, dễ hiểu với người dùng cuối (không phải dev)
3. Nếu hôm nay (`YYYY-MM-DD` giờ VN UTC+7) đã có entry trong changelog → **thêm vào mảng `changes`** của entry đó
4. Nếu chưa có → **thêm entry mới** vào đầu mảng với `date` là ngày hôm nay

Ví dụ bullet point tốt: `"Sửa lỗi không lưu được đơn khi mạng chậm"`, `"Thêm tính năng đặt hộ người khác"`
Không viết: `"Fix bug"`, `"Refactor component"`, `"Update vite config"`

## Khi không chắc

Hỏi chủ dự án trước khi: thêm backend, dùng key bí mật, đổi data model/RLS, đổi hợp đồng hành vi,
hay thêm tính năng ngoài phạm vi (giá tiền, thông báo, role admin). Đó là các quyết định đã cân nhắc.

# CLAUDE.md

Tài liệu chính thức của dự án nằm ở **[`AGENTS.md`](./AGENTS.md)** — đọc file đó trước.

Spec nghiệp vụ sâu (data model, RLS, luồng): `docs/superpowers/specs/2026-06-19-lunch-order-tracker-design.md`.

Tóm tắt cực ngắn: app đặt cơm trưa nội bộ (<25 người). Stack: Vue + Vercel + Clerk + Supabase,
**không backend riêng**, bảo mật bằng **RLS** (không giấu key). **Tuyệt đối không** đưa
`service_role`/secret key vào code.

# Kiểm tra RLS bằng PostgreSQL riêng

`rtk proxy npm run test:db` dùng PostgreSQL nhúng (PGlite), không cần Docker hay
server hệ thống. Chạy từng câu lệnh ở transaction riêng để kiểm tra marker giao
dịch; dùng chính migration và assertion như runner native. Một kết nối nên không
kiểm chứng cạnh tranh giữa nhiều transaction đồng thời.

`rtk proxy bash tests/database/run-local.sh` tạo database tạm, chỉ nghe Unix socket,
áp dụng cả chuỗi migration, kiểm tra dữ liệu cũ/quán/món/đặt hộ/đánh giá/chốt đơn,
rồi dừng server và xóa thư mục tạm. Cần PostgreSQL 15+ và `initdb`, `pg_ctl`, `psql`;
đường dẫn mặc định là Homebrew PostgreSQL 18. Đặt `LUNCH_PG_BIN` nếu khác.

Không gọi Supabase production. `auth`/`storage` trong bootstrap là stub phục vụ
Postgres/RLS; kiểm tra này không xác nhận cấu hình Clerk, Storage HTTP, Realtime hoặc
PostgREST. Bộ Vitest `tests/rls` vẫn cần `supabase start` để kiểm tra các API đó.

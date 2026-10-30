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


## Cạnh tranh nhiều kết nối trên PostgreSQL thật

`run-native.mjs` dùng package test-only `embedded-postgres`, tạo server tạm chỉ
nghe Unix socket và tự dừng/xóa trong `finally`. Không nhận URL database ngoài,
không dùng Supabase production. Cài runtime ngoài repo, đặt `LUNCH_PG_RUNTIME`
trỏ tới **thư mục package** (không phải thư mục node_modules chung):

```sh
rtk proxy npm install --prefix /tmp/lunch-pg-runtime --no-save embedded-postgres@18.4.0-beta.17
rtk proxy env LUNCH_PG_RUNTIME=/tmp/lunch-pg-runtime/node_modules/embedded-postgres node tests/database/run-native.mjs
```

Phiên bản runtime ở ví dụ phải đối chiếu với package thực đã cài/registry trước
khi chạy; nếu khác, dùng phiên bản được pin trong báo cáo release. Runtime này
không được thêm vào dependency production. Cần môi trường native được package
hỗ trợ; PostgreSQL hệ thống đầy đủ có thể dùng runner `run-local.sh` cho fixtures.

Ngoài toàn bộ SQL fixtures, native runner kiểm 5 trường hợp: lưu đơn/chốt chạy
đồng thời, hai lần chốt cùng revision, reminder/chốt cùng lúc, hai claim cùng
event Slack, hai poster cùng claim thread/ngày. Bootstrap giả lập auth/storage
nên vẫn cần smoke test riêng Clerk/PostgREST/Storage HTTP khi phát hành.

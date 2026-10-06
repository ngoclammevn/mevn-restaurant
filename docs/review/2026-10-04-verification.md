# Bản review UI, dữ liệu và AI — 04/10/2026

Triển khai trong worktree `lunch-ui-ux-review`, nhánh `codex/lunch-experience-ai`,
từ `origin/main` commit `e13f916aabcc43c7a824654f3487f35bf91dac66`. Giữ nguyên
checkout gốc đang có thay đổi. Chưa commit hoặc push. Đã deploy preview Vue,
Worker thử và migration Supabase theo yêu cầu ngày 04/10/2026; xem bằng chứng bên dưới.

## Kết quả kiểm tra cuối

| Phần | Kết quả và phạm vi |
| --- | --- |
| Vue | Vite production build thành công với Node 24.19.0; còn hai cảnh báo annotation của thư viện VueUse, không làm build thất bại |
| Helper và composable | 12 test đạt: lịch tháng/nhuận/giờ VN, menu cũ, ID món, nhãn/cảm nhận, CSV, đổi tài khoản khi upload và giữ ngày menu cũ |
| Database | Toàn bộ migration áp dụng thành công trên PostgreSQL nhúng; 22 assertion và 12 thao tác phải bị từ chối đều đạt |
| Worker | 19 test ngoại tuyến đạt; TypeScript đạt; Wrangler dry-run bundle 54.24 KiB, gzip 15.30 KiB |
| UI Chromium | Đạt với mock Clerk/Supabase: sao chưa chọn sẵn, chọn nhãn/ghi chú/lưu review; 42 ô lịch; đơn chưa trả từ tháng cũ; chuyển tháng; mobile 360px không tràn ngang; structured menu không có ô nhập món tay; nháp khách còn sau đăng nhập; trang quản lý người đăng |
| Review độc lập | Đã sửa danh sách copy cũ sau chốt, mất nháp khi đăng nhập, thiếu mục chưa trả độc lập và race đăng menu khi đổi tài khoản |

Database kiểm tách món cùng tên ở hai quán, backfill không đoán quán, tạo đơn đặt
hộ với item trong cùng giao dịch, người đặt hộ không trả/đánh giá hộ, review duy
nhất cho từng item, số sao/nhãn, snapshot bất biến, hết món, nhiều lần sửa đơn
trong cùng transaction, thanh toán/review sau khi chốt, anonymous không đọc catalog.

Kiểm tra được gom sau khi triển khai, không chạy TDD hoặc test theo từng thay đổi.
Sau lỗi, chỉ chạy lại phần bị ảnh hưởng. Không chạy GitNexus theo yêu cầu chủ dự án.

## Lệnh có thể chạy lại

```sh
rtk proxy npm ci
rtk proxy npm run build
rtk proxy npm run test:unit
rtk proxy npm run test:db
cd ai-worker
rtk proxy npm ci
rtk proxy npm run typecheck
rtk proxy npm test
rtk proxy npm run dry-run
```

Node root cần 22.18+ hoặc 24.11+. Máy kiểm tra có Node 22.13 x64 cũ, nên dùng Node
24.19 ARM64 và cài lại optional binding phù hợp. PostgreSQL Homebrew local thiếu
global share/timezone links; dùng PGlite để kiểm SQL thay vì sửa cài đặt hệ thống.
Runner native trong `tests/database` vẫn có thể dùng trên PostgreSQL đầy đủ.

UI Chromium dùng harness riêng trong `/private/tmp/lunch-ui-final`, chỉ thay
Clerk/Supabase bằng fixture khi chạy kiểm tra; không có mock hoặc cửa sau trong
build sản phẩm. Ảnh dưới đây cũng dùng dữ liệu giả:

- [Hôm nay — desktop](assets/today-desktop.png)
- [Lịch cơm — mobile](assets/calendar-mobile.png)

## Cần xác minh khi cấu hình môi trường thật

- Native Clerk integration và các truy vấn PostgREST với JWT thật. Bộ `tests/rls` cũ cần `supabase start`; Docker daemon chưa
  chạy nên chưa kiểm qua Supabase HTTP/Storage/Realtime.
- PGlite một kết nối không chứng minh các tình huống tranh chấp giữa transaction
  đồng thời. Cơ chế khóa/menu và đọc lại sau commit có trong code, cần kiểm khi staging.
- Cấu hình mẫu trong Git vẫn để trống và fail closed; bản Worker thử dùng file owner
  bị Git ignore với issuer, hai origin preview chính xác, public key và namespace đã xác minh.
- Chất lượng nhãn tiếng Việt từ model thật, CPU/quota Workers Free và inference
  chưa được gọi trong lượt này. Dữ liệu/quyền/quota thật không được giả định đã đạt.
- OCR Vercel hiện hữu vẫn dùng provider cũ; chưa chuyển OCR sang Worker. Endpoint
  OCR cũ chưa xác thực được ghi nhận trong tài liệu bảo mật, ngoài phạm vi AI gợi ý.

Hướng dẫn phát hành: [triển khai](../architecture/deployment.md). Kiến trúc và sơ đồ:
[mục lục](../README.md). RLS tiếp tục là rào nghiệp vụ; token Clerk hiện có là
credential gọi Worker, không cần API key bí mật trong Vue hay đăng nhập mới.

## Deploy thử ngày 04/10/2026

- Vue: https://lunch-ui-test-minhat0601.vercel.app
  (deployment https://test-rest-r45ad0s4g-minhat0601s-projects.vercel.app,
  `dpl_3Dd96a5gfuQbxwfg9CYWTpb1m2fS`, trạng thái READY, preview của project `test-rest`).
  Domain production hiện có không được chuyển sang bản này. Preview giữ Vercel authentication.
- AI Worker: https://lunch-feedback-suggestions-test.minhat0601.workers.dev
  trong tài khoản Cloudflare của chủ app, version `ec017486-ca33-4e24-9a27-cf7d7725bc10`.
  `/health` HTTP 200; preflight từ alias preview HTTP 204; POST thiếu token HTTP 401;
  origin lạ HTTP 403. Hai rate limiter namespace không trùng Worker khác trong tài khoản.
- Supabase dùng chung project hiện tại `zabttnzoxdgfwpioqcrk`. Chủ dự án đã xác nhận
  riêng việc áp dụng catalog migration sau khi automatic approval review chặn thay đổi DB chung.
  Số menu/đơn trước và sau giữ nguyên: 11 menu, 34 đơn. Backfill tạo 221 menu item,
  92 order item; cả 5 bảng mới bật RLS. Không suy đoán quán cho dữ liệu cũ.
- Schema thật có `0004_menu_order_deadline`, khác `0004_close_ordering` trong main.
  Migration compatibility thêm `is_closed` và giữ trigger deadline cũ; menu có deadline
  đã qua được giữ trạng thái chốt. Kiểm DB nhúng chạy lại đạt 22 assertion/12 rejected write,
  cộng kiểm ánh xạ deadline đã qua/chưa qua. Runner native cập nhật nhưng chưa chạy lại
  do giới hạn cài PostgreSQL đã ghi ở trên.
- Migration history thật: `20261004014918_close_ordering_compat`,
  `20261004015046_lunch_catalog_reviews` (Management API sinh version thời điểm áp dụng).
  Tên file local mang timestamp thiết kế; phải đối chiếu history trước khi dùng `db push`,
  không chạy lại migration chỉ vì timestamp khác. Không sửa migration history của DB.
- Truy vấn nested menu qua Supabase HTTP đã trả 200; ngày 04/10 không có menu nên trả
  danh sách rỗng. Anonymous catalog trả rỗng theo RLS. Preview mở được giao diện thật.
  Sau đó quan sát Chrome với phiên Clerk thật: trang quản lý tải dữ liệu cũ và một
  menu mới ngày 04/10 gắn Quán A, có một đơn (người dùng tạo trong lúc kiểm bản thử).
  Agent không tạo hoặc sửa đơn đó. Chưa kiểm trọn luồng lưu review/gợi ý AI qua UI;
  health/CORS không chứng minh inference đã chạy. Không bật billing hoặc gói trả phí.

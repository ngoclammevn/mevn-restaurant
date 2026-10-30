# Báo cáo tổng quan đợt nâng cấp ứng dụng đặt cơm

Cập nhật **30/10/2026**, giờ Việt Nam. Nhánh triển khai `codex/lunch-company-rollout`; [PR #15](https://github.com/ngoclammevn/mevn-restaurant/pull/15) dùng nhánh remote `codex/lunch-experience-ai` để người dùng review cùng một PR.

**Mã chức năng và runbook đã hoàn tất, kiểm chứng cuối đã đạt. Chưa merge main hoặc phát hành production.** Chưa backup hay áp migration vào Supabase thật, chưa deploy Worker/Vercel mới, chưa gửi Slack thật. Không sửa các thay đổi nguồn dở của checkout `nhat`.

## 1. Hạng mục đã làm

| Hạng mục | Hành vi hiện có |
| --- | --- |
| Giữ main | Đã tích hợp main bằng `81b9457`, giữ dashboard thống kê ngày/khoảng ngày và các khoản chưa thu cũ |
| Số nhận cơm | Số di động VN được chuẩn hóa trong UI và DB, lưu theo tài khoản một lần; có sẵn thì dùng lại, đổi trong menu; liên hệ ở bảng riêng tư |
| Khả năng nhận | Lựa chọn theo người/ngày Việt Nam; đặt hộ không tự đăng ký đồng ý thay người được đặt |
| Điều phối nhận | Mỗi người một lượt bốc thăm, ưu tiên người ít nhận trong 30 ngày; chọn chính/dự phòng, kích hoạt thay thế, xác nhận nhận hàng; chưa có tình nguyện viên thì chủ menu có thể xác nhận tự thu xếp |
| Đã nhận rồi chốt lại | Giữ người/liên hệ/thời điểm đã nhận; lần chốt mới chỉ tạo phiên đối soát mới |
| Bữa được mời | Chế độ tự trả/được mời và lý do; giữ chi phí quán riêng, người ăn phải trả 0; không nhắc nợ hoặc hiện QR/nút thanh toán cho bữa được mời |
| Giá chốt | Chốt nguyên tử, snapshot bất biến mỗi revision; có màn xem lịch sử; danh sách gửi quán, QR, dashboard, công nợ và xuất file dùng cùng nguồn giá |
| Giá cũ chưa biết | Menu đã chốt từ trước mà không có snapshot giữ trạng thái chưa biết, không biến thành 0 hoặc tự coi giá hiện tại là giá quá khứ |
| Lưu trữ | Menu có đơn được lưu trữ, không mất đơn/ảnh/đánh giá/nợ; DB chặn đặt/sửa/xóa món qua link cũ, vẫn cho chủ đơn tự tick thanh toán |
| Bot Slack | Một thread/ngày; tự thông báo menu đã tạo; chủ menu xem trước rồi bấm đăng ảnh/link vào kênh chung; thông báo chốt/mở lại/đổi người nhận/đã nhận |
| Nhắc trước chốt | Slack giữ lịch sau khi đóng trình duyệt, không cần cron; đổi/tắt/chốt phải hủy lịch cũ và hiển thị lỗi hủy |
| Trạng thái gửi | Pending/sending/sent/retryable/unknown/cancel_pending; ký receipt theo phạm vi, lease chống gửi đồng thời; unknown cần chủ menu kiểm kênh trước cho gửi lại |
| Excel/CSV | Tải đủ trang, hủy/đổi tài khoản an toàn; Excel ba sheet **Gửi quán, Theo người, Chưa thu**; số là ô số, giá chưa biết tách riêng, phòng nội dung bị hiểu là công thức |
| Avatar | Tám mascot: cáo, mèo, thỏ, gấu trúc, chim cánh cụt, rái cá, robot, đầu bếp; mặc định ổn định theo tài khoản, cho tự chọn/crop/upload hoặc dùng ảnh provider; đăng nhập không ghi đè lựa chọn |
| Skeleton | Dùng `ascii-reveal/core` qua Vue; tắt/dừng khi reduced motion, tab nền hoặc không hiện; dọn animation và không bắt người dùng chờ thêm |

Ảnh mascot dùng asset MIT của `nilbuild/page-mascot`, có manifest nguồn/hash/license. Robot dùng mẫu `clockwork` upstream. Không thêm React renderer vào luồng avatar.

## 2. Kiểm chứng và giới hạn thực tế

| Phần | Bằng chứng |
| --- | --- |
| Cài bản phát hành | `npm ci --ignore-scripts --prefer-offline --no-audit --no-fund` đạt với lockfile mặc định, không cần legacy-peer-deps |
| Frontend | **57 unit tests / 11 files và 7 component regressions / 2 files đạt**; gồm giữ dashboard main, tài chính/snapshot, điện thoại, phân trang/roundtrip XLSX, avatar và API Clerk hiện tại |
| Database | **91 assertions, 48 rejected writes đạt** trên PostgreSQL native tạm; regression archive đã xác nhận RED → GREEN |
| Cạnh tranh thật | **5 ca đạt:** order/close, duplicate close, reminder/close, duplicate Slack event claim, hai poster claim cùng thread/ngày |
| Worker | **40 offline tests đạt**, TypeScript đạt; bundle dry-run từng được kiểm, không deploy |
| Build | Vite production build đạt trên Vue 3.5.44 / Vite 8.3.5 |
| Browser fixture | Kiểm popup đặt món, số sai bị chặn, lưu lần đầu, dùng lại số/lựa chọn lần sau, đổi tài khoản, bốc thăm/chốt và preview share, mở Quản lý và dialog Excel |
| Avatar fixture | Agent kiểm desktop/mobile/reduced-motion, tám mẫu, crop/EXIF, nút trong dòng không lồng nhau; ảnh tại `/private/tmp/lunch-avatar-qa/` chỉ là chứng cứ local |

Lượt tải Excel bằng browser bị timeout công cụ, **chưa xác nhận tải thành công từ UI**; kiểm tạo/đọc lại workbook bằng code đã đạt. Chưa mở file bằng ứng dụng Microsoft Excel thật. Không coi fixture là E2E production Clerk/PostgREST/Storage/Slack. Chưa kiểm live inference hoặc CPU/quota Worker Free. Review cuối đã sửa và kiểm hồi quy: DB đã chốt/mở lại không bị báo lưu thất bại khi refresh lỗi, chỉ copy snapshot mới; retry đúng sự kiện và reset trạng thái lưu khi đổi tài khoản/menu.

Khung `App.vue` đã được mở lại trong tab thử đầy đủ. `src/styles/tokens.css` và `AppNavigation.vue` không thay đổi so với head PR cũ; trang LOCAL FIXTURE ban đầu bỏ khung app chỉ để test, không phải bản bố cục phát hành.

## 3. Dependency còn cần lưu ý trước phát hành

Đã bỏ `@vercel/og` không được dùng và cập nhật các bản vá trong khoảng phiên bản tương thích; không dùng `npm audit fix --force`. Audit registry cuối ngày 30/10 ghi **11 mục: 9 high, 2 moderate; 0 critical** (tính cả chuỗi phụ thuộc, không phải 11 lỗ hổng độc lập trong app).

- Chín high nằm trong chuỗi `puppeteer-core@24.43.1` có sẵn của API OG, gồm browser installer/extract/proxy/BiDi/Zod; npm đề xuất nâng major lên 25.16.0. Đợt này chưa thay major vì phải kiểm lại Chromium trên Vercel và API OG riêng. Đây vẫn là việc cần quyết định/khắc phục trước release, không kết luận an toàn chỉ vì là dependency cũ.
- Hai moderate là `exceljs` → `uuid@8.3.2`; advisory mô tả `v3/v5/v6` khi có buffer. Source ExcelJS đang dùng `v4`; suy luận từ đường gọi hiện tại chưa thấy dùng nhánh ảnh hưởng, chưa phải bằng chứng toàn bộ bundle không thể chạm lỗi. Không ép downgrade ExcelJS hoặc override giả không sửa bundle browser đóng sẵn. [Advisory chính thức UUID](https://github.com/uuidjs/uuid/security/advisories/GHSA-w5hq-g745-h8pq).
- ExcelJS tải theo yêu cầu, chunk khoảng 929 kB minify / 256 kB gzip; đây là cảnh báo build còn lại, không làm chậm bundle khởi động bằng cách nạp Excel sẵn.

## 4. Data cũ và kế hoạch deploy

Migration mới mang tính bổ sung; giữ ID, profile, menu, đơn, món/ghi chú, `is_paid`/`paid_at`, ảnh và đánh giá. Kiểm thử có dữ liệu legacy trước khi nâng schema. **Chưa xác minh dữ liệu production hiện tại**, nên không hứa không mất data chỉ dựa trên code/test.

Năm file mới, chạy sau catalog đã có và chỉ áp phần thiếu được xác nhận:

1. `20261029144827_lunch_personal_avatars.sql`
2. `20261029145057_lunch_pickup_contacts.sql`
3. `20261029145105_lunch_sponsorship_and_finance.sql`
4. `20261029145108_lunch_close_and_pickup.sql`
5. `20261029145252_lunch_slack_events.sql`

History production từng dùng timestamp catalog khác local; project từng báo `INACTIVE` và truy vấn timeout. Không suy ra migration thiếu từ timeout, không blind db push/reset/repair.

Runbook chi tiết: [merge main, env/key, backup, triển khai từng phần và rollback](../operations/2026-10-29-main-rollout.md).

**Thứ tự:** xác minh production/history → backup code + DB + toàn bộ bytes Storage → restore thử → xử lý các mục release còn lại → áp migration thiếu → cấu hình Slack → cập nhật **một Worker AI + Slack** → merge main/deploy Vercel khi dependencies sẵn sàng → kiểm hai tài khoản và đối chiếu số liệu.

Git backup main/bản Vercel đang phục vụ chỉ giữ code. DB dump không giữ bytes Storage; ảnh phải tải riêng cùng inventory/checksum. Backup nhạy cảm nằm ngoài Git, có mã hóa. Rollback code không tự rollback DB/ảnh/lịch Slack, không restore đè làm mất đơn mới sau snapshot.

## 5. Tài liệu thiết kế và thực thi

- [Đặc tả đã chốt](../superpowers/specs/2026-10-29-slack-delivery-and-sponsor-proposal.md).
- [Kế hoạch tổng](../superpowers/plans/2026-10-29-lunch-rollout.md), [domain](../superpowers/plans/2026-10-29-lunch-domain.md), [Slack](../superpowers/plans/2026-10-29-lunch-slack.md).
- [Excel](../superpowers/plans/2026-10-29-lunch-excel.md), [avatar](../superpowers/plans/2026-10-29-lunch-avatar.md), [skeleton](../superpowers/plans/2026-10-29-lunch-skeleton.md).

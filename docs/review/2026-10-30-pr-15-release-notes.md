# Nội dung PR #15 — bản nâng cấp đặt cơm

Ứng dụng nội bộ cần gom đặt cơm theo ngày, chọn người nhận hàng và đối soát rõ cả bữa tự trả lẫn bữa được mời. PR hoàn thiện luồng từ đăng menu đến nhận cơm và xuất sổ, dùng **một Cloudflare Worker chung AI + Slack**. Đã tích hợp `origin/main` ở commit `81b9457`, giữ dashboard/thống kê và nợ cũ của main.

## Changelog đầy đủ

### Đăng menu và Slack
- Giữ giao diện Vue đã duyệt: xem lại menu/đơn trước gửi, chọn/tạo quán, dùng lại menu, bảng số suất theo món và theo người, đặt hộ, lịch ăn, hồ sơ, khẩu vị, QR và hoạt động chung.
- Menu cấu trúc chọn từ danh sách; menu text vẫn nhập tay. Đánh giá gắn đúng món/quán, 12 cảm nhận và ghi chú. Đơn đặt hộ thuộc người được đặt; chỉ họ tự đánh dấu đã trả.
- Tạo menu thành công tự đăng vào một thread/ngày trong kênh đặt cơm; chủ menu xem trước và chủ động chia sẻ ảnh/link sang kênh chung.
- Thông báo chốt/mở lại/đổi người nhận/đã nhận; chỉ tag người nhận chính có liên kết Slack. Kiểm active workspace membership khi liên kết; đây không phải xác minh sở hữu tài khoản Slack bằng OAuth.
- Thêm nhắc trước chốt bằng `chat.scheduleMessage`, hủy khi đổi lịch/tắt/chốt; không cron, Queue, KV, D1 hoặc Worker thứ hai.
- Event registry/lease và receipt ký HMAC theo namespace/kênh/revision chống gửi lại; timeout không rõ ACK hiển thị `unknown` để người đăng kiểm kênh trước cho gửi lại. Không hứa exactly-once khi Slack mất ACK.
- AI feedback giữ Clerk JWT/RLS, timeout/cache/fallback; AI hết quota không chặn Slack hoặc lưu đánh giá. Không chuyển OCR sang Worker, không triển khai pipeline daily insight.

### Nhận cơm
- Số điện thoại di động VN chuẩn hóa cả UI/DB, **lưu một lần theo tài khoản**; có rồi không hỏi nhập lại, đổi ngay trong menu.
- Khả năng nhận theo từng ngày Việt Nam, riêng với số đã lưu. Đặt hộ không tự đồng ý nhận hàng hoặc ghi số thay người nhận đơn.
- Bốc thăm mỗi người một lượt, ưu tiên người ít nhận trong 30 ngày; chọn thủ công người chính/dự phòng, kích hoạt dự phòng và xác nhận đã nhận.
- Nếu chưa ai đăng ký, chủ menu có thể xác nhận tự thu xếp và chốt chưa phân công. Chốt lại sau khi đã nhận giữ người/liên hệ/thời điểm cũ.
- Số liên hệ tách khỏi profile công khai, chỉ chính chủ và người điều phối đủ điều kiện đọc; không gửi phone, ngân hàng, JWT hoặc ghi chú riêng lên Slack.

### Thanh toán, giá chốt và quản lý
- Chế độ tự trả/được mời kèm lý do; bữa được mời có chi phí quán riêng nhưng người ăn phải trả 0, không vào công nợ/QR/nút trả tiền.
- Chốt nguyên tử tạo phiên giá bất biến; mở lại/chốt lại có revision mới, xem lại lịch sử cũ. Danh sách gửi quán, dashboard, QR, công nợ và export cùng dùng nguồn giá này.
- Menu cũ đã chốt chưa có snapshot giữ giá chưa biết; không đoán giá quá khứ và không đổi thành 0. `is_paid`/`paid_at` cũ được giữ.
- Menu có đơn chuyển sang lưu trữ thay vì xóa; giữ đơn/ảnh/đánh giá/nợ. Database chặn đặt/sửa/xóa món trên menu đã lưu trữ, vẫn cho chủ đơn tự tick thanh toán. Menu rỗng vẫn xóa được.
- Xuất XLSX ba sheet **Gửi quán, Theo người, Chưa thu** và CSV theo menu/khoảng ngày; tải đủ trang, ô tiền là số, giá chưa biết riêng, tránh công thức từ nội dung người dùng. Hủy hoặc đổi tài khoản không tải dữ liệu dở.
- Tách lỗi thông báo/tải lại khỏi thao tác DB đã thành công, giữ nháp khi lưu chưa thành công và không thúc người dùng tạo lại menu/đơn đã lưu.

### Avatar và skeleton
- Tám mascot động từ asset MIT `nilbuild/page-mascot`, nguồn/hash/license kèm repo; mặc định ổn định theo tài khoản, cho tự chọn hoặc crop/upload ảnh, giữ ảnh provider/lựa chọn khi đăng nhập lại.
- Đồng bộ avatar qua App, Menu, Quản lý, thống kê và presence; pause khi ẩn/reduced motion, không có button lồng button.
- Skeleton dùng `ascii-reveal/core` qua Vue cho Today/Menu/Manage/History/công nợ; giữ kích thước, dọn animation, không trì hoãn dữ liệu đã sẵn sàng.
- Changelog hiển thị cho người dùng cập nhật ngày **30/10/2026**, giữ các entry cũ. Bỏ dependency `@vercel/og` không dùng, nhận bản vá tương thích trong lockfile.

## Dữ liệu cũ, migration và phát hành

Năm migration mới bổ sung avatar, phone/consent, sponsorship/snapshot, close/pickup/archive và Slack registry. Không đổi ID, không xóa/reset dữ liệu cũ. Đã kiểm legacy trên DB tạm; **chưa xác nhận tình trạng/data production hiện tại**.

History catalog từng được ghi dưới timestamp remote khác local; project từng báo `INACTIVE` và truy vấn timeout. Phải so schema/SQL/history thực, chỉ áp migration còn thiếu được xác nhận; không blind `db push`, `db reset` hoặc `migration repair`.

- [Runbook chi tiết từng phần, môi trường, env/key, backup và rollback](../operations/2026-10-29-main-rollout.md).
- [Báo cáo tổng quan và bằng chứng/giới hạn](./2026-10-29-company-lunch-overview.md).
- [Đặc tả đã duyệt](../superpowers/specs/2026-10-29-slack-delivery-and-sponsor-proposal.md) và [kế hoạch triển khai](../superpowers/plans/2026-10-29-lunch-rollout.md).

Trước merge main đang auto-deploy: ghi SHA `origin/main` **và SHA deployment Vercel đang phục vụ**, backup code/bundle → dump DB roles/schema/data/history + cấu hình RLS → tải **toàn bộ bytes Storage** kèm inventory/checksum → restore thử ngoài live → áp migration thiếu → Slack App + **một Worker hiện hữu** → Vercel Production → kiểm hai tài khoản và đối chiếu dữ liệu. Git branch backup không giữ DB/ảnh; DB dump không giữ bytes Storage. Backup nhạy cảm có mã hóa và nằm ngoài Git/PR.

`VITE_*` public ở Vercel; `GEMINI_API_KEY` chỉ Vercel server cho OCR hiện có; Slack bot token và receipt key **chỉ Worker Secrets**. Không Supabase service_role/Clerk secret, không webhook Clerk/backend riêng. Preview dùng mock/local/test resource rõ ràng; không mặc định cho preview ghi vào prod hay gửi kênh Slack prod. Rollback giữ DB additive và dữ liệu mới, không restore snapshot cũ đè live; lịch Slack cần đối soát riêng.

## Kiểm chứng

- Cài sạch đúng lockfile bằng `npm ci` mặc định đạt; Vite production build đạt.
- Frontend: **57 unit tests + 7 component regressions** đạt, gồm DB commit/refresh failure, retry đúng thao tác và đổi tài khoản khi đang lưu.
- Native PostgreSQL: **91 assertions + 48 rejected writes** đạt; **5 cạnh tranh nhiều kết nối** đạt (order/close, duplicate close, reminder/close, event lease, daily thread lease).
- Worker: **40 offline tests**, TypeScript và dry-run bundle đạt, không inference/Slack/deploy thật.
- Browser fixture: số sai bị chặn, số được lưu/dùng lại, chuyển tài khoản, bốc thăm/chốt, preview share, Quản lý và dialog export. Avatar có kiểm desktop/mobile/reduced motion và crop/EXIF bằng fixture.
- XLSX tạo/đọc lại ba sheet và đủ trang đạt bằng code; **lượt tải browser timeout công cụ**, chưa xác nhận tải UI hoặc mở bằng Microsoft Excel thật.

Giới hạn còn lại: chưa E2E trên Clerk/PostgREST/Storage/Slack thật hoặc kiểm CPU/quota Worker Free. Build còn cảnh báo chunk ExcelJS lazy khoảng 929 kB minify / 256 kB gzip. Audit cuối có **11 mục (9 high từ chuỗi Puppeteer cũ của API OG, 2 moderate ExcelJS→UUID)**; phân tích đường gọi và việc nâng major cần xử lý trước release nằm trong báo cáo. Không dùng `audit fix --force` để che cảnh báo.

**PR này chưa merge main, chưa backup/restore production, chưa áp migration hoặc deploy Vercel/Worker mới, chưa gửi Slack thật.** Preview cũ ghi trong PR trước thuộc commit cũ, không dùng làm bằng chứng cho bản này.

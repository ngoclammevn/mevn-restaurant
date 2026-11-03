# Trạng thái giao diện — 01/11/2026

Nhánh làm việc: `codex/lunch-ui-clarity`. PR #15 đã merge; đợt UI này nằm trên nhánh riêng, không thay company Production.

## Lần tiếp tục sau phần Claude sửa

- Giữ các thay đổi hiện có, không reset checkout.
- Navigation dùng callback thật của GlassNav cho thao tác kéo, bỏ cơ chế dựng lại tab sau 700 ms. Click và bàn phím giữ fallback, tránh gọi route trùng.
- GlassInput dùng trạng thái IME tức thời, đồng bộ draft khi xóa nội dung, chặn xóa khi readonly.
- GlassSelect giữ kiểu giá trị và trạng thái disabled; danh sách dài hoặc màn hình thấp dùng native select.
- LOCAL FIXTURE tại cổng 4178 nay gắn các trang thật History, Profile, Taste và Catalog. Dữ liệu lịch giả có ngày đã trả, chưa trả và bữa mời; không gọi DB hay Slack. Fixture nằm ngoài Git trong `/private/tmp/lunch-ui-fixture`.

## Kiểm tra

- Build: PASS sau các sửa adapter.
- Navigation và tài chính: 9/9 tests PASS.
- Giờ nhắc theo ngày menu và múi giờ Việt Nam: 3/3 tests PASS.
- `git diff --check`: PASS.

## Kiểm tra trực tiếp trong browser test

Plugin Browser vẫn thiếu file skill, nên dùng Chromium và WebKit độc lập theo skill `ai-browser-testing`; không can thiệp phiên browser của người dùng.

- Năm màn Today, Menu, History, Post, Manage × 390/768/1440px: không lỗi JavaScript, không tràn ngang.
- Tìm món, xóa nội dung, chọn món, mở xác nhận và Escape: PASS ở ba kích thước.
- Đặt món với dữ liệu giả và lịch xanh/đỏ: PASS trên Chromium và WebKit.
- Select trong modal và sheet: chọn người, giữ modal khi Escape đóng danh sách: PASS ở390/1440px.
- Select60mục: cuộn, chọn cuối danh sách, giá trị null, bỏ qua mục disabled và khóa trigger: PASS.
- ReviewDialog ở390/1440px: không lỗi JavaScript; nút chữ pill, sao tròn, vùng bấm48px.
- Các nút trang Post dùng cùng radius999px. Ô nhập/select dùng radius16px, card24px.
- Nhóm thanh toán bỏ fieldset và khung input lồng dư; label nằm trên control, mỗi ô có một lớp nền/viền.

Ảnh và script kiểm tra nằm trong `/private/tmp/lunch-ui-check` cùng các file `/private/tmp/lunch-*-check.cjs`.

- Tìm món dùng GlassInput, nhóm món dùng GlassSegmented thật. Lọc nhóm + tìm chữ + xóa lọc: PASS390/1440px; điện thoại hiện chip xuống dòng để tránh xung đột thao tác kéo; không tràn trang.
- Sau chuyển8select và sửa tên dài, quét lại15 tổ hợp màn/kích thước: không lỗi JavaScript hoặc tràn trang.
- Select mới và nhóm thanh toán PASS trên WebKit ở390/1440px, sau khi form hoàn tất tải menu dùng lại.

## Điều hướng và bố cục mobile

- Đối chiếu README Liquid-Glass: GlassNav dùng activeIndex/onChange, app tự đặt thanh nổi. Đối chiếu Apple HIG Materials/Tab bars cho lớp điều hướng và nội dung.
- Bỏ native fallback tại trang không có tab active; luôn giữ một GlassNav với cùng kích thước. Trang Post không tô chọn tab nhưng vẫn có điểm Tab keyboard.
- Khôi phục màu active vốn có của thư viện; rule adapter trước đó ghi đè bằng màu chữ thường.
- Thanh tab mobile có khoảng hở16px hai bên và12px cộng safe-area ở đáy. Online nằm trong header, không phủ nội dung.
- Đo trước/sau route sang Post ở320/390/768/1440px: cùng DOM node, cùng width/height;0page errors. Tab active màu primary-ink và weight700.
- Kiểm mở/đóng sheet online từ header: PASS. Nút thanh toán dùng GlassButton thật, cùng nhóm secondary actions trên điện thoại.

## Lớp chữ khi kéo tab

- Tái hiện từ video và viewport393×852. Lens tạo bản sao glyph, đồng thời backdrop refraction có thể lấy lại chữ gốc; mask không che khớp khi kéo.
- Adapter navigation giữ lens dưới chữ, ẩn mirror glyph và bỏ mask trên chữ/icon gốc. Giữ hiệu ứng nâng/co giãn/kéo, chủ động không phóng đại chữ qua lens để ưu tiên đọc rõ.
- Chromium và WebKit: kéo History→Manage→Today→History PASS,0page errors. Lúc giữ tay: lens vẫn lifted, mirror không hiển thị, chữ không mang mask.
- Build PASS; ảnh lúc đang kéo: `/private/tmp/lunch-ui-check/drag-clean-chromium.png` và `drag-clean-webkit.png`.

## Giới hạn

Các luồng browser dùng dữ liệu giả, không gọi Supabase hoặc Slack. WebKit là browser test trên máy tính, chưa thay cho kiểm tra Safari/iPhone thật. Không thay Schema/Migration/RLS. Kết quả cuối cùng nằm trong [báo cáo rà soát](2026-11-01-ui-final-audit.md).

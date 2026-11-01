# Rà soát UI — 01/11/2026

Phạm vi: Today, Menu, History, Post, Manage, Profile, Taste và Catalog; viewport320/390/768/1440px. Source nằm ở nhánh `codex/lunch-ui-clarity`; company Production giữ nguyên.

## Các lỗi đã sửa

- Navigation: giữ cùng GlassNav ở mọi route, active rõ, không co thanh khi sang Post. Kéo lens chỉ giữ một lớp chữ/icon; lens nằm dưới chữ để tránh khúc xạ lấy lại chữ gốc.
- Mobile: tab bar nổi, có khoảng hở và safe-area; trạng thái online nằm trong header. Nhóm thanh toán có CTA rõ, các thao tác phụ cùng chất liệu.
- Nút: style active chung từng triệt bớt độ nở của thư viện. Nay để GlassButton điều khiển press/spring/glow; nút dùng được có opacity1 và viền rõ, nút khóa giảm opacity riêng.
- Form: bỏ các khung input lồng dư, đồng bộ radius và chữ phụ tối thiểu14px. Chọn file dùng GlassButton tiếng Việt; giữ kiểm MIME,5MB và tên file cũ.
- Profile: hàng tài khoản tự xuống dòng, không đẩy trang rộng381px ở viewport320px.
- GlassSwitch: dùng cho Còn món, khả năng lấy cơm và tự thu xếp lấy cơm. Các thay đổi trong form vẫn chờ Lưu/Chốt; tình trạng món trong bảng quản lý cập nhật như thao tác cũ. Chưa trả lời khả năng lấy cơm vẫn yêu cầu xác nhận, không tự ghi false.
- Bộ lọc: desktop dùng GlassSegmented; màn hình cảm ứng nhỏ dùng chip GlassButton hiện đủ nhãn, tránh xung đột giữa kéo lens và cuộn ngang.

- Sheet mobile: parent quyết định đóng sau khi vuốt; giữ nguyên nội dung và bản nháp khi parent từ chối đóng. Regression kiểm cả giữ bản nháp và chấp nhận đóng.

## Dropdown và lựa chọn component

GlassMenu của release0.3.10 phù hợp nhóm vài lệnh phụ. API release này không có controlled open/disabled trigger/scrolling và xử lý cảm ứng theo thao tác trượt-chọn. Không ép nó thành select cho người/quán/ngân hàng/danh mục dài.

Các select dùng listbox Apple với trigger GlassButton thật: cuộn dài, giá trị null, disabled, keyboard, và Escape chỉ đóng danh sách trong modal. Chốt, chia sẻ, lưu và xuất đơn vẫn hiện trực tiếp. Disclosure lịch sử chốt là nội dung mở rộng, không phải action menu.

## Kết quả kiểm tra

- 32/32 tổ hợp trang/viewport: không tràn trang, không pageerror hoặc lỗi Vue mà fixture bắt lại.
- Tìm kiếm/lọc danh mục và công tắc tình trạng món: PASS ở390/1440px.
- Press của nút Xuất Excel/CSV: data-pressed=true, scale khoảng1.076, glow opacity1, text opacity1 ở390/1440px.
- Chọn rồi bỏ ảnh tên tiếng Việt/emoji bằng file chooser: PASS.
- 8 tests liên quan switch/nhận cơm/giờ nhắc: PASS; các tests navigation/tài chính trước đó9/9 PASS.
- Kéo tab, chọn người trong sheet/modal và thanh toán menu giả: đã kiểm Chromium/WebKit ở các lượt trước.
- Build: PASS. `git diff --check`: PASS.

Browser dùng dữ liệu giả ở cổng4178, không gọi DB hoặc Slack. Artifacts: `/private/tmp/lunch-ui-check/final-audit.json`, `audit-controls-390.png`, `audit-controls-1440.png`, `final-post-phone.png`.

## Các giới hạn còn lại

1. Chưa kiểm trên iPhone/Android thật, máy yếu hoặc phiên sử dụng dài. Không kết luận FPS, pin hay RAM từ kết quả headless.
2. Thư viện dùng React trong app Vue. Mỗi adapter có lifecycle cleanup, nhưng nhiều nút kính vẫn tăng JS và công việc render. Chunk UI hiện khoảng155KB gzip cho cả nhóm UI; con số này không phải riêng thư viện kính.
3. Safari/WebKit không có khả năng khúc xạ toàn cảnh giống Chrome/Edge. Chấp nhận fallback mờ/viền/chuyển động; navigation chủ động giữ chữ một lớp.
4. Ô ngày đã đồng bộ style bên ngoài; popup lịch native vẫn theo browser/hệ điều hành. Release thư viện hiện không có DatePicker.
5. README nhánh main có API khác release0.3.10. Giữ version pin và kiểm types/source của bản cài trước khi dùng tính năng mới; bản này không export setGlassQuality.
6. Các kiểm tra UI dùng mock auth và API. Cần smoke test với tài khoản/dữ liệu test thật trước khi release; kết quả này không chứng minh toàn bộ luồng Production.

## Nguồn đối chiếu

- https://github.com/zakisheriff/Liquid-Glass
- https://developer.apple.com/design/human-interface-guidelines/materials
- https://developer.apple.com/design/human-interface-guidelines/tab-bars
- Source/types của `@zakisheriff/liquid-glass@0.3.10` trong node_modules.

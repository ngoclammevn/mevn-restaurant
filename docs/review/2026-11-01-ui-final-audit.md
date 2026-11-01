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
4. Lịch chọn ngày dùng chung component Apple: thứ Hai đầu tuần, bàn phím, Hôm nay, bỏ lọc ngày và popover trong modal. Release thư viện không có DatePicker; phần lịch không gắn nhãn Liquid Glass. Kiểm năm nhuận và timezone Mỹ giữ nguyên giá trị ngày.
5. README nhánh main có API khác release0.3.10. Giữ version pin và kiểm types/source của bản cài trước khi dùng tính năng mới; bản này không export setGlassQuality.
6. Các kiểm tra UI dùng mock auth và API. Cần smoke test với tài khoản/dữ liệu test thật trước khi release; kết quả này không chứng minh toàn bộ luồng Production.

## Nguồn đối chiếu

- https://github.com/zakisheriff/Liquid-Glass
- https://developer.apple.com/design/human-interface-guidelines/materials
- https://developer.apple.com/design/human-interface-guidelines/tab-bars
- Source/types của `@zakisheriff/liquid-glass@0.3.10` trong node_modules.

## Lượt rà soát lịch chọn ngày

Thay toàn bộ 8 input date ở Post, Manage, Dashboard và xuất Excel bằng AppDatePicker. DateField cũ chuyển thành wrapper, không giữ hai cách dựng lịch. Changelog ngày 30/10–01/11 đã gộp ý trùng thành các nhóm ngắn. Quét lại 32 tổ hợp layout: PASS.

## Rà soát độ gọn và đăng nhập mobile

- Danh sách menu đã đăng chuyển thành hàng gọn: thông tin, trạng thái, Quản lý và menu lệnh phụ. Chốt đơn nằm trong workspace, không lặp ở danh sách lịch sử hoặc toolbar.
- Lệnh phụ dùng GlassMenu thật cho Dùng lại, Xuất Excel/CSV, Chép link và Lưu trữ/Xóa. Giữ xác nhận thao tác xóa/lưu trữ.
- Sửa rule width popup đăng nhập vốn thu hẹp cả sheet mobile. Chỉ desktop giữ450px; mobile phủ đủ màn hình. Clerk giữ một heading hiển thị và vùng bấm48px, không ẩn legal hay nhãn Development mode của môi trường test.
- Kiểm form Clerk thật ở320/390px bằng Chromium/WebKit và desktop1440px; không tràn ngang, không lỗi runtime. Không thực hiện đăng nhập Google/email trong lượt kiểm này.

## Popup dài và mật độ control

- Sheet trước đây cuộn toàn khung, khiến tiêu đề và footer chạy khỏi vùng nhìn. Khung chung chuyển sang header/footer cố định bên trong, body là vùng cuộn duy nhất; chiều cao cập nhật theo visualViewport khi bàn phím thay đổi.
- Tăng độ đặc nền sheet để form không lẫn chữ của trang phía sau.
- Đánh giá dùng sao và chip cảm nhận phẳng, một đường viền/dấu chọn; chỉ Lưu giữ nút kính chính. Không đổi giới hạn cảm nhận hoặc logic lưu.

## Trang chọn món và chuyển khoản

Bỏ mô tả AI, dòng đang chọn và rating trống; hàng món gọn hai cột desktop. Có đơn thì ưu tiên thẻ đơn, Sửa món mở lại chooser; giữ Đặt thêm đơn. Bỏ online toàn app và câu hỏi lấy cơm lặp trên trang, giữ consent ở xác nhận. QR modal bỏ danh sách món, dùng ngày menu làm nội dung chuyển tiền; số tiền chưa rõ vẫn yêu cầu nhập, không coi là0. Desktop modal chỉ body cuộn, title không outline/box-shadow. Khôi phục sprite trái tim khi bấm mascot, giữ click của phần tử cha và reduced motion. Kiểm browser các luồng structured/plain create/edit, payment known/unknown/sponsored;5 tests avatar/motion PASS.

## Rà soát bổ sung trước khi cập nhật PR

- Build Production bằng Node 22.23.4: đạt. Còn cảnh báo chunk ExcelJS lớn và chỉ thị `use client` của thư viện UI.
- Chromium local fixture: 13 giao diện theo mùa × 320/390/768/1440px, không tràn ngang, icon treo rời dây, che tiêu đề hoặc lỗi runtime.
- Icon, đèn và dây dùng chung tọa độ đường cong; bỏ offset âm riêng cho icon giữa trên mobile.
- Theme chỉ hiện sau lần chạm mascot thứ 7; lần thứ 3 chỉ gợi ý. Chromium/WebKit ở 390/1440px đã kiểm trạng thái ban đầu, mở khóa và giữ trạng thái sau tải lại. Local preview cho phép xem trực tiếp các mùa.
- Changelog 01/07–01/11 rút gọn còn 1–3 mục mỗi ngày.
- Kết quả fixture không thay thế kiểm tra iPhone thật hoặc các luồng ghi dữ liệu sau đăng nhập. Lượt này không gọi Database/Slack Production.

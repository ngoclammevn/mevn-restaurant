# Kiểm tra UI thích ứng — 06/10/2026

Nhánh `codex/lunch-experience-ai` từ main `e13f916`. Không merge/push main; giữ checkout gốc. Thực hiện theo [kế hoạch](../superpowers/plans/2026-10-05-ui-adaptation-plan.md) và prototype đã duyệt.

## Phạm vi

Điều hướng trung tính, Today/Menu/History/Post/Manage/Profile/Taste, catalog route cũ, changelog và hộp thoại dùng chung. Quán được chọn/tạo trong đăng menu; không có tab Quán ăn. Bộ quản lý gồm Hôm nay, Tiền chưa thu, Menu đã đăng; người thu chỉ xem trạng thái, người nhận đơn tự trả/đánh giá. Khẩu vị tổng hợp 90 ngày từ đơn và đánh giá thực tế, không giả lập insight AI hằng ngày.

## Bằng chứng kiểm tra

- `npm run test:unit`: 20 test qua (3 file), gồm riêng tư presence, nhiều tab, món cùng tên khác quán, nợ cũ, giá chưa biết, lịch và đổi tài khoản.
- `npm run test:db`: PostgreSQL nhúng qua 22 assertion, 12 thao tác từ chối; không chạm DB thật. Bao gồm dữ liệu cũ, quyền RLS, snapshot và đặt hộ.
- `npm run build`: qua với Node 24.19; hai cảnh báo annotation có sẵn của VueUse không chặn build.
- Worker: 19 test hợp đồng ngoại tuyến qua; TypeScript qua. Cập nhật fixture cache/output từ 4 nhãn cũ sang 12 cảm nhận; không gọi model hay deploy.
- Review độc lập đã phát hiện và sửa mất hộp thoại đánh giá khi History refresh cùng liên kết kho menu sai tab.
- Trình duyệt chạy Vue thật với Clerk/Supabase fixture chỉ trong `/private/tmp`: đánh giá chưa chọn sao sẵn, 12 cảm nhận theo món, ghi chú/lưu; hộp thoại còn mở sau broadcast; lịch 42 ô; quản lý đọc trạng thái thanh toán; khoản từ tháng 8 nằm riêng; Post xem lại; Profile mở đúng kho menu; Menu chọn món có bước xác nhận tổng tiền; float hiển thị đúng quán/món đang chọn. Desktop 1280px và mobile 375px; mobile không tràn ngang sau loại nút test quá rộng của harness. Harness không nằm trong repo/build.

## Giới hạn và phát hành

- Không deploy AI Worker hoặc bật cron. Chủ app sẽ triển khai Worker khi release; chưa có daily-insight pipeline. Gợi ý local vẫn dùng được khi Worker chưa cấu hình/lỗi.
- Không áp dụng migration trong lượt UI này. Migration catalog đã được chủ app duyệt và áp dụng ở lượt trước; xem báo cáo 04/10 và đối chiếu timestamp thật trước `db push`.
- Kênh Realtime đang dùng mô hình public như kế hoạch đã duyệt: frontend chỉ kết nối sau đăng nhập và lọc metadata trang riêng trước gửi. Đây không phải authorization nhóm kín ở server; không gửi token, ghi chú, thanh toán hoặc chi tiết lịch sử. Private channel/RLS authorization cần thay đổi riêng.
- PaymentQRModal đã đồng bộ sau khi chủ app xác nhận riêng luồng VietQR/MoMo. Chỉ chủ đơn xác nhận đã trả; có loading/error, giá chưa biết yêu cầu nhập tay, đổi tài khoản đóng hộp thoại. Kiểm thử QR dùng endpoint SVG fixture tại localhost, không gửi thông tin tài chính thật hoặc chuyển tiền.
- Không tuyên bố đã kiểm Supabase HTTP/Storage/realtime đa người và inference thật. Test DB nhúng không chứng minh tranh chấp transaction song song. Không chạy bộ RLS cần Docker/Supabase local trong lượt này.

Ảnh bằng chứng dùng dữ liệu giả: [quản lý mobile](assets/manage-mobile-20261006.jpg), [menu desktop](assets/menu-desktop-20261006.jpg).

## Đối chiếu lại demo sau phản hồi

Đã sửa bố cục Today/Menu/Post/Manage/History/Profile/Taste theo các override cuối của prototype. Menu dùng danh sách món toàn chiều ngang và thanh đặt món phía dưới ở desktop/mobile. Nav có nút Đăng menu trung tính, account trong Hồ sơ. Nút toàn app theo đúng kích thước, viền, độ đậm của từng nhóm trong demo.

Unit 20 và build qua sau khi ráp; build được kiểm tra lại sau sửa wrapper lịch. Trình duyệt xác nhận 375px không tràn ngang, nút tiếp tục mở đúng xác nhận (35.000đ và người nhận), QR ngân hàng/MoMo với dữ liệu thử, lưu đánh giá trong Lịch vẫn giữ hộp thoại sau refresh. Chỉ dữ liệu mẫu khác demo; không thêm giờ chốt/điểm đánh giá giả.

Ảnh sau đồng bộ: [desktop](assets/today-desktop-final-20261006.jpg), [mobile](assets/today-mobile-final-20261006.jpg). Ảnh bên trên ghi lại vòng ráp đầu, không phải bản cuối.

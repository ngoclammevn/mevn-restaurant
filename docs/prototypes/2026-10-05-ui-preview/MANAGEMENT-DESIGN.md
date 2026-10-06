# Quản lý cho người đăng — bản xem trước 05/10/2026

Người dùng xác nhận phạm vi thao tác là **món trong menu và đặt hộ người khác**. Tiếp tục duyệt bằng prototype; chưa sửa Vue, DB hoặc deployment.

## Điều hướng chung

Hôm nay, Lịch cơm, Quản lý, Cá nhân. Desktop dùng avatar cho Cá nhân; mobile có bốn mục phía dưới. Không có tab Quán ăn. Quán được chọn/tạo trong luồng đăng menu, hiển thị trên menu và gắn với đánh giá món.

## Quản lý hôm nay

- Mở đúng ngày VN theo mặc định; nhiều menu trong ngày dùng bộ chọn menu.
- Số suất và tổng tiền nổi rõ. Bảng theo món gồm tên, số suất, giá, tổng dòng, tình trạng và thao tác.
- Thêm món / Sửa / Báo hết món truy cập trực tiếp. Món chưa có đơn có thể xóa; món có đơn không đổi tên hoặc xóa, theo trigger đang có. Menu chốt phải mở lại trước khi chỉnh.
- Số suất được tổng hợp từ đơn. Muốn bổ sung suất cho một người dùng Đặt hộ: chọn người, món, ghi chú, xem lại, xác nhận. Đơn thuộc người nhận.
- Chuyển sang Theo người để xem ai đã trả/chưa trả và lọc từng nhóm. Người thu chỉ xem trạng thái của người khác.

## Tiền chưa thu

- Tách khoản hôm nay khỏi các ngày trước. Không nhét mọi menu cũ vào màn chuẩn bị cơm hôm nay.
- Nhóm theo người: số khoản, tổng tiền xác định được, ngày xa nhất. Mở từng người để xem ngày/quán/món/tiền và vào đúng menu.
- Lọc Hôm nay, 30 ngày trước (không gồm hôm nay), Trước 30 ngày và Tất cả; tìm tên, xem bữa cũ nhất.
- Khoản chưa xác nhận vài tháng vẫn được giữ và thấy khi mở nhóm. Không tự xóa hoặc đánh dấu đã trả vì đã cũ.
- Trạng thái dựa trên từng người tự xác nhận trong app. Số tiền thiếu được ghi Chưa có giá; không giả là 0đ.

## Menu đã đăng

Khu lưu menu, tìm/lọc theo ngày và trạng thái. Mở một menu để quản lý; không trộn danh sách này vào bảng món hôm nay. Mở/chốt, CSV, chia sẻ và dùng lại là thao tác phụ tại đây.

## Giới hạn và triển khai

Prototype dùng dữ liệu mẫu có khoản từ tháng 7–9 để thấy vấn đề nhiều tháng. Cơ chế truy vấn ledger trong app chỉ lấy orders của menu do người hiện tại đăng, không lấy lịch sử đặt riêng của họ. Không đổi RLS, thêm role hoặc tạo bảng công nợ mới.

Guard hiện tại được xác minh trong `supabase/migrations/20261003080019_lunch_catalog_reviews.sql`: món có đơn không đổi tên/canonical hoặc xóa. Giá được phép sửa nhưng không có price snapshot; trước khi áp dụng cần hiển thị tác động của đổi giá, không tự hứa tổng tiền cũ bất biến.

## Phạm vi bản mẫu hiện tại

Đã dựng ba khu quản lý, bộ lọc thanh toán, chi tiết khoản cũ, thao tác món và đặt hộ bằng dữ liệu minh họa. Tìm kiếm, CSV, chia sẻ và dùng lại ở khu Menu đã đăng nằm trong kế hoạch tích hợp app; chưa có trong bản mẫu quản lý này.

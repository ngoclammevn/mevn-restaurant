# Bản xem trước Cơm Trưa — 05/10/2026

Trạng thái: mẫu tương tác để duyệt UI. Không kết nối Clerk, Supabase hay Cloudflare. Không triển khai vào ứng dụng đang dùng. Tên người, món ăn, đánh giá và biểu đồ đều là dữ liệu minh họa.

Mở `http://127.0.0.1:4177/preview.html` trên máy đang chạy phiên làm việc này. Nút Máy tính/Điện thoại đổi khổ xem, không làm mất lựa chọn trong mẫu.

## Quyết định đã xác nhận

- Điện thoại và máy tính đều quan trọng.
- Realtime chia sẻ tên, trang chung đang xem và món đang chọn.
- Ở Hồ sơ, Lịch cơm và Khẩu vị, người khác chỉ thấy trạng thái online.
- Phải phân biệt rõ **đang chọn** và **đã đặt**; giỏ tạm không được tính thành đơn.
- Duyệt bản xem trước trước khi sửa tiếp ứng dụng.

## Hướng thiết kế

Nền trắng/ngà, nav trung tính với gạch dưới mục đang xem. Xanh lá chỉ dành cho hành động chính và trạng thái có ý nghĩa. Một hành động chính trên mỗi màn hình. Chỉ hiện thông tin thêm khi người dùng cần; không đẩy mọi công cụ của người đăng vào trang đặt cơm.

Nút realtime thu gọn luôn có nhãn và số người. Máy tính mở bảng nổi; điện thoại mở bảng từ dưới lên. Bảng có nút đóng, không dựa vào hover. Khi chọn món, vị trí nút online phải chừa khoảng cách với thanh đặt cơm và điều hướng. Không tự bật bảng hoặc hiện toast cho từng thay đổi của người khác.

Đánh giá gắn với **món + quán**, có sao chưa chọn sẵn, các gợi ý theo tên và cách nấu, cùng ghi chú tự do. Gợi ý là lựa chọn cho người dùng; mẫu không giả làm kết quả gọi AI thực tế.

Lịch cơm chọn ngày để xem đã ăn gì. Khẩu vị phân biệt tần suất đặt với mức yêu thích từ đánh giá, luôn ghi số mẫu. Biểu đồ minh họa chưa phải phân tích dữ liệu thật.

## Áp dụng UI/UX Pro Max

Nguồn skill: `/private/tmp/lunch-ui-ux-pro-skill/.claude/skills/ui-ux-pro-max/SKILL.md` (bản từ repo chính thức nextlevelbuilder/ui-ux-pro-max-skill).

Đã tra cứu hướng dẫn Web về focus không bị che và cập nhật badge có ngữ cảnh. Áp dụng nút tối thiểu 44px, focus rõ, icon SVG, bố cục thích ứng, giảm chuyển động theo thiết lập hệ thống. Kết quả design-system có phần landing/funnel không phù hợp app nội bộ nên không áp dụng cấu trúc đó; giữ nhận diện xanh đang có.

## Cập nhật theo phản hồi

- Nav desktop tách điều hướng khỏi nhóm Đăng menu/Cập nhật/Cá nhân. Mobile có bốn mục Hôm nay/Lịch cơm/Quản lý/Cá nhân; không tab Quán ăn.
- Đã bổ sung Cá nhân, Quản lý, Dashboard, Đăng nhập, hộp thanh toán và changelog; Khẩu vị dùng cùng shell.
- Đăng menu đã bỏ nút Dùng menu cũ; còn nhập món và đọc ảnh mẫu.
- Câu chữ ngắn, không có slogan hoặc nhãn nhà cung cấp AI trong luồng sử dụng.
- Ngay dưới mỗi món có điểm, số lượt và phản hồi gần đây theo đúng quán. Bấm xem phân bố sao/ghi chú; món chưa có dữ liệu ghi Chưa có đánh giá.
- Xem UI-COVERAGE.md để biết các giới hạn tương tác mẫu. Kế hoạch áp dụng: docs/superpowers/plans/2026-10-05-ui-adaptation-plan.md.

## Các điểm cần phản hồi sau khi xem

1. Trang Hôm nay đã giúp quyết định đặt gì và biết đơn của mình nhanh chưa?
2. Float realtime có đủ hữu ích, hay vẫn chiếm chỗ khi đặt món?
3. Đánh giá từng món có đủ lựa chọn cụ thể mà vẫn nhanh?
4. Lịch và biểu đồ khẩu vị có cho thấy thông tin bạn muốn dùng để chọn bữa sau?

## Kiểm tra bản mẫu

Đã bấm thử trong trình duyệt: chọn quán và món, tổng tiền và màn xác nhận; chọn ngày trong lịch; gợi ý thay đổi đúng theo món cá kho/gà/canh; chọn sao, ghi chú; mở bảng realtime dạng bottom sheet trên điện thoại. Ô ngày đo được khoảng 46px ở khổ xem 390px. Mã JavaScript được kiểm tra cú pháp; lỗi trùng tên với thuộc tính browser đã sửa. Đây là kiểm tra mẫu UI, không phải kiểm thử hoặc triển khai app thật.

Sau khi ghép các màn bổ sung, đã kiểm tra cú pháp toàn bộ script, bấm luồng ảnh mẫu → đọc món → xem lại → đăng mẫu → xuất hiện trong Quản lý, xem Dashboard không có nút tick hộ, và changelog mới nhất → lịch sử. Đã xem nav mới trên desktop/mobile và bấm chi tiết đánh giá gà của đúng quán. Đó là kiểm tra prototype, không phải kết quả kiểm thử app thật.

Quản lý mới chia Hôm nay / Tiền chưa thu / Menu đã đăng. Món và số suất có bảng riêng, thanh toán lọc theo người, khoản tháng cũ nhóm theo người trong ledger. Có thêm/sửa/xóa món hợp lệ và đặt hộ; không tick thanh toán hộ. Xem MANAGEMENT-DESIGN.md.

### Cập nhật quản lý và điều hướng 05/10

Không có tab Quán ăn trên desktop, mobile hoặc bộ chọn màn hình. Quán được chọn/tạo lúc đăng; đánh giá món gắn với quán trên menu. Đã ghép `manage-workspace.js` vào prototype. Kiểm tra cú pháp các script đạt; trên trình duyệt, Hôm nay có 5 suất/190.000đ, khoản chưa thu 80.000đ hôm nay và 175.000đ các ngày trước, chi tiết cũ có ngày/quán/món. Chưa kiểm thử lại mọi dialog quản lý trên trình duyệt; đây không phải xác nhận app thật đã chạy các thay đổi.

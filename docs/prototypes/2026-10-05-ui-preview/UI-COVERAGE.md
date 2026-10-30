# Rà soát đồng bộ UI — 05/10/2026

Phạm vi: bản xem trước tương tác. Chưa áp dụng thiết kế này vào Vue, Supabase hoặc Cloudflare. Đối chiếu `src/router.js`, các page và các hộp thoại trong worktree dựa trên main.

## Bao phủ màn hình

| Trang / luồng trong app | Gap của bản mẫu đầu | Bản xem trước đã bổ sung |
| --- | --- | --- |
| Hôm nay `/` | Điều hướng chưa tới trang cá nhân/quản lý | Thanh đầu trang chung, thông tin đơn của mình, lựa chọn quán |
| Menu `/menu/:id`, `/share/:id` | Trạng thái chốt/hết món chưa rõ | Chọn món, giỏ, đặt hộ, xác nhận; trạng thái chốt/hết món và yêu cầu đăng nhập |
| Quán `/catalog` (legacy) | Từng có tab riêng, không đúng hai luồng người dùng | Bỏ tab Quán ăn; người đăng chọn/tạo quán trong Post, người đặt xem quán và đánh giá từng món trên menu |
| Lịch cơm `/history` | Thanh toán chưa có hộp thông tin riêng | Lịch tháng, chi tiết ngày, đánh giá, hộp chuyển khoản và tự xác nhận |
| Cá nhân `/profile` | Chưa có | Tên, ngân hàng, MoMo, nhập tự do, lưu mẫu, cảnh báo thiếu thông tin, liên kết các trang riêng và đăng xuất mẫu |
| Đăng menu `/post` | Chỉ bố cục, chưa có quy trình | Quán/ngày/giờ chốt, danh sách hoặc menu chữ, ảnh mẫu → đọc món → chỉnh → xem lại → đăng mẫu |
| Quản lý `/manage` | Món/thu tiền nhiều tháng lẫn trong danh sách menu | Ba workspace Hôm nay / Tiền chưa thu / Menu đã đăng; bảng suất theo món, chỉnh món trực tiếp, đặt hộ, lọc paid, ledger cũ theo người |
| Menu tôi đăng `/my-menus` | Chưa có | Dùng chung thiết kế Quản lý; tránh hai cách quản lý cạnh tranh |
| Thu tiền `/dashboard` | Chưa có | Theo món/người/chưa trả; đơn đặt hộ thuộc người nhận; trạng thái người khác chỉ được xem |
| Đăng nhập `/sign-in` | Chưa có | Mẫu bước tiếp tục Google và xem menu chia sẻ; không gọi Clerk thật |
| Khẩu vị đề xuất | Tách thành trang có header/float khác | Ghép vào shell chung; biểu đồ yêu thích/hay đặt, số đánh giá và độ chắc chắn |
| Changelog hiện có trong app | Bị bỏ sót | Nút Cập nhật trên header, dấu chưa xem trong phiên mẫu, hộp mới nhất và lịch sử đầy đủ theo ngày |
| Presence toàn trang | Từng trang có cách mở khác nhau | Một float chung: desktop bảng nổi không khóa trang; điện thoại dialog; tên + trang chung + đang chọn/đã đặt, trang riêng chỉ online |

## Quy tắc đồng bộ

- Nền trắng/ngà `#fafaf8`, chữ và border trung tính. Xanh `#1f6e45` dành cho hành động chính, biểu đồ và trạng thái chọn có ý nghĩa; nav không dùng các pill màu.
- Nút và mục điều hướng tối thiểu 44px; focus nhìn thấy được; có nhãn cho icon; reduced motion.
- Desktop: Hôm nay/Lịch cơm/Quản lý, gạch dưới active, nhóm công cụ Đăng menu/Cập nhật/Cá nhân. Mobile: Hôm nay/Lịch cơm/Quản lý/Cá nhân. Không tab Quán ăn.
- Realtime giữ khoảng cách với giỏ và bottom navigation; changelog không cạnh tranh bằng float riêng.
- Form đăng có lỗi tại ô và tóm tắt lỗi nhận focus; giữ nháp trong phiên khi đổi trang. Đăng xong xuất hiện trong Quản lý mẫu.
- Menu danh sách bắt buộc chọn món; menu chữ cho nhập tự do; người nhận đơn tự xác nhận thanh toán.
- Trang đăng chỉ có nhập món hoặc đọc từ ảnh; bỏ nút Dùng menu cũ theo yêu cầu mới. Dùng lại ở Quản lý là tính năng riêng hiện có, không thêm lại bộ chọn menu cũ trên trang Đăng.
- Câu chữ là tên trang, nhãn và hướng dẫn ngắn; không dùng giọng quảng cáo, không nhắc nhà cung cấp AI/backend trong luồng chính.
- Biểu đồ không đồng nhất “hay đặt” với “thích”; AI không chọn sao hộ. Mọi dữ liệu insight, presence và OCR trong mẫu đều mô phỏng.

## Trạng thái có thể xem

Bộ chọn trên `preview.html` có dữ liệu mẫu, đang tải, lỗi kết nối, trống, chưa đăng nhập, menu đã chốt, món vừa hết và AI chưa phản hồi. Chốt/hết món áp dụng ở Chọn món, AI fallback khi mở đánh giá. Lỗi/trống dùng mẫu bố cục chung để duyệt; chưa mô phỏng hết từng lỗi backend.

## Gap còn lại trước khi đưa vào ứng dụng thật

- Tích hợp auth/session, RLS, realtime presence, API AI và dữ liệu thật vẫn là bước triển khai sau duyệt UI.
- OCR thật, upload/chỉnh ảnh, xác nhận/xóa menu có đơn, phân trang catalog, menu không có giá và QR/MoMo thật cần nối với hành vi sẵn có rồi kiểm thử cuối đợt.
- Lịch mẫu minh họa tháng 10/2026, nút tháng khác chỉ thông báo; không có đầy đủ điều hướng tháng như app thật. Đây là giới hạn tương tác mẫu, không phải đề xuất bỏ tính năng.
- Quản lý mẫu cho sửa món tiêu biểu; không giả là trình chỉnh mọi món của menu thật. Các hành động xem/dùng lại chia sẻ cũng minh họa, chưa định tuyến theo ID dữ liệu thật.
- Nháp, đánh giá, trạng thái đã xem changelog và đăng nhập mẫu chỉ giữ trong phiên trang; tải lại sẽ reset. Không thay changelog của app đang chạy.

## Kiểm tra sau khi ghép

Đã kiểm tra cú pháp các script và bấm thử các màn/luồng bổ sung trong trình duyệt. Ghi nhận chi tiết ở README. Không chạy kiểm thử app thật hoặc deploy cho đợt duyệt UI này.

## Điều chỉnh sau phản hồi

Đã rút gọn nav, giảm nền màu và loại bộ chọn menu cũ ở Đăng menu. Đã xem nav trên desktop/mobile và xác nhận trang Đăng chỉ có Nhập món/Từ ảnh menu.

## Đánh giá trên menu

Mỗi món hiển thị điểm trung bình, số lượt và hai cảm nhận thường gặp của đúng quán. Bấm mở phân bố sao, tổng cảm nhận và ghi chú mẫu; món chưa có dữ liệu ghi Chưa có đánh giá. Menu chốt vẫn cho đọc đánh giá, chỉ khóa việc chọn món. Không đặt sẵn điểm đánh giá cho người xem.

## Quản lý sau phản hồi

Xem MANAGEMENT-DESIGN.md. Người dùng xác nhận thao tác là món trong menu + đặt hộ, không sửa đơn người khác. Quản lý tách bữa hôm nay khỏi khoản chưa xác nhận từ tháng cũ. Kế hoạch bổ sung truy vấn ledger theo poster, phân trang đầy đủ, guard món có đơn, và tổng tiền có thể thiếu giá.

## Kế hoạch adapt toàn bộ

Tham chiếu `../../superpowers/plans/2026-10-05-ui-adaptation-plan.md` trong docs. Kế hoạch gồm shell chung, người đặt, người đăng/quản lý, realtime, các trang riêng/dialog, Khẩu vị và kiểm tra cuối. Khẩu vị ban đầu dùng thống kê quan sát từ đơn/đánh giá thật; insight AI nền và giờ chốt tự động có phạm vi dữ liệu riêng. Đây là kế hoạch, chưa xác nhận Vue đã được adapt.

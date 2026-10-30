# Rà câu chữ app, PR và hướng dẫn Deploy

Ngày kiểm: 30/10/2026. Quy tắc đối chiếu: `~/.codex/AGENTS.md` và yêu cầu viết tiếng Việt tự nhiên của chủ app.

## Kết quả

Bản trước chưa thống nhất cách gọi người lấy cơm, còn câu thụ động và nhiều đoạn dồn quá nhiều thuật ngữ. PR description dài, comment release dẫn đến bản tài liệu cũ có lệnh RTK. README Worker chủ yếu dùng tiếng Anh.

Lượt sửa này rà câu hiển thị trong app, mô tả PR #15, comment release, runbook, guide Deploy và README Worker. Giữ các tên API, key, command, file và technical terms cần cho người Deploy.

| Trước | Sau |
| --- | --- |
| Chưa tải được phân công nhận cơm | Chưa tải được thông tin người lấy cơm. Thử lại nhé. |
| Phiên chốt … · Giá tại lúc chốt được giữ cho đối soát | Lần chốt … · Xem món và giá của lần này trong lịch sử. |
| Xuất đơn & đối soát | Xuất đơn và tiền chưa thu |
| Các món đã chọn vẫn được giữ, hãy thử lại | Bạn vẫn còn các món đã chọn. Thử lại nhé. |
| PR này được gộp vào main | Merge PR này vào main để nâng cấp app hiện tại. |

Giữ “Mình lấy được” và “Được mời”: đây là cách nói tự nhiên trong nghiệp vụ, không phải câu mô tả hệ thống ở thể bị động.

## Những phần đã sửa

- Thống nhất “lấy cơm”, “người lấy cơm”, “lần chốt” trong các màn liên quan và cột Excel/CSV. Phân biệt với “người nhận đơn” khi đặt hộ và “người nhận tiền” khi chuyển khoản.
- Giải thích ngay cạnh lịch nhắc: bot nhắc chung trong thread đặt cơm, mọi người có quyền xem kênh đều thấy. Tag người lấy cơm cần liên kết Slack; người dự phòng chỉ nhận nhắc khi chủ menu gọi.
- Rút gọn lỗi tải/lưu, hướng dẫn nháp, lịch sử, đánh giá, avatar và thanh toán.
- Chuyển các form Clerk trong app sang locale `viVN` chính thức, sửa tiêu đề/subtitle đăng nhập cho hợp với app. Branding và nhãn môi trường do Clerk quản lý vẫn theo provider.
- Thu gọn khung popup đăng nhập từ 720px về tối đa 450px; bỏ khung và shadow lồng nhau của form Clerk. Giữ OAuth flow và redirect hiện tại.
- Viết PR description theo Context → Changes → Test plan; dẫn tới changelog đầy đủ thay vì dồn mọi chi tiết vào description.
- Comment release có các lệnh Wrangler CLI, tên biến/nơi đặt key, thứ tự Migration/Deploy và Rollback. Bỏ link cố định tới tài liệu cũ.
- README Worker dùng tiếng Việt; hướng dẫn cài Wrangler theo lockfile, đăng nhập đúng account và cập nhật một Worker chung AI + Slack.
- Giữ yêu cầu backup code, Database và toàn bộ file Storage; restore thử ở môi trường riêng trước khi Merge/Migration/Deploy. Hướng dẫn nâng cấp lên main đang chạy, dùng lại dữ liệu hiện tại.

## Kiểm tra

- Build frontend: đạt. Lockfile chỉ thêm `@clerk/localizations@4.24.3`, dùng lại `@clerk/shared` hiện có.
- 7 component regression tests sẵn có: đạt. Một assertion đổi label “Phiên chốt 1” thành “Lần chốt 1”; vẫn kiểm revision tới parent trước khi cho sao chép.
- 4 test export sẵn có: đạt sau khi thống nhất tên cột Excel/CSV.
- So AST script của 17 màn/component sửa câu chữ: cấu trúc giữ nguyên, chỉ khác string literals. Style/appearance đăng nhập và locale trong `main.js` là phần code thay đổi thêm.
- Clerk thật trên local: desktop 1280×720 có dialog rộng 450px, form 400px; mobile 390×844 không tràn ngang. Chưa đăng nhập Google hoặc ghi dữ liệu để kiểm luồng này.
- GitNexus impact đã chạy trước khi sửa các hàm. Các hàm lưu lựa chọn lấy cơm có mức HIGH vì nhiều màn dùng chung; báo cáo tổng có mức CRITICAL. Kiểm diff/AST và component regressions cho thấy phần sửa câu chữ không đổi thao tác lưu hoặc điều kiện validate.

Các báo cáo/spec cũ ghi lại từng thời điểm; số liệu trong đó không thay thế Log kiểm của Commit chuẩn bị release. Các mục cần kiểm trên Slack, Storage, Excel UI, auth sau đăng nhập và quota/CPU Workers Free vẫn nằm trong Test plan của PR. Cảnh báo dependency và chunk ExcelJS vẫn còn; lượt sửa này chưa xử lý chúng.

Đợt này chưa Merge main, chưa backup/restore dữ liệu Production, chưa chạy Migration và chưa Deploy Production.

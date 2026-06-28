# Tài liệu thiết kế — Tích hợp Chuyển tiền QR (VietQR & MoMo)

## Tổng quan
Tài liệu này đặc tả thiết kế kỹ thuật cho tính năng tạo mã QR thanh toán động dựa vào đơn hàng trên ứng dụng Đặt Cơm Trưa. Mục tiêu là giúp người đặt cơm quét QR thanh toán tức thời sang tài khoản của người đăng thực đơn, tự động điền đúng Số tài khoản, Ngân hàng, Số tiền, và Nội dung chuyển khoản mà không cần gõ thủ công.

---

## 1. Lưu trữ Thông tin Tài khoản (Hồ sơ)
Vì cấu trúc bảng `profiles` trong cơ sở dữ liệu đã cố định và không được đổi data model, chúng ta sẽ lưu trữ thông tin chuyển khoản dạng chuỗi văn bản có cấu trúc chuẩn hóa vào cột `payment_info text`.

### Cấu trúc chuỗi lưu trữ:
```text
STK: 0071001234567
NH: VCB
CTK: NGUYEN VAN A
Momo: 0907123456
```
* **STK:** Số tài khoản ngân hàng.
* **NH:** Mã ngân hàng viết tắt (VCB, TCB, MB, BIDV, CTG, TPB, OCB, VPB, ACB...).
* **CTK:** Tên chủ tài khoản viết hoa không dấu.
* **Momo:** Số điện thoại nhận ví MoMo (tùy chọn).

### Trải nghiệm nhập liệu tại `ProfilePage.vue`:
* Thay vì chỉ nhập ô TextArea tự do như trước, mặc định giao diện hiển thị các ô nhập có cấu trúc:
  1. **Ngân hàng (Dropdown):** Danh sách các ngân hàng hỗ trợ tại Việt Nam (có mã BIN tương ứng).
  2. **Số tài khoản (STK):** Textfield.
  3. **Tên chủ tài khoản (CTK):** Textfield. Tự động chuyển chữ không dấu viết hoa khi nhập.
  4. **Số điện thoại MoMo:** Textfield.
* **Xem trước QR ngay lập tức:** Dưới form nhập, hệ thống sẽ hiển thị một ảnh QR xem thử (với giá trị 10.000 đ và nội dung "TEST QR") để chủ tài khoản quét thử ngay tại chỗ để kiểm tra xem cấu hình tài khoản đã đúng chưa trước khi lưu.
* **Nút bấm chuyển đổi:** "Nhập văn bản tự do" (cho phép tắt chế độ sinh QR động và nhập text thường nếu muốn).

---

## 2. Serverless Function Tra cứu tài khoản (`api/lookup.js`)
VietQR cung cấp API tra cứu chủ tài khoản dựa trên số tài khoản và ngân hàng. API này yêu cầu Client ID và API Key nên phải được gọi từ backend để tránh lộ key trên Client.

* **Endpoint:** `POST /api/lookup`
* **Headers:** `Authorization: Bearer <ClerkJWTToken>`
* **Body:**
  ```json
  {
    "bin": "970436", // Mã BIN ngân hàng (ví dụ: Vietcombank)
    "accountNumber": "0071001234567"
  }
  ```
* **Môi trường Serverless:**
  * Biến môi trường: `VIETQR_API_KEY`, `VIETQR_CLIENT_ID`.
  * Trả về: `{ "accountName": "NGUYEN VAN A" }`.
  * Nếu gọi lỗi hoặc không khớp, trả về mã lỗi `400` kèm thông báo lỗi.

---

## 3. Phân tích & Tính toán Số tiền Động trên Trang đặt món
Khi người đặt xem đơn hàng của mình trên `MenuPage.vue`:

1. **Hàm Parse thông tin (`parsePaymentInfo`):**
   Phân tích cột `payment_info` của người đăng menu (chủ đơn) từ định dạng cấu trúc trên để trích xuất ra các biến: `bankId`, `accountNumber`, `accountName`, `momoPhone`.
2. **Hàm tính số tiền đề xuất (`amount`):**
   * Đọc danh sách món ăn từ đơn hàng của người dùng: `order.item_text` (tách dòng bằng `\n`).
   * Tìm kiếm trong danh sách món ăn của thực đơn `menu.note` (dạng JSON đã có cấu trúc).
   * Lấy giá tiền `price` của từng món ăn và cộng dồn lại $\rightarrow$ Tổng số tiền đơn hàng.
   * Nếu thực đơn không cấu trúc hoặc tổng tiền bằng 0, số tiền đề xuất mặc định là rỗng để người dùng tự nhập.
3. **Tạo nội dung chuyển khoản động (`memo`):**
   * Định dạng không dấu để đảm bảo tương thích tốt nhất với tất cả ngân hàng:
     `[Ten_Chu_Don_Khong_Dau] com [Ngay_Thang]`
     *Ví dụ:* `Minh Nhat com 28/06` (giới hạn dưới 25 ký tự để tránh lỗi tràn bộ nhớ QR hoặc cắt chuỗi ở các app ngân hàng).

---

## 4. Modal Quét QR Thanh toán (`PaymentQRModal.vue`)
Thành phần Modal mới hiển thị khi bấm vào nút `🔗 Thanh toán QR` trên dòng đơn hàng của người dùng:

1. **Thông tin Số tiền:** Ô nhập số tiền hiển thị số tiền tính được ở Bước 3, cho phép người dùng thay đổi nếu muốn chuyển số tiền khác.
2. **Giao diện Tab:**
   * **Tab VietQR (Mặc định):**
     * Hiển thị ảnh QR động được tạo từ API:
       `https://img.vietqr.io/image/${bankId}-${accountNumber}-compact2.png?amount=${amount}&addInfo=${memo}&accountName=${accountName}`
     * Hiển thị thông tin chuyển khoản dạng văn bản để copy nhanh (Ngân hàng, Số tài khoản, Chủ tài khoản, Số tiền, Nội dung).
   * **Tab MoMo:**
     * Hiển thị QR MoMo động tạo từ payload ví:
       `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=2|99|${momoPhone}|${accountName}||0|0|${amount}|${memo}|transfer_mywallet`
     * Có nút "Mở ví MoMo" trỏ trực tiếp đến `https://nhantien.momo.vn/${momoPhone}/${amount}`.
3. **Xác nhận:** "Tôi đã chuyển khoản thành công" -> khi bấm sẽ gọi `handleToggle(order, true)` để đổi trạng thái đơn hàng thành Đã trả và đóng modal.

---

## Kế hoạch Kiểm thử
1. **Kiểm thử Hồ sơ:**
   * Mở trang hồ sơ, nhập thông tin tài khoản, kiểm tra xem QR Preview có hiển thị đúng ảnh và quét được bằng app Ngân hàng không.
   * Bấm lưu hồ sơ, kiểm tra dữ liệu lưu vào database có đúng định dạng cấu trúc không.
2. **Kiểm thử Trích xuất & Tính tiền:**
   * Đặt món trên thực đơn có cấu trúc. Nhấn `Thanh toán QR` và kiểm tra số tiền tính được có chính xác tổng tiền của các món đã chọn hay không.
3. **Kiểm thử Modal QR:**
   * Nhập thay đổi số tiền trong modal, kiểm tra xem ảnh QR Code VietQR và MoMo có thay đổi động theo hay không.
   * Nhấn nút xác nhận đã chuyển, kiểm tra xem trạng thái đơn hàng trên cơ sở dữ liệu có cập nhật sang Đã trả thành công hay không.

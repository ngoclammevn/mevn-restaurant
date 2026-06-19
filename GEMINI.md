# GEMINI.md

> Dành cho Antigravity / Gemini agents (chủ yếu lo UI/UX).

Tài liệu chính thức của dự án nằm ở **[`AGENTS.md`](./AGENTS.md)** — đọc file đó trước khi làm UI.

Spec nghiệp vụ sâu (data model, RLS, luồng màn hình, query): `docs/superpowers/specs/2026-06-19-lunch-order-tracker-design.md`.

## Bạn được tự do quyết (UI/UX)
Layout, navigation, component, visual design, màu, typography, thư viện UI, state management.

## Bạn KHÔNG được mâu thuẫn (hợp đồng hành vi — xem chi tiết trong AGENTS.md)
- Đặt món = text tự do; thanh toán = boolean self-tick.
- **CHỈ chủ đơn** đổi được `is_paid` — KHÔNG có nút "đánh dấu đã trả hộ" cho người thu tiền.
- Ai cũng đăng được menu; người đăng = người thu tiền; thông tin chuyển khoản ở profile người đăng.
- "Hôm nay" theo giờ VN (UTC+7).
- **Không** thêm backend, **không** đưa secret key vào frontend (chỉ publishable key). Bảo mật bằng RLS.

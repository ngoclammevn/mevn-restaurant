# Tài liệu Cơm Trưa

Điểm bắt đầu cho phiên bản quán, món ăn và gợi ý đánh giá ngày 03/10/2026. Tài liệu mô tả mã và migration trong repository; **không xác nhận cấu hình hoặc migration đã chạy trên production**.

## Tài liệu hiện hành

| Cần tìm | Nguồn chính |
| --- | --- |
| Phạm vi, hành vi đã chốt, quy tắc đóng góp | [AGENTS.md](../AGENTS.md) và [thiết kế đã duyệt](superpowers/specs/2026-10-03-main-ui-ux-restaurants-feedback-ai-design.md) |
| Sơ đồ hệ thống, ranh giới tin cậy, luồng token | [Kiến trúc](architecture/README.md) |
| Bảng, quan hệ, snapshot, RLS và giao dịch | [Mô hình dữ liệu](architecture/data-model.md), đối chiếu [migrations](../supabase/migrations/) |
| Giao tiếp Vue → Supabase / AI Worker | [API và luồng dữ liệu](architecture/api.md) |
| Setup Clerk/Supabase, deploy Vue và Worker riêng | [Setup và triển khai](architecture/deployment.md) |
| Chính sách bảo mật, mối đe dọa và cách kiểm chứng | [Bảo mật](security/README.md) |
| Lệnh và cấu hình riêng của Worker | [ai-worker/README.md](../ai-worker/README.md) |
| Adapt toàn bộ UI ngày 05/10/2026 | [Kế hoạch triển khai](superpowers/plans/2026-10-05-ui-adaptation-plan.md), [coverage bản mẫu](prototypes/2026-10-05-ui-preview/UI-COVERAGE.md), [thiết kế quản lý](prototypes/2026-10-05-ui-preview/MANAGEMENT-DESIGN.md) |
| Bằng chứng kiểm tra và ảnh UI bằng dữ liệu giả | [Review ngày 04/10/2026](review/2026-10-04-verification.md) |

Khi mô tả và code khác nhau, kiểm tra code cùng toàn bộ chuỗi migration, ghi nhận chênh lệch rồi sửa tài liệu. Không suy ra trạng thái database đang chạy từ tên file migration.

## Tài liệu lịch sử

- [SETUP.md](SETUP.md), [DEPLOY.md](DEPLOY.md) và [frontend-api.md](domain/frontend-api.md) được viết cho phiên bản cũ. **Không dùng các bước SQL, cấu hình JWT template hoặc giả định production trong các file đó làm hướng dẫn hiện hành.** Hướng dẫn mới ở trên dùng native Clerk third-party auth và cho phép đặt hộ có chủ đích.
- [Specs](superpowers/specs/) giữ quyết định và bối cảnh từng thời điểm. Spec ngày 19/06 mô tả ba bảng ban đầu, trước khi có catalog và Worker AI.
- [Plans](superpowers/plans/) là kế hoạch thực hiện, không phải bằng chứng kiểm thử hay deploy thành công.

Giữ các tài liệu cũ để tra cứu; không di chuyển hay xóa lịch sử khi cập nhật hệ thống.

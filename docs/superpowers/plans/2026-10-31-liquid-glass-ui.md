# Liquid Glass UI Implementation Plan

> For agentic workers: dùng subagent-driven-development; triển khai trực tiếp trong app, không làm prototype riêng.

**Goal:** Đồng bộ app đặt cơm theo Apple UI, dùng Liquid Glass cho navigation/controls và nền nội dung rõ, thao tác trực tiếp.
**Architecture:** Giữ Vue/Vite, composables và API hiện tại. Tái sử dụng @zakisheriff/liquid-glass qua adapter React nhỏ cho component độc lập; nội dung nghiệp vụ tiếp tục thuộc Vue. Components không dùng kính vẫn theo Apple: system font, grouped surfaces, inset lists, heading và spacing thống nhất.
**Tech Stack:** Vue, CSS tokens, React/React DOM adapter, @zakisheriff/liquid-glass phiên bản kiểm từ registry.
**Spec:** Yêu cầu user trong chat ngày31/10: bỏ mẫu cũ, lên kế hoạch và triển khai ngay; nền trắng/xanh, dễ đọc, không giấu thao tác chính trong dropdown; tất cả component đồng bộ Apple.

## Global Constraints

- Không prototype mới, không đổi Schema/Migration/RLS/business rules, không gửi Slack test.
- Giữ main hiện tại250ec80, không mất thống kê/khoản cũ/Excel/avatar/skeleton.
- Chỉ owner tự tick/untick paid, kể cả sau chốt/lưu trữ. Sponsored không nợ, thiếu giá không thành0.
- Phone lưu một lần, consent theo ngày và tự đăng ký; giữ guard đổi tài khoản/lỗi mạng.
- Nội dung16px, chữ phụ>=14px, controls>=44px (ưu tiên48). System font Apple trên macOS/iOS.
- Kính ở thanh navigation, segmented/switch/button phù hợp; không phủ kính lên mọi hàng món/bảng. Nền nội dung sáng, grouped card bo góc, heading24–30, section20–22, số tiền18–22.
- Mobile bottom nav có icon+nhãn, safe areas; sheet hoặc dialog rõ, nội dung không nằm sau controls. Desktop toolbar gọn, workspace quản lý đọc được dữ liệu.
- Giữ câu tiếng Việt tự nhiên, thao tác chính hiện trực tiếp; hạn chế accordion cho lịch sử/giải thích dài.
- Tôn trọng reduced motion/transparency, contrast; Safari có fallback đúng thư viện. Không hứa refraction giống Chrome.

## Layout theo màn

- Hôm nay: tiêu đề/ngày gọn, đơn của mình có payment/edit trực tiếp; menu theo card Apple với ảnh, quán, trạng thái và Chọn món.
- Menu: header quán/ngày/trạng thái, ảnh mở trực tiếp; danh sách món gọn (desktop2cột/mobile1), tên/giá/nút chọn rõ. Vùng đơn đang chọn không chiếm sidebar rỗng; ghi chú/xem lại liền thao tác. Công cụ người đăng nằm vùng riêng hoặc link Quản lý.
- Đơn của tôi: lịch xanh paid/được mời, đỏ có unpaid, neutral noorder; ký hiệu/legend. Thẻ đơn có payment/edit/review trực tiếp.
- Quản lý: tab công việc rõ, ngày/menu hiện sẵn; Đặt hộ/Chốt/Xuất rõ. Giữ Thu tiền mọi ngày và archive/statistics. Cấu hình Slack/nhận cơm mở trực tiếp trong vùng có tên.
- Đăng menu: grouped form Quán/ngày, Nội dung/bảng món, Thanh toán/nhắc, Preview. Không dãy label lặp quá dài, filename không tràn.
- Cá nhân/catalog/history/dashboard/dialogs: font/card/field/status đồng bộ, không để component con giữ chữ12px.

## Task1 — Thư viện và adapter (agent foundation)
- [x] Kiểm package source/API/license, cài pin dependency; không migrate React toàn app.
- [x] Tạo adapter Vue cho GlassNav và GlassSegmented/GlassSwitch nếu dùng; lifecycle clean, controlled props/callback, icon/label/aria.
- [x] AppNavigation dùng GlassNav thật, giữ routes/active links và keyboard semantics. Bổ sung xuất component adapter từ barrel nếu cần.
- [x] Chỉ owns package.json/package-lock.json, components/ui/liquid/*, AppNavigation.vue, lib/navigation.js; không global CSS/AppButton.
- [x] Kiểm lifecycle/route callbacks bằng test nhỏ nếu cần; compile/Build parent tích hợp.

## Task2 — Shared components (agent shared)
- [x] Đồng bộ OrderCard/PaidToggle/PaidStamp và AppDialog; payment/edit không details; status xanh/đỏ+chữ.
- [x] MenuCoordination/MenuReminderField/MenuPickupPanel/SponsorshipField mở trường/action chính; 16/14px, Apple grouped forms.
- [x] Rà typography shared ManageDishTable/ManagePayments/OutstandingLedger/OrderSummaryPanel/FormErrorSummary. Không đổi handlers/Query.
- [x] Chỉ sửa các component nêu trên; không tokens/AppButton/AppNavigation/pages.

## Task3 — Pages (agent pages)
- [x] Today/Post/Manage/History/Profile/Catalog/Dashboard/Taste: sắp xếp theo layout trên, Apple grouped surfaces/readability, controls trực tiếp. Không mất data/filter/disabled guards.
- [x] Giữ logic History dayPayments draft có ích. Không reset dữ liệu.
- [x] Chỉ owns src/pages/*.vue (trừ MenuPage parent), FileUpload.vue. Không shared/global/package.

## Task4 — Parent foundation vis/design và menu
- [x] Viết tokens Apple thống nhất, bỏ theme override chồng; AppButton dùng hình thức Apple tương thích library CSS, App shell/safe-area/card/fields rõ.
- [x] MenuPage/MenuBoard: danh sách gọn, header/ảnh/action rõ, chọn/xem lại/note, giữ edit mode MenuBoard.
- [x] Tích hợp adapter/style; kiểm UI thật bằng Playwright độc lập trên Chromium/WebKit; desktop1440/tablet768/mobile320–390, không prototype riêng. Mock API chỉ dùng fixture actual components nếu cần auth.
- [x] Build và tests ảnh hưởng UI/bridge/finance, không chạy DB/Worker lại cho CSS. Review tĩnh độc lập, sửa lỗi quan trọng.
- [x] Cập nhật changelog01/11, báo cáo ngắn; GitNexus detect_changes trước Commit. Chỉ tạo PR UI mới và Deploy test-rest khi đã verify; không tự Merge/Deploy company Production.

## Kiểm chứng và bàn giao

Kết quả, lựa chọn component và giới hạn kiểm tra: [Báo cáo rà soát UI](../../review/2026-11-01-ui-final-audit.md). PR và Deploy test là bước bàn giao sau Commit; company Production giữ nguyên.

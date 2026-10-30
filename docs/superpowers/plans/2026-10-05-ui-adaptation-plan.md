# Lunch UI Adaptation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adapt toàn bộ UI đã duyệt vào app Vue cho người đặt và người đăng; bao phủ mọi route, dialog và trạng thái, nối dữ liệu thật và giữ nguyên quy tắc đặt món, thu tiền, đánh giá.

**Architecture:** Giữ các page, composable và RPC hiện có; bổ sung shell điều hướng, hộp thoại dùng chung và một kết nối presence ở App. Các page lấy dữ liệu thật qua Supabase/RLS hiện có. Không đưa script hoặc dữ liệu mô phỏng của prototype vào app.

**Tech Stack:** Vue 3, Vite, Vue Router, Clerk, Supabase, CSS tokens; không thêm thư viện UI hoặc backend.

**Spec:** `docs/prototypes/2026-10-05-ui-preview/UI-COVERAGE.md`, `docs/prototypes/2026-10-05-ui-preview/MANAGEMENT-DESIGN.md`; bản xem trước cùng thư mục; quyết định mới nhất của người dùng: thiết kế lại nav, giảm màu, bỏ “Dùng menu cũ” ở trang đăng, dùng câu chữ ngắn và tự nhiên. Tài liệu business: `AGENTS.md`, `docs/superpowers/specs/2026-06-19-lunch-order-tracker-design.md`, `docs/superpowers/specs/2026-10-03-main-ui-ux-restaurants-feedback-ai-design.md`.

## Global Constraints

- Đây là **kế hoạch để duyệt**. Việc lập kế hoạch không sửa `src/`, database, Worker hoặc deployment.
- **Điện thoại và máy tính đều quan trọng.** Kiểm tra desktop và mobile 375/390px.
- **Trang chung + món đang chọn; trang cá nhân chỉ hiện online.** Lọc nội dung trước khi gửi presence, không chỉ ẩn trong float.
- Chỉ dùng xanh `#1f6e45` cho CTA chính và trạng thái chọn có ý nghĩa; nền trắng ấm `#fafaf8`, chữ và đường viền trung tính. Nav dùng gạch dưới; không tô xanh cả tab/thẻ/khối.
- Desktop: Hôm nay, Lịch cơm, Quản lý; Đăng menu là action header. Mobile: Hôm nay, Lịch cơm, Quản lý, Cá nhân. Không có tab Quán ăn. Quán được chọn/tạo bởi người đăng trong Post; người đặt xem tên quán và đánh giá món trên Menu. Cập nhật ở header, không có changelog float.
- **Bỏ lựa chọn Dùng menu cũ trong `/post`**. Giữ thao tác dùng lại từ Quản lý và đường dẫn `/post?reuse=...`; không xóa chức năng nằm ngoài yêu cầu này.
- Menu có cấu trúc bắt buộc chọn món; menu chữ cho nhập tự do. Giá thiếu là `null`, không tự đổi thành 0. Ghi chú luôn nhập tự do.
- Chỉ chủ đơn đổi `is_paid` và đánh giá. Đơn đặt hộ thuộc người nhận; người đăng/thu tiền chỉ xem thanh toán của người khác. Ai đăng nhập cũng có thể đăng menu.
- “Hôm nay” theo Việt Nam UTC+7; giữ nhiều menu/ngày, Clerk string ID, `auth.jwt()->>'sub'`, client provisioning profile và RLS hiện có.
- Không secret/service-role trong client; không chỉnh schema/RLS/RPC hoặc thêm backend cho đợt UI này. Insight/cron AI là hạng mục riêng, không bật hoặc migrate trong đợt adapt. Màn Khẩu vị dùng thống kê quan sát từ đơn/đánh giá thật ở Task6 trước khi có insight nền.
- Không chạy GitNexus. Trước sửa pattern dùng chung chạy `rtk rg -n` tìm toàn bộ nơi dùng trong `src/` rồi cập nhật đồng bộ.
- Ghép đủ UI và luồng trước, sau đó kiểm tra tổng hợp một đợt. Không TDD, không chạy test sau từng chỉnh sửa, không tạo test chỉ để kiểm CSS hoặc lặp lại implementation.
- Giữ nguyên thay đổi local đang có. Worktree đang dùng: `/Users/nhatminh/.codex/worktrees/lunch-ui-ux-review/mevn-restaurant`, nhánh `codex/lunch-experience-ai`, dựa trên main. Không reset checkout gốc nhánh `nhat`, không tạo lại worktree, không commit/push/deploy khi chưa đến bước được phép.

---

## Phạm vi toàn bộ và thứ tự triển khai

Lập kế hoạch ngày 05/10/2026. Không phải bằng chứng app đã được adapt hoặc deploy. Đọc UI-COVERAGE và MANAGEMENT-DESIGN trước khi thực hiện; yêu cầu mới nhất của người dùng ưu tiên hơn bố cục/copy còn cũ trong prototype.

| Gói | Công việc | Phụ thuộc | Kết quả review |
| --- | --- | --- | --- |
| 1 — Nền chung | Task1: tokens, nav, dialog, form errors, Cập nhật | Diff hiện tại và business contract | Toàn app dùng một shell; không tab Quán ăn |
| 2 — Người đặt | Task2: Hôm nay, Menu, feedback theo món/quán, xác nhận | Gói1 | Đặt món, đặt hộ, đọc đánh giá và giữ nháp qua lỗi |
| 3 — Người đăng | Task3: Post, chỉnh món, suất/paid, ledger, archive | Gói1; API đơn hiện có | Quản lý số suất hằng ngày tách khoản cũ |
| 4 — Hoàn thiện toàn app | Task4 realtime; Task5 lịch, cá nhân, review, payment, changelog | Gói1; nối dữ liệu của Gói2/3 | Mọi trang/dialog cùng hệ thống UI và privacy |
| 5 — Khẩu vị | Task6: thống kê đơn/đánh giá thật; tích hợp insight nền khi sẵn sàng | Shell/Review; schema hiện có | Bao phủ màn Khẩu vị, không có biểu đồ giả |
| 6 — Kiểm tra và review | Task7 sau khi ghép đủ Task1–6 | UI đã hoàn thiện | Build/unit/browser evidence, diff, changelog |

Khi được yêu cầu triển khai, có thể giao người đặt, người đăng, các trang riêng cho agent độc lập sau Gói1; agent realtime sở hữu App/presence và phối hợp page hooks. Một người tích hợp App/router/tokens/UI index để tránh đè file. Không chạy test từng agent; ghép đủ UI rồi kiểm tra cuối theo Task7. Bước hiện tại chỉ ghi kế hoạch.

### Bản đồ route và điểm vào

| Route/điểm vào | Trình bày sau adapt | Dữ liệu/quyền |
| --- | --- | --- |
| `/` | Hôm nay: đơn của mình, các menu ngày VN | listMenusByDate; nhiều menu/ngày |
| `/menu/:id`, `/share/:id` | Chọn món, feedback đúng quán, xem lại, đặt hộ | getMenu/createOrder/updateOrder; giữ shared link và sign-in |
| `/post` | Chọn/tạo quán → ảnh/chữ/danh sách → chỉnh → xem lại → đăng | upload/OCR/createMenu; không có bộ chọn menu cũ |
| `/manage` | Hôm nay / Tiền chưa thu / Menu đã đăng | menus của poster; paid chỉ xem, không tick hộ |
| `/dashboard` | Alias mở Tiền chưa thu | Dùng ManagePage, giữ query menu_id |
| `/my-menus` | Alias mở Menu đã đăng | Dùng ManagePage; mở/chốt/dùng lại/chia sẻ/CSV |
| `/history` | Lịch tháng + panel ngày và các đơn | listMyOrders, ngày VN; số đơn trong ngày không bị gom mất |
| `/profile` | Tên, chuyển khoản, MoMo, liên kết của tôi | Profile hiện có; chỉ user sửa chính mình |
| `/catalog` | Đường dẫn legacy còn hoạt động, không có trong nav | Không dựng thêm khu dành cho quán; điểm tạo quán ở Post |
| `/sign-in`, SignInModal | Đăng nhập và quay lại hành động trước đó | Clerk hiện có; không xóa draft |
| Cập nhật | Mới nhất và lịch sử trong dialog | src/changelog.json; trạng thái đã xem tại máy |
| `/taste` ở Task6 | Khẩu vị của tôi, mở từ Cá nhân/Lịch cơm | Thống kê quan sát từ đơn/review thật; insight chỉ nối khi dữ liệu nền sẵn sàng; không thêm tab nav |
| URL không hợp lệ/menu không tồn tại | Không tìm thấy + về Hôm nay | Không redirect vòng lặp, không hiện dữ liệu menu trước đó |

### Nguyên tắc tích hợp và trạng thái

- Dùng Vue components/tokens; không chép inline onclick, globals hoặc dữ liệu demo từ HTML. Menu quán, người đặt, nhận tiền, sao và số đơn đều đọc nguồn thật.
- Mỗi page có loading ban đầu, empty đúng ngữ cảnh, error + Thử lại và success. Refresh nền giữ nội dung đã tải kèm trạng thái đang cập nhật; không thay bằng màn trống hoặc reset form. Save thất bại giữ nháp; disable đúng action đang chạy để tránh submit đôi.
- Dialog/selection/form nhạy cảm không dùng optimistic success. Kết quả trả muộn sau đổi user/menu không áp vào màn mới; dùng account/menu request key và Abort nếu API hỗ trợ.
- Khi route đổi, focus về tiêu đề trang; dialog focus tiêu đề/field phù hợp, Escape/close trả về nút mở. Nếu có thay đổi chưa lưu, dùng cơ chế confirm thống nhất, không chồng nhiều modal scroll-lock.
- Date/date filters dùng helpers giờ VN đang có, không parse ngày bằng timezone host. Structured có menu item ID là nguồn chính; legacy không có ID vẫn đọc được qua tên khớp chính xác.
- Font dùng hệ thống đã chọn và fallback hệ thống; không thêm thư viện/remote font chỉ để giống ảnh. Nội dung dài, tên quán/người/món, 0 đơn, nhiều menu và nhiều tháng không overflow ở 375/390px.

## Đối chiếu code và giới hạn bản mẫu

- Không có tab Quán ăn ở nav. Quán được người đăng chọn/tạo trong RestaurantPicker; người đặt chỉ thấy tên quán và đánh giá từng món trên menu. Giữ route/catalog dữ liệu cũ để tương thích nhưng không làm một khu quản trị quán mới.
- Routing thật ở `src/router.js`; không có `src/router/index.js`. `/my-menus` và `/dashboard` là wrapper của `ManagePage.vue`, giữ cách dùng chung này.
- `App.vue` hiện có nav, auth/profile và `changelog-fab`; chuyển vị trí, không làm lại auth.
- `AppButton.vue` mặc định `variant="primary"`; kiểm tra tất cả nơi dùng để CTA phụ chuyển `ghost`, giữ API component.
- `MenuPage.vue` đã giữ nháp theo tài khoản/menu, có chọn người nhận, account guards và nút tiếp tục. Có `selectedDishes`, `total`, `submit()`, `load()`; không thay bằng logic giỏ prototype.
- `PostMenuPage.vue` đã upload, OCR, giữ nháp, liên kết món/quán, dùng lại qua query; hiện **chưa có bước dialog xem lại**. Giá có thể để trống. Chỉ bỏ bộ chọn menu cũ trên trang.
- Trường giờ chốt trong prototype **chưa có trong API `createMenu()`/RPC `save_lunch_menu` của main**. Main dùng `is_closed` để chốt thủ công; DB hiện tại có compatibility với deadline cũ. UI adapt không tạo field hoạt động giả hoặc đổi RPC: giữ chốt thủ công; hạng mục giờ chốt tự động tách khỏi UI này.
- `usePresence.js` hiện là channel theo menu, có guest alias và log payload; chưa nối vào `MenuPage.vue` hiện tại. Global presence cần một composable dùng chung ở App, tránh tạo channel mới ở mỗi trang.
- Khẩu vị trong prototype là dữ liệu giả; chưa có route/reader insight production. Task6 dựng trang từ order_items/review hiện có của chính user. Chỉ gọi là món thường chọn/món đánh giá tốt/cảm nhận thường chọn; diễn giải dài hạn và recommendation từ AI chờ dữ liệu insight riêng, không copy kết luận mẫu.
- Payment dùng `OrderCard.vue` → `PaymentQRModal.vue`; review dùng `ReviewDialog.vue`. Cập nhật bố cục, giữ callback và quyền sở hữu.

## File boundaries

Các đường dẫn sau tính từ worktree nói trên; executor đọc diff local trước khi sửa.

| Trách nhiệm | File hiện có | File mới |
| --- | --- | --- |
| Shell, nav, màu, cập nhật | `src/App.vue`, `src/router.js`, `src/styles/tokens.css`, `src/components/ui/AppButton.vue`, `src/components/ui/AppIcon.vue`, `src/components/ui/ChangelogModal.vue` | `src/components/AppNavigation.vue`, `src/lib/navigation.js` |
| Dialog và form errors | `src/components/ui/index.js`, `src/components/ui/SignInModal.vue` | `src/components/ui/AppDialog.vue`, `src/components/ui/FormErrorSummary.vue` |
| Đặt món & đánh giá ngay menu | `src/pages/TodayPage.vue`, `src/pages/MenuPage.vue`, `src/components/ui/MenuBoard.vue`, `src/components/OrderCard.vue`, `src/composables/useReviews.js` | `src/components/OrderConfirmDialog.vue`, `src/components/DishFeedbackDialog.vue` |
| Đăng/sửa/quản lý | `src/pages/PostMenuPage.vue`, `src/components/RestaurantPicker.vue`, `src/components/MenuEditor.vue`, `src/pages/ManagePage.vue`, `src/pages/MyMenusPage.vue`, `src/pages/DashboardPage.vue` | `src/components/PostMenuPreviewDialog.vue`, `src/components/ManageDishTable.vue`, `src/components/ManagePayments.vue`, `src/components/OutstandingLedger.vue`, `src/components/OrderOnBehalfDialog.vue`, `src/lib/manage-summary.js` |
| Presence toàn app | `src/App.vue`, `src/pages/MenuPage.vue`, `src/pages/TodayPage.vue`, `src/components/ui/MenuBoard.vue`; tham khảo `src/composables/usePresence.js` | `src/lib/presence.js`, `src/composables/useAppPresence.js`, `src/components/PresenceFloat.vue` |
| Các trang riêng và dialog | `src/pages/ProfilePage.vue`, `src/pages/HistoryPage.vue`, `src/pages/CatalogPage.vue`, `src/pages/SignInPage.vue`, `src/components/ReviewDialog.vue`, `src/components/ui/PaymentQRModal.vue`, `src/components/ui/PaidToggle.vue`, `src/components/ui/PaidStamp.vue` | Không tách page mới |
| Khẩu vị quan sát | `src/router.js`, `src/pages/ProfilePage.vue`, `src/pages/HistoryPage.vue`, `src/composables/useOrders.js` | `src/pages/TastePage.vue`, `src/components/TasteSummaryChart.vue`, `src/lib/taste-summary.js` |
| Kiểm tra và tài liệu | `tests/unit/lunch-helpers.test.js`, `tests/unit/menu-account-guard.test.js`, `src/changelog.json`, `docs/prototypes/2026-10-05-ui-preview/UI-COVERAGE.md` | `tests/unit/app-presence-privacy.test.js`, `tests/unit/manage-summary.test.js`, `tests/unit/taste-summary.test.js`, `docs/review/2026-10-05-ui-adaptation-verification.md` |

### Task 1: Shell và nền UI chung

**Files:** Shell/nav/tokens/dialog/form errors trong bảng file boundaries.

**Interfaces:**
- `AppNavigation.vue`: props `{ surface: 'desktop' | 'mobile', path: string }`; render `RouterLink`, không tự quản lý auth.
- `navigation.js`: `desktopLinks`, `mobileLinks`, `isNavActive(targetPath, currentPath)`; `/my-menus`, `/dashboard` active ở Quản lý.
- `AppDialog.vue`: props `{ open: boolean, title: string }`, emit `close`; default slot và footer slot; native `<dialog>` đảm nhiệm focus/Escape, trả focus khi đóng.
- `FormErrorSummary.vue`: props `{ errors: Array<{ fieldId:string, message:string }> }`; `focus()` được expose; mỗi lỗi là link/handler focus đúng field.

- [ ] Đọc diff local; tìm toàn bộ `nav-link`, `changelog-fab`, `AppButton`, `modal-overlay`, `btn--` trước sửa. Danh sách kết quả là phạm vi cập nhật, không chỉ App.vue.
- [ ] Giữ header/auth/profile upsert; tách hai bộ nav dùng config chung. Thay changelog float bằng nút “Cập nhật” ở header; nhãn aria có ngày mới nhất, đánh dấu đã xem chỉ ở localStorage theo phiên bản/ngày.
- [ ] Đổi nav active thành chữ đậm + underline trung tính. Giảm các badge/rating-card/selected tabs về border/chữ; CTA xác nhận và selected checkbox có xanh. Ví dụ tokens:

```css
:root { --bg: #fafaf8; --surface: #fff; --ink: #292c27; --line: #dedfd9; --primary: #1f6e45; }
.nav-link[aria-current="page"] { color: var(--ink); border-bottom: 2px solid currentColor; background: transparent; }
```

- [ ] Thêm AppDialog/FormErrorSummary, export ở UI index; giữ nút/field >=44px, safe-area và scroll-padding cho nav/sticky selection/float. Không làm màu hoặc chuyển động trở thành điều kiện nhận biết trạng thái.
- [ ] Giữ font body/input >=16px trên mobile để tránh zoom khi nhập; text trợ giúp >=12px. Dùng câu cụ thể: “Đăng menu”, “Chọn món”, “Lịch cơm”, “Quán”, “Cá nhân”, “Chưa có đơn”, “Thử lại”. Không thêm slogan, lời quảng cáo hoặc nhãn provider AI trong UI.

**Deliverable:** Mọi route nằm trong cùng shell; changelog không chiếm float; dialog/validation có một cách dùng.

### Task 2: Đặt món, Hôm nay và xác nhận đơn

**Files:** `src/pages/TodayPage.vue`, `src/pages/MenuPage.vue`, `src/components/ui/MenuBoard.vue`, `src/components/OrderCard.vue`, `src/composables/useReviews.js`; create `src/components/OrderConfirmDialog.vue`, `src/components/DishFeedbackDialog.vue`.

**Interfaces:**
- `OrderConfirmDialog.vue`: props `{ open, menu, dishes, itemText, note, recipientName, total:number|null, busy }`, emit `close`/`confirm`; chỉ trình bày dữ liệu, không gọi Supabase.
- `DishFeedbackDialog.vue`: props `{ open, dish, restaurant, stats, reviews, loading, error }`, emit `close`/`retry`; không đặt sao hoặc ghi review thay người dùng.
- `useCatalog().listDishes(restaurantId)` đã có, trả batch từ view `restaurant_dish_stats` với `id`, `restaurant_id`, `average_rating`, `rating_count`, `reviewer_count`. `useReviews().listRestaurantReviews(restaurantId)` đã có, trả tối đa30 phản hồi gần đây từ `restaurant_feedback`, có `restaurant_dish_id`, `restaurant_id`, `rating`, `labels`, `note`.
- Bổ sung `useReviews().listDishReviews(restaurantId, restaurantDishId, { limit = 20 } = {})` chỉ khi người dùng mở chi tiết, query view hiện có với **cả hai ID**, trả `{data,error}`. Không query từng món trong vòng render.
- Giữ `createOrder`, `updateOrder`, `togglePaid` từ `useOrders.js`; không đổi payload sở hữu hoặc thêm tự tick đã trả sau đặt.

- [ ] Today trình bày đơn của mình trước, menu theo quán sau; giữ lỗi tải và thử lại, nhiều menu/ngày, menu không ảnh. Bỏ copy kiểu “Trưa nay ăn gì?” lặp trên mọi trang: title “Hôm nay”, card dùng tên quán.
- [ ] Menu dùng danh sách món rõ tên/giá/tình trạng, nút chọn 44px; plain text giữ ô nhập. Hết món/đã chốt chặn thêm đúng business; đang sửa đơn vẫn giữ kiểm tra chủ đơn.
- [ ] Theo yêu cầu mới, dưới từng món hiển thị điểm trung bình + số lượt tại **đúng quán**, tối đa2 nhãn từ phản hồi gần đây, nút xem chi tiết. Dùng `restaurant_dish_id` liên kết canonical; không gộp theo tên món. Món chưa được liên kết không suy đoán ID bằng tên. Cùng “Cá kho tộ” ở hai quán hiển thị hai nhóm riêng.
- [ ] Nếu không có restaurant_id, bỏ query stats/feedback; hiển thị Chưa ghi nhận quán. Review dialog vẫn giữ eligibility hiện có, không suy đoán canonical bằng tên.
- [ ] Khi tải menu, chạy một batch `listDishes(restaurant_id)` (MenuPage đang dùng) và một batch `listRestaurantReviews(restaurant_id)`; dựng Map theo `${restaurant_id}:${restaurant_dish_id}`. Điểm/số lượt lấy view stats; nhãn lấy pool tối đa30 review và ghi “Phản hồi gần đây”, không giả là thống kê toàn bộ. Không có label phù hợp thì bỏ hàng tags. Không có rating hiển thị “Chưa có đánh giá”; guest hiển thị “Đăng nhập để xem đánh giá” vì views hiện chỉ grant authenticated.
- [ ] Điểm và số lượt tổng lấy view stats. Phân bố sao/tags trong chi tiết chỉ tính trên reviews đã tải, ghi “Phản hồi gần đây”; không dùng 20 bản ghi để giả biểu đồ toàn bộ khi rating_count lớn hơn. Query chi tiết sắp updated_at/id ổn định, limit <=50; bỏ kết quả cũ nếu user chọn món khác.
- [ ] Bấm nút chi tiết mở DishFeedbackDialog và tải phản hồi của đúng pair ID; loading/error/retry độc lập, không ảnh hưởng chọn món. Tách nút feedback khỏi nút chọn, chặn propagation nếu row đang toggle. Menu đã chốt hoặc món hết vẫn xem được rating; chỉ action đặt bị khóa. Không dùng điểm của nhóm để điền sao trong ReviewDialog.
- [ ] Nút tiếp tục dẫn tới xác nhận có quán/ngày/món/ghi chú/người nhận. Giữ `submit()` làm bước ghi dữ liệu sau confirm; chỉ thêm handler `reviewOrder()` mở dialog:

```js
const showOrderConfirm = ref(false)
function reviewOrder() {
  if (!user.value) { showSignIn.value = true; return }
  if (!canSave.value || menu.value?.is_closed || busy.value) return
  showOrderConfirm.value = true
}
// OrderConfirmDialog @confirm="submit"; đóng sau success, giữ mở + lỗi khi save thất bại.
```

- [ ] Không tính tổng nếu có món thiếu giá. Trong xác nhận ghi “Có món chưa có giá”; dùng nội dung thanh toán hiện có, không thay `null` bằng 0.
- [ ] Giữ guest draft qua đăng nhập, nháp theo account/menu, retry không mất chọn; người nhận đơn và người đặt hộ xuất hiện đúng tên. Thanh toán/review của đơn đặt hộ hiện cho người nhận.

**Deliverable:** Luồng chọn → xem lại → đặt → tự thanh toán dùng dữ liệu thật, giữ toàn bộ guard hiện có.

### Task 3: Đăng menu và các màn của người thu tiền

**Files:** `src/pages/PostMenuPage.vue`, `src/components/RestaurantPicker.vue`, `src/components/MenuEditor.vue`, `src/pages/ManagePage.vue`, `src/pages/MyMenusPage.vue`, `src/pages/DashboardPage.vue`, `src/composables/useMenus.js`, `src/composables/useOrders.js`, `src/components/ui/OrderSummaryPanel.vue`; create `src/components/PostMenuPreviewDialog.vue`, `src/components/ManageDishTable.vue`, `src/components/ManagePayments.vue`, `src/components/OutstandingLedger.vue`, `src/components/OrderOnBehalfDialog.vue`, `src/lib/manage-summary.js`.

**Interfaces:**
- `PostMenuPreviewDialog.vue`: props `{ open, restaurantName, menuDate, dishes:Array|null, note, imagePreview, posting, errors }`, emit `close`/`publish`.
- Giữ API `createMenu({title,menu_date,note,imageFile,restaurant_id})`, `updateMenu`, `setMenuClosed(id,boolean)`, `deleteMenu` và `save_lunch_menu` hiện có.
- `summarizeManagedMenu(menu)` trong manage-summary trả `{ servings, orderedDishCount, orderedDishes, paidCount, unpaidCount, knownTotal, unknownPriceCount }`; nhóm bằng menu item ID với structured, legacy free text giữ match chính xác và đưa dòng không nhận diện vào nhóm riêng. Số suất suy ra từ từng dòng/selection của đơn, không nhận giá trị counter do người thu nhập.
- Mỗi phần tử `orderedDishes` có `{ key, menuItemId:string|null, name, servings, unitPrice:number|null, knownTotal:number, unknownPriceCount:number, people:Array<{orderId,userId,name,note}> }`. `key = menu-item:<id>` cho structured và `legacy:<tên>` cho plain; không canonical-merge hai menu item khác nhau. `unknownPriceCount` đếm suất thiếu giá; `knownTotal` cộng các suất có giá, luôn kèm nhãn nếu thiếu giá.
- Export `managedOrderAmount(menu,order): number|null` để Payment/Manage/Ledger tính thống nhất từ giá menu hiện có. Một selection thiếu/không khớp giá trả null; không ghi amount vào DB. `groupOutstandingOrders(orders)` trả groups theo user_id, count, knownTotal, unknownAmountCount, oldestDate, entries; giữ riêng user cùng tên. Một đơn thiếu giá được tính một lần trong unknownAmountCount.
- Thêm `useMenus().listPostedMenus({from,to,status='all',offset=0,limit=50}={})` cho Today/archive, dùng poster_id + menu_date/status và order ổn định menu_date/created_at/id; trả `{data,error,count}`. Giữ listMyMenus cho caller cũ còn cần; không nạp toàn bộ lịch sử vào workspace Today.
- `ManageDishTable.vue`: props `{ menu, summary, busy }`, emits `add`, `edit(dish)`, `remove(dish)`, `availability(dish,boolean)`; `ManagePayments.vue`: props `{ orders, menuNote, filter }`, chỉ hiển thị trạng thái, không phát `togglePaid` hộ.
- `OutstandingLedger.vue`: props `{ orders, period, loading, error }`, emits `period-change`, `load-more`, `open-menu`; group theo `user_id`, chi tiết gồm ngày VN/menu/quán/món/số tiền. Không group theo display name.
- `OrderOnBehalfDialog.vue`: props `{ open, menu, profiles, busy }`, emits `close`, `submit({user_id,menu_item_ids,item_text,note})`; parent gọi createOrder hiện có, không sửa đơn của người khác. Loại người đã có đơn trong cùng menu khỏi lựa chọn; chọn rõ người nhận trước khi confirm.
- `useMenus().listPostedUnpaidOrders({from,to,offset=0,limit=100})` dùng orders join menus!inner, filter `menu.poster_id = user.id` và `is_paid = false`; trả `{data,error,count}` và pagination. Không dùng listMyOrders (lọc người đặt, không phải người thu) và không giới hạn ledger ở hôm nay.
- Tách bước đọc ảnh và bước publish trong page; `reviewMenu()` kiểm tra nháp/mở dialog, `publishMenu()` dùng nhánh createMenu hiện có. OCR kết quả phải qua kiểm tra, không tự đăng ngay.

- [ ] Bỏ `<details>`/select “Dùng lại menu đã đăng” trên Post; bỏ việc fetch `listMyMenus()` chỉ để nuôi selector này. Giữ `reuse(id)` và `/post?reuse=id` cho entry từ Manage; không xóa MenuEditor hoặc thao tác dùng lại ở Manage.
- [ ] Chọn quán/ngày → ảnh/nội dung chữ/danh sách → xem lại. Giữ upload, compress, OCR thực và Abort/account guards; dùng lỗi riêng cho đọc ảnh, tải ảnh và đăng để người dùng biết bước nào cần thử lại.
- [ ] Liên kết quán xuyên suốt. Quán chưa chọn hiển thị nhắc “Chọn quán để ghi nhận đánh giá”; không âm thầm đổi contract hiện có `restaurant_id=null` thành lỗi bắt buộc. MenuEditor giữ khóa quán/món khi đã có đơn.
- [ ] Validation có lỗi ở ô và tóm tắt nhận focus; structured có >=1 tên món, giá âm bị chặn, giá trống được giữ. Plain menu vẫn được đăng bằng text/ảnh theo hành vi hiện có.
- [ ] Publish chỉ khi người dùng confirm. Success có “Xem menu”, “Quản lý”, “Đăng menu khác”; giữ draft nếu thất bại, xóa draft sau success. Không đưa trường giờ chốt giả trong UI production của đợt này.
- [ ] Manage mặc định mở Hôm nay, chỉ menu do user đăng trong ngày VN. Ba workspace: Hôm nay / Tiền chưa thu / Menu đã đăng. Theo món/Theo người là cách xem bên trong menu hôm nay; lọc đã trả/chưa trả đặt ở danh sách người. `/dashboard` trỏ workspace Tiền chưa thu, `/my-menus` trỏ Menu đã đăng; vẫn dùng chung ManagePage, giữ menu_id deep link.
- [ ] Today dùng menu picker khi có nhiều menu; summary số suất/số món/tổng tiền/đã trả/chưa trả của đúng menu. Bảng món luôn hiện số suất lớn, giá, tổng dòng, trạng thái còn/hết, người đặt và ghi chú mở rộng. Không giấu Add/Edit/Sold out sau menu dài; đặt +Thêm món và Đặt hộ ngay cạnh bảng. Mobile hiển thị card cùng thông tin, không bảng cuộn ngang.
- [ ] Thêm/xóa/sửa chỉ MÓN trong menu của người đăng. Món chưa có đơn: thêm/đổi tên/giá/xóa. Món đã có order_items: khóa tên/canonical/quán, chặn xóa theo lunch_guard_menu_item hiện có; hướng dẫn Báo hết món. Giá vẫn được guard cho phép sửa: báo thay đổi sẽ ảnh hưởng số tiền đang tính của các đơn và confirm trước khi lưu. Schema hiện không có price_snapshot; không giả giá cũ bất biến hoặc tự lưu số tiền vào bảng mới. Mở lại menu chốt trước khi chỉnh hoặc đặt hộ.
- [ ] Đặt hộ dùng listProfiles/createOrder hiện có; xem lại quán/món/người nhận trước submit. Thành công tải lại phần orders và tổng số suất, không làm mất nháp menu đang sửa. Ownership là người nhận; người thu không tick paid/review hộ và không có action sửa/xóa đơn người khác. Backend còn có guard/unique chống trùng; thông báo người đã có đơn để liên hệ chính họ, không overwrite.
- [ ] Tiền chưa thu tách Hôm nay và các ngày trước, mặc định toàn bộ khoảng cũ. Group theo người với số khoản, tổng đã biết, ngày xa nhất; mở xem từng bữa/ngày/quán/món và link menu. Filter Hôm nay/30 ngày trước/Cũ hơn 30 ngày/Tất cả; 30 ngày trước loại hôm nay để hai nhóm không chồng nhau. Search tên người, sort số tiền hoặc bữa cũ nhất. Đánh dấu tuổi khoản theo menu_date, không giả có payment deadline.
- [ ] Ledger không tự xóa/hide khoản nhiều tháng, không đưa vào tổng Today, không tự tick sau thời gian. Trạng thái là self-confirm trong app, không xác minh ngân hàng. Với giá thiếu: hiển thị số tiền đã biết + số khoản chưa có giá, không tổng 0 giả. Tải đủ mọi trang cho tổng nhóm; nếu mới tải một phần, ghi số liệu theo phần đã tải và còn trang, không gọi là toàn bộ.
- [ ] Menu đã đăng riêng có search/filter ngày/trạng thái, mở một menu vào workspace. Giữ chốt/mở/CSV/copy/delete menu với confirm hậu quả; thao tác dùng lại vẫn ở đây, không đưa selector menu cũ trở lại Post. Không dùng trạng thái đã chốt để suy ra đã thu đủ.

- [ ] Quản lý giữ nội dung khi đổi bộ lọc/refresh; tổng ledger chỉ ghi toàn bộ khi tất cả trang đã tải xong. Một trang lỗi giữ phần đã tải và nút Tải tiếp/Thử lại; không hiện tổng tiền đầy đủ từ một trang đầu. Search/sort trên phần đã tải phải ghi rõ phạm vi nếu chưa đủ.
- [ ] Xóa menu dùng API hiện có sau confirm số đơn/đánh giá sẽ bị ảnh hưởng. Không xóa menu đang có đơn chưa trả từ ledger để giải quyết khoản cũ; UI điều hướng người đăng về theo dõi thanh toán. Với guard DB từ chối, giữ menu và hiện lý do; không retry bằng quyền cao hơn.

**Mẫu truy vấn ledger để triển khai trong useMenus:** kiểm lại FK alias ở migrations trước khi dùng; account guard giống composable hiện có.

```js
async function listPostedUnpaidOrders({ from, to, offset = 0, limit = 100 } = {}) {
  const uid = user.value?.id
  if (!uid) return signedOut()
  let query = sb.from('orders').select(`*,
    user:profiles!orders_user_id_fkey(id,full_name,avatar_url),
    menu:menus!inner(id,poster_id,menu_date,title,note,restaurant_id,
      restaurant:restaurants!menus_restaurant_id_fkey(id,name,branch),
      menu_items:menu_items!menu_items_menu_id_fkey(id,name,price)),
    order_items:order_items!order_items_order_id_menu_id_fkey(*)`, { count: 'exact' })
    .eq('menu.poster_id', uid).eq('is_paid', false)
  if (from) query = query.gte('menu.menu_date', from)
  if (to) query = query.lte('menu.menu_date', to)
  const result = await query.order('id', { ascending: true })
    .range(offset, offset + Math.min(limit, 100) - 1)
  return user.value?.id === uid ? result : signedOut()
}
```

Parent chuẩn hóa `order.menu` qua normalizeMenu trước summarize/amount. Tách trạng thái trả `{data,error,count}` với state load để response muộn không thay account mới. Offset pagination là hiện trạng nhẹ cho nhóm nhỏ; khi paid thay đổi trong lúc tải, bỏ batch cũ và tải lại từ đầu để tránh tổng trùng/thiếu.

**Deliverable:** Người đăng có quy trình xem lại thật; quản lý gọn và đầy đủ; thay đổi bỏ reuse chỉ áp dụng bề mặt Post.

### Task 4: Presence toàn app và cập nhật đơn đang xem

**Files:** Create `src/lib/presence.js`, `src/composables/useAppPresence.js`, `src/components/PresenceFloat.vue`; modify `src/App.vue`, `src/pages/MenuPage.vue`, `src/pages/TodayPage.vue`, `src/components/ui/MenuBoard.vue`, `src/router.js`. Tham khảo kết nối Clerk/Supabase trong `src/composables/usePresence.js`; không giữ hai channel presence hoạt động song song.

**Interfaces:**
- `serializePresenceContext({path,menu:{id,restaurantName}|null,picks:string[]})` trả `{ page, label, menuId, restaurantName, picks }` theo allowlist.
- `provideAppPresence()` gọi một lần tại App; provide context. `useAppPresence()` inject context cho pages.
- Context: refs `viewers`, `connected`; methods `setMenuDraft(menu,names)`, `clearMenuDraft()`, `notifyOrderChanged(menuId)`, `onOrderChanged(callback)` trả unsubscribe.
- `PresenceFloat.vue`: props `{ viewers, connected, selectedCount }`; component chỉ hiển thị. Pending picks từ presence; đơn đã đặt từ Supabase, không tin trạng thái “đã đặt” do người khác broadcast.

- [ ] Allowlist trang chung `/`, `/menu/:id`; `/catalog` giữ như route legacy và chỉ hiện online; `/share/:id` redirect về menu. History/Profile/Khẩu vị/Post/Manage/Dashboard/MyMenus và route không biết chỉ gửi “Đang online”; tuyệt đối không gửi route path cá nhân, ghi chú, ngân hàng, nội dung review hoặc form đang sửa.
- [ ] Khi chuyển khỏi menu, hủy debounce pending và tăng context generation, xóa picks/menuId trong payload trước track route mới; callback của context cũ không track lại picks sau đó. Draft gắn menu ID và quán; chọn hai món cùng tên ở hai quán không trộn. Guest không phát tên/email hoặc draft vào channel global; không coi guest sign-in guard là bảo mật server.
- [ ] Nối auth/session và lifecycle ở App, dedupe nhiều tab theo user; debounce chọn món 250ms, reconnect có trạng thái nhẹ, untrack khi logout/unmount. Bỏ log payload trong cơ chế mới. Không thay RLS hoặc giả rằng public Realtime channel đã có access control nhóm kín; nếu cần kênh private server, tách thay đổi authorization khỏi kế hoạch UI này.
- [ ] Desktop float mở popover không khóa trang; mobile mở sheet dùng AppDialog. Chỉ hiện badge online và nội dung khi mở; không toast/đọc aria-live mỗi lần người khác chọn món. Float đứng trên cart/nav, không che CTA hoặc focus.
- [ ] Sau create/update order, owner đổi paid/review hoặc poster sửa/chốt/mở menu thành công, `notifyOrderChanged(menuId)` chỉ gửi ID. Người đang xem menu nhận event, debounce tải `getMenu(id)` qua RLS; chỉ thay orders/trạng thái menu, không gọi `load()` đang reset nháp/edit. Broadcast không ghi order hoặc payment; refresh vẫn phải đọc nguồn thật. Today tải lại danh sách ngày khi event đúng ngày; Manage refresh menu đang xem và đánh dấu ledger cần tải lại nếu khoản thay đổi; unsubscribe khi page rời đi.

```js
const presence = useAppPresence()
watch(selectedDishes, value => presence.setMenuDraft(
  { id: menu.value?.id, restaurantName: menu.value?.restaurant?.name || '' },
  value.map(d => d.name)
), { deep: true })
onUnmounted(() => presence.clearMenuDraft())
// Sau mutation success của đơn/paid/review/menu: presence.notifyOrderChanged(menuId).
```

**Deliverable:** Float dùng được trên mọi route, public activity rõ đang chọn/đã đặt, trang riêng không lộ qua payload; đơn hiển thị theo dữ liệu thật.

### Task 5: Lịch, hồ sơ, review, payment và cập nhật

**Files:** `src/pages/HistoryPage.vue`, `src/pages/CatalogPage.vue`, `src/pages/ProfilePage.vue`, `src/pages/SignInPage.vue`, `src/components/ReviewDialog.vue`, `src/components/ui/PaymentQRModal.vue`, `src/components/ui/ChangelogModal.vue`, `src/components/ui/SignInModal.vue`, `src/components/ui/PaidToggle.vue`, `src/components/ui/PaidStamp.vue`.

**Interfaces:** Giữ props/events của `ReviewDialog(order,menu)`, `PaymentQRModal(order,poster,menuDate,menu)` và `OrderCard @changed`; đổi container sang AppDialog, không tạo đường ghi dữ liệu khác.

- [ ] History giữ `month`, `selected`, `shiftMonth`, ngày VN, tất cả đơn/ngày và danh sách chưa trả độc lập. Desktop ghi tên món rút gọn; mobile chấm/count và panel ngày. Calendar có vùng bấm 44px, text-label ngày; đổi tháng được, không mang giới hạn tháng cố định của prototype vào app.
- [ ] Bỏ Catalog khỏi navigation chính. Giữ API/catalog và route cũ nếu còn deep link; chuyển điểm vào chọn/tạo quán sang Post/RestaurantPicker và đọc đánh giá sang Menu/DishFeedbackDialog. Không dựng thêm vai trò chủ quán hoặc khu quản trị quán. Tên món + quán đi cùng; note được RLS cho xem giữ nguyên.
- [ ] Profile tổ chức tên/chuyển khoản/link riêng. Ngân hàng và MoMo cùng tồn tại; tab chỉ thay nhóm field đang xem, không đổi dữ liệu sang phương thức độc quyền. Giữ structured/freetext và normalize chủ TK, lưu/đang lưu/lỗi; cảnh báo thiếu chuyển khoản là nhắc, không cấm lưu tên/profile.
- [ ] Nối useFeedbackSuggestions đang có, body chỉ order_id/order_item_ids và locale, không đưa API key vào Vue. Dùng fallbackLabels/relevantFeedbackLabels/feedbackSections/validateSuggestionLabels từ shared/feedback.js; không thay contract Worker trong đợt UI. Gợi ý theo tên món là lựa chọn cảm nhận, không kết luận chất lượng đã ăn.
- [ ] Review dùng 1–5 sao do người dùng chọn, 8–12 gợi ý theo tên món chia nhóm, tối đa6 label lưu, notes tự do. Giữ selection khi AI đến muộn, account guards và eligibility; lỗi/timeout dùng fallback cụ thể, không tự chọn sao. Dialog một món mỗi lượt, chuyển món không mất draft.
- [ ] Payment ưu tiên người nhận/số tiền/tài khoản/QR, ngân hàng/MoMo khi có; giữ amount tự tính hoặc nhập khi chưa có giá, copy/download/retry ảnh. Chỉ `own` được confirmPaid; collector không có nút tick hộ. UI xem QR không đổi `is_paid`.
- [ ] Changelog có mới nhất và lịch sử theo ngày, chữ “Cập nhật”; sửa `const emit = defineEmits(['close'])` hiện đang thiếu binding trong handler Escape. Chuyển sang AppDialog để bỏ listener/scroll-lock riêng; giữ dữ liệu `src/changelog.json`.
- [ ] Copy audit tất cả PageHeader/EmptyState/alert/dialog: “Đã đặt món”, “Chưa lưu được đơn. Thử lại.”, “Món đã hết”, “Chưa có đánh giá”. Không thêm văn phong quảng cáo, câu giả AI hoặc lời khoe “cá nhân hóa”; error có hành động rõ.

**Deliverable:** Tất cả trang và dialog cùng navigation, typography, màu, spacing, trạng thái; không có AI insight giả trong production.

### Task 6: Khẩu vị của tôi từ dữ liệu thật

**Files:** Create `src/pages/TastePage.vue`, `src/components/TasteSummaryChart.vue`, `src/lib/taste-summary.js`; modify `src/router.js`, `src/lib/navigation.js`, `src/pages/ProfilePage.vue`, `src/pages/HistoryPage.vue`, `src/composables/useOrders.js`.

**Interfaces:**
- `summarizeTaste(orders, { from, to })` pure helper trả `{ from, to, orderCount, reviewCount, reviewedDayCount, frequentDishes, likedDishes, commonLabels }`. Item `{ key, restaurantId, restaurantName, dishId, dishName, orderCount, reviewCount, averageRating }`; labels `{ label, count }`. Với mỗi order_item, tra order.menu.menu_items bằng menu_item_id để lấy restaurant_dish_id; restaurantId từ order.menu.restaurant_id hoặc menu_item.dish.restaurant_id. order_items không có cột restaurant_dish_id/restaurant_id riêng. Nhóm theo pair restaurantId + restaurant_dish_id; legacy thiếu canonical dùng menu_item_id, thiếu cả menu_item_id dùng order_item_id, không gộp theo tên qua các quán.
- `likedDishes` chỉ gồm nhóm có review và averageRating >=4; hiển thị số mẫu, không gọi là sở thích bền vững từ một review. `frequentDishes` theo lượt chọn, `commonLabels` theo review do user chọn. Không dùng ghi chú để suy luận dị ứng/sức khỏe.
- `TasteSummaryChart.vue`: props `{ title, items:Array<{key,label,value,detail}>, emptyText }`; biểu đồ thanh CSS kèm nhãn/số, giới hạn 5 item với nút xem danh sách; không thêm chart lib.
- Mở rộng `useOrders().listMyOrders({from,to,unpaidOnly=false,offset,limit})` tương thích caller cũ: không truyền offset/limit thì giữ hành vi hiện có; Taste gọi offset=0, limit=100 rồi phân trang theo orders.created_at/id ổn định; filter khoảng ngày theo menu.menu_date, sắp ngày hiển thị ở helper. Không order cột menu_date như thể thuộc orders. Query vẫn `orders.user_id = current Clerk sub`, thêm count exact cho phân trang. Không dùng listMyMenus hoặc đơn của người thu để tạo khẩu vị cá nhân.

- [ ] Route `/taste` yêu cầu đăng nhập như `/profile`; link tại Cá nhân và Lịch cơm, nav active Cá nhân. Presence serialize route này thành online, không gửi món/nhãn/biểu đồ.
- [ ] Taste load 90 ngày đến hôm nay VN bằng listMyOrders, normalize menu và reviewForItem; bỏ response khi user đổi/logout. Nếu chưa tải hết hoặc lỗi một trang, hiển thị phạm vi đã tải; chỉ báo tổng toàn bộ khi hoàn tất.
- [ ] Dựng ba phần Món thường chọn / Món đánh giá tốt / Cảm nhận thường chọn, ghi khoảng ngày và số mẫu. 0 đơn: Chưa có bữa ăn + Xem menu; có đơn chưa review: hiện lượt đặt và link Lịch cơm để đánh giá. Một review hiện điểm/số mẫu; từ >=3 ngày review mới mô tả xu hướng theo quy tắc và ghi cơ sở.
- [ ] Review đã xóa không tính tổng; đặt hộ tính cho user_id chủ đơn. Món cùng tên ở quán khác giữ riêng. Bấm món mở menu đã ăn tương ứng nếu tồn tại; không tạo link menu hôm nay giả hoặc gợi ý món ngoài menu.
- [ ] Insight AI/khuyến nghị nâng cao chỉ nối sau khi daily-taste-insights được duyệt, có migration/RLS và reader đã kiểm. Dùng user_taste_insights của chính user, restaurant_insights cho nhóm; ghi generated_at, số mẫu, độ tin cậy. Khi thiếu/quota/lỗi vẫn có thống kê quan sát. Không gọi AI mỗi lần mở Taste hoặc bật cron trong đợt UI.

```js
// TastePage sau khi tải đủ các trang; helper không gọi mạng.
const summary = computed(() => summarizeTaste(orders.value, range.value))
const frequentBars = computed(() => summary.value.frequentDishes.slice(0, 5).map(d => ({
  key: d.key, label: `${d.dishName} · ${d.restaurantName || 'Chưa ghi nhận quán'}`,
  value: d.orderCount, detail: `${d.orderCount} lần đặt · ${d.reviewCount} đánh giá`
})))
```

**Deliverable:** Khẩu vị có dữ liệu thật và trạng thái ít dữ liệu; bố cục prototype được adapt đầy đủ, insight nền có điểm tích hợp riêng.

### Task 7: Kiểm tra cuối đợt và chuẩn bị review

**Files:** Create `tests/unit/app-presence-privacy.test.js`, `tests/unit/manage-summary.test.js`, `tests/unit/taste-summary.test.js`, `docs/review/2026-10-05-ui-adaptation-verification.md`; review existing `tests/unit/lunch-helpers.test.js`, `tests/unit/menu-account-guard.test.js`, `src/changelog.json`, coverage doc.

**Interfaces:** Tests import `serializePresenceContext` (Task4), các summary helper (Task3/6); kiểm payload, quyền sở hữu và thống kê thực thay vì màu/pixel/template.

- [ ] Sau khi Tasks1–6 được ghép, thêm privacy tests có ý nghĩa: `/profile`, `/history`, `/manage`, `/post`, route không biết loại bỏ menu/picks; menu giữ đúng quán; chuyển từ menu sang route riêng không giữ pending picks; hai phiên người nhận/placer không làm lộ form/notes. Ví dụ assertion:

```js
import { expect, it } from 'vitest'
import { serializePresenceContext } from '../../src/lib/presence.js'
it('không gửi món đang chọn khi ở hồ sơ', () => {
  const result = serializePresenceContext({
    path: '/profile', menu: { id: 'menu-a', restaurantName: 'Cơm nhà An' }, picks: ['Gà nướng']
  })
  expect(result).toMatchObject({ page: 'online', label: 'Đang online', menuId: null, restaurantName: null, picks: [] })
})
```

- [ ] Thêm unit cho tổng suất/tiền và group khoản cũ sau khi helper đã xong. Dùng các ca dưới và thêm giá null, người cùng tên khác ID, item legacy không khớp, cùng món ở hai quán. Không viết snapshot CSS/template:

```js
import { expect, it } from 'vitest'
import { summarizeManagedMenu, managedOrderAmount, groupOutstandingOrders } from '../../src/lib/manage-summary.js'
const menu = {
  id: 'm1', menu_date: '2026-10-05',
  menu_items: [{ id: 'a', name: 'Gà nướng', price: 40000 }, { id: 'b', name: 'Canh chua', price: null }],
  orders: [{ id: 'o1', user_id: 'u1', is_paid: false, order_items: [{ menu_item_id: 'a', name_snapshot: 'Gà nướng' }, { menu_item_id: 'b', name_snapshot: 'Canh chua' }] }]
}
it('không mất suất hoặc biến thiếu giá thành 0', () => {
  expect(summarizeManagedMenu(menu)).toMatchObject({ servings: 2, orderedDishCount: 2, knownTotal: 40000, unknownPriceCount: 1, unpaidCount: 1 })
  expect(managedOrderAmount(menu, menu.orders[0])).toBeNull()
})
it('giữ riêng người cùng tên và khoản cũ', () => {
  const orders = ['u1','u2'].map((id, i) => ({ id: 'o' + i, user_id: id, user: { full_name: 'Lan' }, is_paid: false,
    item_text: 'Gà nướng', order_items: [{ menu_item_id: 'a', name_snapshot: 'Gà nướng' }],
    menu: { ...menu, menu_date: '2026-07-01' } }))
  const groups = groupOutstandingOrders(orders)
  expect(groups).toHaveLength(2)
  expect(groups.map(g => g.oldestDate)).toEqual(['2026-07-01','2026-07-01'])
})
```

- [ ] Thêm taste-summary unit cho 0 review, 1 review, 3 ngày có review, same-name/different-restaurant và đơn đặt hộ. Assertions: frequentDishes đếm lượt đặt; likedDishes không có nhóm chưa được review; group khác quán có key khác; reviewedDayCount đếm ngày, không đếm món.

```js
import { expect, it } from 'vitest'
import { summarizeTaste } from '../../src/lib/taste-summary.js'
const range = { from: '2026-07-08', to: '2026-10-05' }
const order = (id, restaurantId, rating = null) => ({
  id, user_id: 'recipient', menu: {
    menu_date: '2026-10-05', restaurant_id: restaurantId,
    restaurant: { name: restaurantId },
    menu_items: [{ id: 'mi-' + id, restaurant_dish_id: 'dish-' + restaurantId, name: 'Cá kho' }]
  }, order_items: [{ id: 'oi-' + id, menu_item_id: 'mi-' + id,
    name_snapshot: 'Cá kho', review: rating ? { rating, labels: ['Vừa miệng'] } : null }]
})
it('thường chọn chưa đủ để gọi là đánh giá tốt', () => {
  const result = summarizeTaste([order('o1', 'r1')], range)
  expect(result.frequentDishes[0].orderCount).toBe(1)
  expect(result.likedDishes).toEqual([])
  expect(result.reviewedDayCount).toBe(0)
})
it('món cùng tên của hai quán có hai nhóm riêng', () => {
  const result = summarizeTaste([order('o1', 'r1', 5), order('o2', 'r2', 2)], range)
  expect(result.frequentDishes).toHaveLength(2)
  expect(new Set(result.frequentDishes.map(d => d.key)).size).toBe(2)
  expect(result.likedDishes).toHaveLength(1)
  expect(result.reviewedDayCount).toBe(1)
})
```

- [ ] Chạy một đợt unit/build bằng Node đúng engine `^22.18.0 || >=24.11.0`; runtime Node24 đã có. Không cài lại package hoặc chạy Worker tests vì đợt này không đổi Worker:

```bash
rtk proxy env PATH="/Users/nhatminh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" npm run test:unit
rtk proxy env PATH="/Users/nhatminh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" npm run build
```

- [ ] Chạy browser matrix bên dưới sau build. Dùng fixture/mock cho thao tác phá hủy hoặc writes; không tạo đơn/đổi paid/xóa menu trên shared DB chỉ để test UI. Nếu sửa API/DB ngoài phạm vi không tiếp tục dưới kế hoạch này; tách phạm vi trước, rồi mới dùng `test:db`/RLS khi fixture sẵn. Không khởi Docker/hệ thống chỉ để chạy lại kiểm tra baseline đã qua.

| Thiết bị/phiên | Luồng bắt buộc | Điều kiện đạt |
| --- | --- | --- |
| Desktop1280, signed-in | Nav/alias routes/changelog/Cá nhân | Active đúng, không pill xanh, cập nhật không float, profile quay lại được |
| Mobile375/390 | Toàn bộ route + dialog, keyboard open | Không overflow; targets44px; safe-area; float không che cart/CTA/focus |
| Người đặt + guest | Structured/plain, sign-in giữa luồng | Structured không nhập món tay; note tự do; guest draft giữ; không submit2lần |
| Menu không giá/chốt/hết món | Chọn, confirm, retry | Không tổng0giả; chặn add khi chốt/hết; lỗi không xóa draft |
| Người đặt hộ + người nhận | Order/payment/review trên2phiên | Đơn thuộc người nhận; placer/collector không tick hoặc review hộ |
| Người đăng | Ảnh/OCR/manual/text/xem lại/publish lỗi | Không auto publish OCR; giữ quán/draft; thiếu giá vẫn hợp lệ; không selectorreuse trênPost |
| Quản lý | Hôm nay, món, đặt hộ, ledger tháng cũ, archive | Suất tự tổng hợp; món có đơn không đổi tên/xóa; paid chỉ xem; đặt hộ thuộc người nhận; Today không lẫn tháng cũ; lọc và tổng ledger không bỏ trang hoặc giả số tiền thiếu |
| Hai account/hai tab | Globalpresence/chọn món/navigate private/logout | Count không trùng; đúngmenu+quán; private payload không route/picks; offline không mấtdraft |
| Khẩu vị0/1/3ngàyreview | Ba biểu đồ, cùng tên khác quán, đặt hộ, phân trang | Không gộp quán; thường chọn khác đánh giá tốt; không insight giả; private presence |
| Review/AI chậm | Star/tags/notes/chuyểnmón/Escape | Không auto stars; selection không nhảy; tối đa6labels; notes giữ; focus trả đúng |
| Payment/changelog | QR fail/copy/amount/Escape/lịch sử | Không đổi paid khi chỉ mởQR; owner-onlyconfirm; no focustrapleak; changelog Escape không lỗi |

- [ ] Ghi các lỗi/cách sửa và kết quả thật trong verification doc; chỉ chạy lại checks khi có lỗi/newchanges cần kiểm. Không ghi “pass” nếu chỉ xem prototype.
- [ ] Đọc toàn diff và đối chiếu coverage/latest decisions; cập nhật coverage ghi phần đã nối thật, phần insight vẫn riêng. Trước commit được phép, cập nhật `src/changelog.json` theo ngày VN bằng bullet ngắn: “Dễ chọn món và xem lại trước khi đặt”, “Lịch cơm hiển thị bữa ăn theo ngày”, “Xem ai đang chọn món”. Không copy câu dev vào changelog.
- [ ] Trình kết quả local/preview và diff cho user. Không tự deploy, migrate, bật insight cron, push hoặc sửa production trong đợt adapt chưa được duyệt.

**Deliverable:** Bản Vue hoạt động đúng các luồng cũ và UI mới, có evidence kiểm tra tổng hợp; deployment là bước riêng sau review.

## Hạng mục dữ liệu/AI nối tiếp

Task6 adapt UI Khẩu vị bằng dữ liệu đơn/đánh giá hiện có. Phân tích nền khẩu vị cá nhân/quán, cron ngày làm việc, storage insight và đề xuất món nâng cao cần kế hoạch dữ liệu/AI riêng theo `docs/superpowers/specs/2026-10-05-daily-taste-insights-design.md`. Đợt này không thêm bảng, không bật cron, không đổi model/prompt Worker. Giờ chốt tự động cũng cần hợp đồng lưu/enforcement thống nhất thay vì field chỉ có trong prototype.

## Self-review

- Bao phủ Today/Menu/Post/Profile/Manage/Dashboard/MyMenus/History/Catalog legacy/SignIn/Taste, changelog, review/payment và presence. Khẩu vị cơ bản dùng đơn/review thật, không chờ backend AI để dựng UI.
- API đọc bổ sung ở composable cho feedback/ledger/archive không thay schema hoặc RLS; mutation dùng RPC/API Supabase đang có. Insight là nhánh phụ thuộc dữ liệu riêng, không migration ngầm.
- Bỏ reuse đúng vị trí Post; không xóa entry reuse từ Manage. Không tab Quán ăn; người đăng chọn/tạo quán trong Post. Quản lý tách Today/ledger/archive, chỉnh món và đặt hộ đúng ownership.
- Đã nêu chênh lệch prototype/production về deadline và insight; không yêu cầu migration ngầm.
- Test tập trung cuối đợt; không TDD/per-edit; user vẫn xem trước thiết kế trước khi áp dụng.

## Nghiệm thu và triển khai sau review

- [ ] Đối chiếu từng route/dòng coverage với Vue; không coi prototype là bằng chứng Vue chạy. Trong docs/review ghi nguồn fixture, commit/base, thiết bị, build/unit và giới hạn còn lại.
- [ ] Hoàn tất UI khi Task1–6 cùng chạy, kiểm tra Task7 đạt và phần thiếu dữ liệu có empty/fallback thật. Không gọi hệ thống insight đã hoàn tất chỉ vì Taste có biểu đồ thống kê.
- [ ] Changelog theo ngày VN thực thi; chỉ ghi tính năng đã ghép. Ví dụ “Quản lý số suất và tiền chưa thu theo từng ngày”, “Xem đánh giá món của đúng quán”, “Theo dõi khẩu vị từ các bữa đã đánh giá”. Nếu entry cùng ngày tồn tại thì thêm changes.
- [ ] Trình local/preview Vue để user review điện thoại/máy tính. Deploy test Vercel khi được yêu cầu; chỉ Vue cần build/deploy trong đợt adapt, Worker giữ deployment hiện có nếu code không đổi. Kiểm endpoint gợi ý qua review và fallback, không deploy lại Worker chỉ vì đổi UI.
- [ ] Trước deploy ghi URL build trước/test mới và cấu hình publishable/API base cho test, không in secret. Rollback về deployment Vue trước hoặc hoàn nguyên riêng diff adapt đã xác định; không reset dirty worktree hoặc đụng migration/đơn cũ.

## Checklist tự rà soát kế hoạch

- [x] Bao phủ route hiện có, Taste, dialog, changelog và trạng thái chung.
- [x] Không tab Quán ăn; quán/món nằm trong Post/Menu.
- [x] Giữ ordered-dish guard và owner-only paid/review.
- [x] Ledger lọc poster, nhóm user_id, không lẫn khoản cũ vào Today, có phân trang/thiếu giá.
- [x] Presence bỏ dữ liệu cá nhân trước khi gửi.
- [x] Tách dữ liệu thật khỏi mẫu và insight nền; không migration/deploy tự động.
- [x] Test cuối; file/interface và điểm tích hợp đã ghi.

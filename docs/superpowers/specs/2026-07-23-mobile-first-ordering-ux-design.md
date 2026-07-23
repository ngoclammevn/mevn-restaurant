# Mobile-first Ordering UX — Quick Menu Focus

> Ngày: 2026-07-23
>
> Trạng thái: Đã duyệt
>
> Ưu tiên: A — đặt món thật nhanh trên mobile; trải nghiệm người đăng/thu tiền và tính nhất quán toàn app là quality floor bắt buộc.

## 1. Bối cảnh

Điểm vào phổ biến nhất của người đặt món là một link menu được gửi trong Slack. Người dùng mở
link trên điện thoại, thường đã biết mình cần làm gì và muốn hoàn tất nhanh. Thiết kế hiện tại có
nhiều chức năng tốt (menu OCR có cấu trúc, đặt hộ, presence, QR thanh toán, self-tick), nhưng
navigation và mật độ thông tin chưa ưu tiên đủ mạnh cho fast path này.

Khảo sát ngày 2026-07-23 ghi nhận:

- Mobile đang hiển thị 6 mục điều hướng trong một hàng cuộn ngang; link chỉ cao khoảng 31px.
- Màu chữ `--muted` trên nền chính có contrast khoảng 3.39:1, không đạt 4.5:1 cho chữ thường.
- Một số label của field chưa liên kết bằng `for`/`id`.
- Signed-out state chưa đồng nhất: Lịch sử/Hồ sơ có hướng dẫn đăng nhập, trong khi Menu của tôi
  có thể báo lỗi dữ liệu và Thu tiền có thể giữ spinner.
- Clerk sign-in còn copy tiếng Anh và tên mặc định “My Application”.
- `MenuPage.vue` và `PostMenuPage.vue` đều hơn 1.200 dòng, làm tăng rủi ro lệch hành vi và visual
  giữa các trạng thái.

## 2. Mục tiêu

### 2.1. Mục tiêu chính

Tạo fast path:

`Slack link → xem menu → chọn món → đặt → thanh toán ngay hoặc để sau`

Người đã đăng nhập, với một đơn thông thường, phải có thể hoàn tất bằng:

`mở link → chọn món → bấm Đặt món`

### 2.2. Mục tiêu hỗ trợ

- Khách được xem và chọn món trước; chỉ yêu cầu đăng nhập khi submit.
- Draft không bị mất qua đăng nhập hoặc reload; submit lỗi giữ draft để thử lại.
- Người đăng menu và người thu tiền vẫn có lối vào rõ, không bị giấu như chức năng phụ.
- Toàn app có signed-out/loading/error/accessibility behavior nhất quán.

### 2.3. Ngoài phạm vi

- Không thêm backend, serverless function hoặc webhook.
- Không đổi data model, RLS hay cơ chế Clerk ↔ Supabase.
- Không thêm role admin, notification hoặc xác nhận thanh toán hai chiều.
- Không cho người thu tiền đánh dấu đã trả hộ.
- Không thêm một hệ thống cart/quantity mới nếu behavior hiện tại chưa có.
- Không thêm animation chỉ để trang trí.

## 3. Ràng buộc nghiệp vụ và bảo mật

Mọi phần của thiết kế này phải giữ nguyên các bất biến trong `AGENTS.md`:

- Menu text thuần cho phép nhập món tự do.
- Menu OCR có `dishes[]` hợp lệ bắt buộc chọn món có tên khớp chính xác từ menu.
- Thanh toán là boolean self-tick; chỉ `orders.user_id` được đổi `is_paid`.
- Đặt hộ ghi `orders.user_id` là người được đặt hộ. Người đó mới được tự tick đã trả.
- Người đặt menu là người thu tiền; ai đăng nhập cũng được đăng menu.
- Một ngày có thể có nhiều menu; “hôm nay” dùng giờ Việt Nam.
- Chỉ dùng publishable keys ở frontend. Không dùng `service_role` hoặc Clerk secret.

## 4. Hướng thiết kế đã chọn

Chọn **Quick Menu Focus** thay cho hai hướng còn lại:

1. **Quick Menu Focus — đã chọn:** món ăn và CTA là nội dung chính; social là tín hiệu gọn.
2. Guided 3 Steps — không chọn làm mặc định vì tăng số bước cho người dùng quen.
3. Social First — không chọn làm mặc định vì đẩy danh sách món xuống thấp.

Guided flow vẫn được dùng cục bộ cho đăng nhập và xác nhận. Social/presence vẫn tồn tại dưới
dạng summary có thể mở rộng.

## 5. Kiến trúc thông tin và navigation

### 5.1. Global navigation

Trên mobile, thay 6 link cuộn ngang bằng bottom navigation 4 mục:

1. **Hôm nay** → `/`
2. **Đăng menu** → `/post`
3. **Đơn của tôi** → `/history`
4. **Quản lý** → màn hình quản lý có hai tab Menu của tôi và Thu tiền

Hồ sơ, changelog và đăng xuất nằm trong menu avatar. Desktop dùng cùng bốn nhóm thông tin trong
top navigation để mental model không thay đổi theo breakpoint.

### 5.2. Quản lý

Quản lý có hai route/tab ổn định:

- `/manage/menus` — Menu của tôi
- `/manage/payments` — Thu tiền

Các URL cũ không bị hỏng:

- `/my-menus` redirect tới `/manage/menus`
- `/dashboard` redirect tới `/manage/payments`

Nếu người dùng chưa từng đăng menu, trang Quản lý hiển thị empty state với CTA Đăng menu.

### 5.3. Menu mở từ Slack

`/menu/:id` dùng chrome tối giản:

- Back về Hôm nay.
- Logo/tên app.
- Chia sẻ hoặc menu phụ.
- Không hiển thị toàn bộ global navigation phía trên danh sách món.

Mục tiêu là đưa món đầu tiên vào viewport ban đầu trên mobile.

## 6. Luồng đặt món chính

### 6.1. Header menu

`MenuHero` hiển thị:

- Tên menu/quán.
- Người đăng.
- `menu_date` được format theo giờ Việt Nam.
- Số người đã đặt và số người đang xem.

Không đưa danh sách order đầy đủ lên trước danh sách món. `SocialSummary` cho phép người dùng mở
chi tiết “mọi người đặt gì” khi họ muốn.

Không hiển thị giờ chốt đơn vì schema hiện tại không có dữ liệu này.

### 6.2. Menu có cấu trúc

- `DishList` hiển thị món chính trước, món phụ/nước sau theo category hiện có.
- Toàn bộ `DishRow` là vùng chạm; không buộc người dùng chạm đúng icon nhỏ.
- Món được chọn có trạng thái rõ bằng border, icon và text, không chỉ dựa vào màu.
- Tên món lưu vào order phải khớp chính xác dish trong menu.
- Sticky bar cập nhật số món và tổng tiền từ dữ liệu dish hiện có.

### 6.3. Menu text thuần

- Giữ field món tự do và ghi chú tự do.
- CTA sticky chỉ enabled khi món không rỗng.
- Không cố chuyển menu text thành lựa chọn có cấu trúc ở client.

### 6.4. Tùy chọn nâng cao

Ghi chú và Đặt hộ nằm trong `OrderOptionsSheet`, không chiếm diện tích fast path.

- Mặc định “Đặt cho” là chính mình.
- “Đặt hộ” mở profile picker và mô tả rõ người được chọn sẽ là chủ đơn.
- Khi chọn người khác, copy xác nhận phải nói “Đặt giúp [Tên]”.

### 6.5. Sticky CTA

`StickyOrderBar` luôn hiển thị trong vùng an toàn phía dưới:

- Số món đã chọn.
- Tổng tiền nếu menu có giá có cấu trúc.
- CTA `Đặt món · 57.000đ` hoặc `Đặt món`.
- Có clearance cho bottom navigation/safe-area để không che nội dung.
- Khóa trong khi submit để chặn double tap trong cùng phiên.

## 7. Guest auth và phục hồi draft

### 7.1. Nguyên tắc

Khách được xem và chọn trước. Khi bấm Đặt món:

1. Lưu draft client-side theo `menu_id`.
2. Mở Google sign-in.
3. Sau đăng nhập, provision profile như hiện tại.
4. Khôi phục draft và đưa người dùng về bước xác nhận.
5. Không tự submit ngay sau auth; người dùng xác nhận lần cuối.

### 7.2. Nội dung draft

Draft lưu trong `localStorage` với key `lunch-order-draft:v1:<menu_id>`, hết hạn sau 24 giờ.
Draft có version và chỉ chứa dữ liệu cần để phục hồi:

- `menu_id`
- identity/tên chính xác của các dish đã chọn, hoặc free text với menu text thuần
- ghi chú
- `order_for_id` nếu có
- thời điểm cập nhật

Draft không chứa payment info, token hoặc dữ liệu bí mật.

### 7.3. Revalidation

Khi phục hồi:

- Fetch lại menu.
- Với menu có cấu trúc, chỉ giữ dish còn tồn tại và có tên khớp chính xác.
- Nếu một dish đã biến mất, báo rõ và yêu cầu người dùng kiểm tra lại.
- Nếu profile được chọn cho Đặt hộ không còn đọc được, trả “Đặt cho” về chính mình và báo rõ.
- Không submit draft của menu khác.
- Xóa draft đã quá 24 giờ.
- Xóa draft sau khi order được tạo thành công; giữ draft khi submit lỗi.

## 8. Xác nhận và thanh toán

### 8.1. Đơn của chính mình

Sau khi `createOrder()` thành công, mở `OrderSuccessSheet`:

- Xác nhận món đã đặt.
- CTA chính: `Thanh toán ngay bằng QR`.
- CTA phụ: `Để sau`.

Mở QR không tự đánh dấu đã trả. Chỉ sau hành động rõ ràng
`Tôi đã chuyển tiền xong` mới gọi `togglePaid()` cho đơn của chính mình.

Nếu QR lỗi, luôn có fallback:

- Tên ngân hàng/ví.
- Số tài khoản/số điện thoại.
- Nội dung chuyển khoản.
- Nút copy riêng cho từng giá trị.

### 8.2. Đơn đặt hộ

Sau khi submit:

- Hiển thị `Đã đặt giúp [Tên]`.
- Không hiển thị hành động tự tick thanh toán cho người đặt hộ.
- Hiển thị nút copy link menu để gửi người được đặt hộ.

Người được đặt hộ xem đơn trong Đơn của tôi và tự thanh toán/tick theo RLS.

## 9. Các cải tiến “hay ho” trong phạm vi

### 9.1. Đặt lại món quen

Chỉ hiển thị gợi ý nếu có thể tái tạo một lựa chọn hợp lệ:

- Menu có cấu trúc: tên món cũ phải khớp chính xác dish hiện tại.
- Menu text thuần: prefill free text cũ.
- Không có match hợp lệ thì không hiển thị chip.

Gợi ý chỉ prefill; người dùng vẫn phải bấm Đặt món.

### 9.2. Món được chọn nhiều

Hiển thị `3 người đã chọn` trên dish bằng cách derive từ orders của menu hiện tại:

- Không thêm bảng/cột.
- Parse order format hiện có.
- Chỉ đếm match tin cậy; dữ liệu text không chắc chắn thì không gán vào dish.

### 9.3. Presence gọn

Presence vẫn realtime nhưng không làm thay đổi layout:

- Header có `3 người đang xem`.
- Dish có tín hiệu nhẹ khi người khác đang cân nhắc.
- Update realtime không cuộn trang, đổi focus hoặc xóa lựa chọn local.

## 10. Quality floor cho các luồng còn lại

### 10.1. Hôm nay

- Là index/social dashboard nhẹ.
- Mỗi menu có summary và CTA `Vào chọn món`.
- Không sao chép toàn bộ order form vào TodayPage.

### 10.2. Đăng menu

Áp dụng progressive disclosure:

1. Ngày, tiêu đề, mô tả/ảnh.
2. OCR chỉ xuất hiện khi có ảnh và người dùng bật.
3. Preview/chỉnh AI là một trạng thái riêng với CTA rõ.

Draft form hiện có phải tiếp tục được giữ khi auth hoặc OCR lỗi.

### 10.3. Đơn của tôi

- Unpaid orders xuất hiện trước paid history.
- Mỗi unpaid order có CTA thanh toán rõ.
- Paid status vẫn là self-tick, không đổi semantics.

### 10.4. Quản lý và Thu tiền

- Tab Menu của tôi cho phép mở, share, sửa, xóa như hiện tại.
- Tab Thu tiền tiếp tục group unpaid orders theo người và nhiều menu/ngày.
- Không thêm nút đánh dấu đã trả hộ.
- Signed-out state phải là login prompt, không phải spinner hoặc network error.

## 11. Component boundaries

Tách `MenuPage.vue` theo trách nhiệm, không thay đổi behavior trong cùng lúc:

- `MenuHero.vue` — metadata và social summary.
- `DishList.vue` / `DishRow.vue` — render và chọn món.
- `StickyOrderBar.vue` — tổng lựa chọn và CTA.
- `OrderOptionsSheet.vue` — note và đặt hộ.
- `OrderSuccessSheet.vue` — xác nhận và điều hướng sang QR.
- `GuestOrderGate.vue` — auth resume orchestration.
- `AsyncState.vue` — loading/error/retry thống nhất.
- `AppBottomNav.vue` — navigation mobile.
- `ManagePage.vue` — shell cho hai tab quản lý.

Logic thuần nằm trong helper/composable có thể unit test:

- serialize/restore/revalidate draft
- exact dish matching
- derive selected count và total
- quyết định người hiện tại có được thấy payment self-tick hay không

Không tạo abstraction chung nếu chỉ có một consumer.

## 12. Error, loading và empty states

- Loading dùng skeleton có hình dạng gần nội dung thật.
- Mọi lỗi load có message cụ thể và nút `Thử lại`.
- Không giữ spinner vô hạn khi chưa đăng nhập hoặc khi request fail.
- Submit lỗi giữ nguyên selection và focus vào error summary.
- Double tap trong cùng phiên bị chặn bằng trạng thái submitting.
- Empty state luôn có next action phù hợp.
- Signed-out state dùng chung copy và CTA trên History, Profile, Manage.
- Clerk sign-in được cấu hình Vietnamese localization và tên ứng dụng thật.

## 13. Accessibility và responsive

- Mọi target tương tác tối thiểu 44×44 CSS px.
- Chữ thường đạt contrast tối thiểu 4.5:1; chữ lớn đạt 3:1.
- Không truyền tải selected/paid/error chỉ bằng màu.
- `label` dùng `for`/`id`; hint/error nối bằng `aria-describedby`.
- Loading, submit success và error dùng vùng `aria-live` phù hợp.
- Modal/sheet trap focus, đóng bằng Escape và trả focus về trigger.
- Bottom sheet vẫn sử dụng được bằng keyboard trên desktop.
- Tôn trọng `prefers-reduced-motion`; animation không chặn thao tác.
- Không có horizontal page overflow ngoài vùng chủ động.
- QA bắt buộc ở 360px, 390px, 430px và desktop.

## 14. Data flow

State machine của một phiên:

```text
viewing
  → selecting
  → ready
  → authenticating (guest only)
  → confirming
  → submitting
  → success
  → payment | done
```

Các transition lỗi quay về state gần nhất còn giữ draft:

- Auth cancel → selecting/ready.
- Revalidation fail → selecting với warning.
- Submit fail → confirming với selection còn nguyên.
- QR fail → payment fallback bằng text/copy.

## 15. Thứ tự triển khai

Khi chuyển sang implementation plan, roadmap này được tách thành ba plan có thể kiểm thử độc lập:

1. UX foundation và navigation.
2. Fast ordering, auth resume và payment.
3. Manage quality floor và measured polish.

### Pha 1 — UX foundation

- Navigation mobile mới.
- Signed-out state thống nhất.
- Loading/error/retry chung.
- Touch target, contrast, labels và focus cơ bản.

### Pha 2 — Fast ordering

- Tách `MenuPage` theo component boundaries.
- MenuHero, DishList và StickyOrderBar.
- OrderOptionsSheet cho ghi chú/đặt hộ.
- Giữ đầy đủ structured/free-text behavior.

### Pha 3 — Auth resume và payment

- Persist/revalidate guest draft.
- Resume sau Google sign-in.
- OrderSuccessSheet.
- QR và fallback; bảo vệ self-tick/đặt hộ.

### Pha 4 — Quality floor cho B

- Manage shell/tabs và route compatibility.
- Progressive disclosure cho PostMenu.
- Unpaid-first trong History.

### Pha 5 — Polish có đo lường

- Đặt lại món khớp chính xác.
- Số người chọn món.
- Presence gọn và motion có reduced-motion fallback.
- Responsive, accessibility và regression QA.

## 16. Tiêu chí thành công

- Median thời gian của returning signed-in user từ lúc MenuPage tương tác được tới khi tạo đơn
  thành công không quá 30 giây trong usability test.
- Guest không mất draft qua Google sign-in.
- Không mất draft khi reload trước submit.
- Không có horizontal page overflow ngoài component chủ động.
- Không có signed-out page mắc spinner hoặc báo network error sai ngữ cảnh.
- Không có accessibility issue mức serious/critical trong luồng chính.
- Không có regression đối với menu text, menu structured, đặt hộ, self-tick, nhiều menu/ngày và
  giờ Việt Nam.

## 17. Kiểm thử

### Unit

- Serialize/restore/revalidate draft.
- Exact dish matching cho quick reorder và structured menu.
- Derive số món/tổng tiền.
- Payment eligibility: self order vs order-for-other.
- Parse order cũ/mới khi tính popularity.

### Component

- Menu structured bắt buộc chọn dish hợp lệ.
- Menu text cho nhập tự do.
- Sticky bar enabled/disabled đúng.
- Guest submit mở auth và giữ selection.
- Restore fail báo dish đã thay đổi.
- Order-for-other không render self-payment action.
- QR error render fallback copy.

### E2E mobile

- Slack link → chọn → đăng nhập → restore → confirm → order.
- Signed-in fast path → order → QR → self-tick.
- Đặt hộ → success đúng tên → không thể tick hộ.
- Reload giữa chừng → draft phục hồi.
- Network/load/submit/QR errors có retry hoặc fallback.
- Double tap không tạo hai request trong cùng phiên.
- Navigation không che sticky CTA ở 360/390/430px.

### Regression

- RLS tests hiện có tiếp tục pass.
- Build Vite static thành công.
- Manual browser QA cho Today, Menu, Post, History, Manage, Profile.

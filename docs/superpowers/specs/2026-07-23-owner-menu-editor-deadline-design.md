# Thiết kế chỉnh sửa menu OCR và hạn chót đặt món

**Ngày:** 2026-07-23

**Trạng thái:** Chờ chủ dự án duyệt tài liệu

**Phạm vi:** Người đăng chỉnh sửa menu của mình sau OCR; deadline đặt món tuỳ chọn; đồng bộ UI/UX với nhánh `ui-ux-foundation`.

## 1. Bối cảnh

Luồng đăng menu đã có `MenuBoard` edit mode để người đăng rà lại kết quả OCR trước khi lưu.
Sau khi đăng, trang **Menu của tôi** mới chỉ cho sửa tiêu đề và toàn bộ `note` dưới dạng text.
Với menu structured, `note` thực tế là JSON `{ notes, dishes }`, nên người dùng phải sửa JSON
thủ công nếu muốn thay đổi món, giá hoặc category.

Ứng dụng cũng chưa có thời điểm chốt đơn. Người dùng có thể tạo hoặc sửa đơn bất kỳ lúc nào,
kể cả khi người thu tiền đã bắt đầu tổng hợp.

## 2. Mục tiêu

1. Người đăng chỉnh sửa menu structured sau OCR bằng giao diện trực quan, không sửa JSON.
2. Tái sử dụng `MenuBoard` và toàn bộ visual language Warm Paper hiện tại.
3. Cho phép đặt một deadline tuỳ chọn khi tạo hoặc sửa menu.
4. Sau deadline, chặn tạo/sửa/xoá nội dung đơn ở cả UI và database.
5. Vẫn cho chủ đơn tự cập nhật thanh toán sau deadline.
6. Giữ nguyên mô hình không backend riêng, Clerk + Supabase RLS và nhóm tin cậy dưới 25 người.

## 3. Ngoài phạm vi

- Không thêm role `admin`.
- Không cho một người sửa menu của người khác.
- Không thay ảnh menu sau khi đăng.
- Không tự chạy lại OCR.
- Không thêm service-role key, webhook hoặc server riêng.
- Không thay đổi cơ chế đặt hộ, self-tick thanh toán hoặc cách tính tiền.
- Không thêm thao tác huỷ đơn mới nếu UI hiện tại chưa có.

## 4. Quyền chỉnh sửa

“Quản trị menu” trong thiết kế này nghĩa là **người đăng menu**, không phải role hệ thống.

- UI chỉ hiện nút chỉnh sửa khi `menu.poster_id === currentUser.id`.
- `menus_update` tiếp tục giới hạn bằng `poster_id = auth.jwt()->>'sub'`.
- Không thêm bảng role, cột role hoặc policy admin.
- Deadline áp dụng cho tất cả người đặt, kể cả người đăng menu.
- Người đăng muốn đặt muộn phải gia hạn hoặc bỏ deadline.

## 5. Data model

Thêm migration production-safe:

```sql
alter table menus
  add column if not exists order_deadline timestamptz;
```

Quy ước:

- `null`: không giới hạn thời gian đặt.
- Giá trị được lưu dưới dạng timestamp tuyệt đối.
- UI nhập và hiển thị theo `Asia/Ho_Chi_Minh` (UTC+7).
- Menu cũ có `order_deadline = null`, nên hành vi hiện tại không đổi.
- Người đăng được đặt deadline tương lai, gia hạn hoặc đổi về `null`.
- UI không cho chọn một deadline mới trong quá khứ.
- Một deadline đã qua được phép giữ nguyên khi người đăng chỉ sửa nội dung menu; họ không bị
  buộc phải mở lại đơn.

Không đổi schema `orders`.

## 6. Bảo vệ deadline tại database

Chặn bằng trigger PostgreSQL, không chỉ bằng nút disabled trên frontend. Đồng hồ database
`now()` là nguồn thời gian chính.

### 6.1 Trigger trên `orders`

Một trigger function production-safe chạy `before insert or update or delete`:

- `INSERT`: tra deadline của `NEW.menu_id`; cho phép khi deadline `null` hoặc `now() < deadline`.
- `UPDATE` nội dung: khi `item_text`, `note`, `menu_id` hoặc `user_id` thay đổi, kiểm tra deadline.
- `DELETE`: kiểm tra deadline của `OLD.menu_id`.
- Update chỉ thay `is_paid` và `paid_at` được phép sau deadline.
- `updated_at` là metadata và không bị coi là thay đổi nội dung.
- `menu_id` và `user_id` không được đổi qua update.

Khi bị chặn, trigger raise exception với message ổn định:

```text
ORDER_DEADLINE_PASSED
```

Frontend map message này thành nội dung tiếng Việt. Draft món và ghi chú phải được giữ nguyên.

### 6.2 RLS

RLS hiện tại tiếp tục có trách nhiệm riêng:

- `orders_insert with check (true)` vẫn cho đặt hộ trong nhóm tin cậy.
- `orders_update` vẫn chỉ cho chủ đơn update.
- `orders_delete` vẫn chỉ cho chủ đơn delete.
- Trigger deadline bổ sung luật thời gian, không thay thế ownership policy.
- `menus_update` vẫn chỉ cho poster chỉnh menu/deadline.

## 7. Shared domain helpers

Tách logic ra khỏi page components:

### 7.1 Structured menu

```text
parseMenuEditorDraft(note)
serializeMenuEditorDraft({ notes, dishes })
validateMenuEditorDraft(draft)
```

- Chỉ coi là structured khi JSON hợp lệ và có `dishes[]`.
- Structured menu giữ format `{ notes, dishes }`.
- Plain-text menu giữ nguyên text, không tự chuyển thành JSON.
- JSON malformed được bảo toàn; UI báo nhẹ và không tự rewrite dữ liệu.
- Giá được chuẩn hoá thành số nguyên trước khi lưu.
- Dish name rỗng là validation error.

### 7.2 Deadline

```text
getDeadlineState(deadline, now)
toDeadlineInputValue(deadline)
fromDeadlineInputValue(localValue)
buildQuickDeadline(kind, now)
isOrderContentLocked(deadline, now)
```

Các trạng thái:

- `open-unlimited`
- `open`
- `closing-soon` khi còn không quá 30 phút
- `closed`

Helper nhận `now` để unit test deterministic.

## 8. UI chỉnh sửa menu

### 8.1 Entry point

Trong mỗi card ở **Menu của tôi**:

- Xem chi tiết
- Sao chép link
- **Chỉnh sửa món**
- Xoá menu

Inline editor title/note hiện tại được thay bằng editor thống nhất để không có hai cơ chế lưu.

### 8.2 Desktop

Mở modal rộng:

- Header: eyebrow, title, trạng thái dirty/save.
- Cột trái: ảnh menu gốc, giữ nguyên tỷ lệ, click để phóng to.
- Cột phải:
  - title field;
  - deadline field;
  - `MenuBoard mode="edit"` cho structured menu;
  - `TextArea` cho plain-text menu.
- Footer: **Huỷ** và **Lưu thay đổi**.

### 8.3 Mobile

Modal trở thành full-screen sheet:

- Ảnh menu nằm trên cùng.
- Editor món hiển thị theo row/card dễ chạm.
- Action bar Huỷ/Lưu sticky ở đáy.
- Không horizontal overflow.

### 8.4 Hành vi editor

- Sửa tên, giá, category, calories, description và ghi chú chung.
- Thêm món vào category.
- Thêm/đổi tên category.
- Xoá món.
- Nút lưu disabled khi draft chưa đổi hoặc validation lỗi.
- Đóng khi dirty phải xác nhận.
- Save thành công cập nhật card tại chỗ và hiện toast.
- Save lỗi giữ nguyên editor/draft.
- Không thay `image_url`, `menu_date`, `poster_id`, orders hoặc payment state.

### 8.5 Bảo toàn đơn đã đặt khi sửa món

Orders hiện lưu món bằng từng dòng `item_text` và exact-match theo `dish.name`. Editor phải lấy
`orders(item_text, is_paid)` của menu để tính usage cho từng món.

- Món chưa xuất hiện trong đơn nào: được sửa tên, giá hoặc xoá bình thường.
- Món đã xuất hiện trong ít nhất một đơn:
  - khoá đổi tên;
  - khoá xoá;
  - vẫn sửa được category, description và calories.
- Giá của món đã được đặt:
  - nếu chưa có đơn matching nào đã trả, cho phép đổi nhưng phải xác nhận:
    `Giá mới sẽ cập nhật số tiền của X đơn chưa thanh toán`;
  - nếu có ít nhất một đơn matching đã trả, khoá giá để tránh thay đổi số tiền sau thanh toán.
- Thêm món mới và thêm/đổi tên category không ảnh hưởng đơn cũ.
- Matching dùng cùng luật exact, case-sensitive đang dùng để tính tiền.
- Editor hiển thị lý do khoá ngay cạnh field/action, không chỉ disable im lặng.

## 9. UI deadline

Tạo shared component **Hạn chót đặt món — Không bắt buộc** dùng ở:

1. Form đăng menu.
2. Editor menu sau khi đăng.

Component gồm:

- Date/time input theo giờ Việt Nam.
- Quick actions:
  - `+30 phút`
  - `+1 giờ`
  - `11:00 hôm nay`
- Nút `Bỏ giới hạn`.
- Không có deadline mặc định.
- Validation deadline phải ở tương lai.
- Quick action `11:00 hôm nay` disabled nếu mốc đó đã qua.
- Deadline quá khứ đã lưu từ trước được giữ nguyên nếu field không bị thay đổi.
- Dùng cùng `TextField`, border, spacing, typography và button variants của UI foundation.

## 10. Trải nghiệm người đặt

### 10.1 Hiển thị trạng thái

Today card, Menu detail và My Menus card hiển thị:

- `Nhận đơn đến 10:30`
- `Còn 18 phút` với accent cam khi sắp chốt
- `Đã chốt đơn lúc 10:30`

### 10.2 Khi đã chốt

- Ẩn/disable form tạo đơn.
- Không cho mở hoặc lưu editor đơn.
- Hiện:

```text
Menu đã chốt đơn.
Bạn vẫn có thể xem đơn và cập nhật thanh toán.
```

- Danh sách đơn vẫn đọc được.
- Self-tick thanh toán và QR vẫn hoạt động.
- Draft đặt món không bị xoá.
- Nếu database từ chối vì deadline vừa hết, refetch menu, giữ draft và hiện thông báo.

### 10.3 Đồng bộ thời gian

- Client cập nhật countdown/trạng thái mỗi 30 giây.
- Khi tab được focus trở lại, refetch menu để nhận deadline đã được gia hạn/bỏ ở tab khác.
- Quyết định cuối cùng vẫn thuộc trigger database.

## 11. Data flow

### Tạo menu

```text
PostMenuPage
  -> OrderDeadlineField
  -> validate local deadline
  -> createMenu({ ..., order_deadline })
  -> menus_insert RLS
```

### Sửa menu

```text
MyMenusPage
  -> MenuEditorDialog
  -> parse note into structured/plain draft
  -> edit MenuBoard + OrderDeadlineField
  -> validate + serialize
  -> updateMenu({ id, title, note, order_deadline })
  -> menus_update RLS verifies poster
```

### Đặt/sửa đơn

```text
MenuPage checks local deadline
  -> createOrder/updateOrder
  -> orders RLS verifies actor/owner rules
  -> database trigger verifies server-side deadline
  -> success or ORDER_DEADLINE_PASSED
```

## 12. Error handling

- Parse lỗi: giữ raw note, cảnh báo không phá dữ liệu.
- Validation món: chỉ rõ món/category lỗi.
- Deadline mới được chọn nằm trong quá khứ: chặn save tại form; deadline cũ đã qua nhưng không
  thay đổi vẫn được giữ nguyên.
- Save menu lỗi: giữ draft, cho retry.
- Deadline vừa hết lúc submit: giữ order draft và refetch.
- Mạng lỗi: không đổi local menu/order state thành success.
- Payment update sau deadline không bị hiển thị nhầm là order-content error.

## 13. Testing

### Unit

- Parse/serialize structured note round-trip.
- Plain text và malformed JSON được bảo toàn.
- Thêm/sửa/xoá dish/category.
- Dish name rỗng và price normalization.
- Khoá rename/delete với món đã được đặt.
- Price confirmation cho món có đơn chưa trả và price lock khi có đơn đã trả.
- Deadline state ở trước, đúng và sau mốc.
- Quick actions theo giờ Việt Nam.

### Component/page

- Owner thấy nút edit; người khác không thấy.
- Structured menu dùng MenuBoard editor.
- Plain menu dùng TextArea.
- Editor giải thích trạng thái lock của món đã đặt/đã thanh toán.
- Dirty/cancel/save/error flows.
- Deadline create/edit/clear flows.
- Closed menu khoá order form và order edit.
- Payment toggle vẫn dùng được.
- Draft không mất khi deadline rejection.

### RLS/database

- Insert trước deadline thành công, sau deadline thất bại.
- Content update trước deadline thành công, sau deadline thất bại.
- Delete sau deadline thất bại.
- Payment-only update sau deadline thành công.
- Null deadline giữ hành vi hiện tại.
- Poster có thể gia hạn hoặc clear deadline.
- Người khác không update được menu/deadline.

### Browser QA

- Desktop 1280px và mobile 390px.
- Modal/sheet không overflow.
- Ảnh gốc không crop.
- Sticky actions không che row cuối.
- Countdown đổi trạng thái đúng.
- Console không có application error.

## 14. Acceptance criteria

1. Không còn yêu cầu người dùng sửa JSON cho menu OCR hợp lệ.
2. Chỉ poster chỉnh được menu và deadline.
3. Menu text vẫn hoạt động như cũ.
4. Deadline là tuỳ chọn và menu cũ không bị khoá.
5. Sau deadline, database chặn mọi order content mutation.
6. Thanh toán vẫn cập nhật được sau deadline.
7. Poster có thể gia hạn hoặc bỏ deadline để mở lại.
8. Draft order không mất khi deadline vừa hết.
9. Sửa menu không làm mất exact-match hoặc thay giá của đơn đã thanh toán.
10. Editor và deadline field đồng bộ UI foundation trên desktop/mobile.
11. Không thêm backend riêng, secret key hay role admin.

# Lunch Domain and Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Parallel execution only when chosen by the user. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bổ sung số liên hệ lưu một lần, đăng ký nhận cơm, chốt có phân công/giá cố định, được mời và lưu trữ menu.

**Architecture:** Postgres chịu trách nhiệm quyền, ràng buộc và giao dịch chốt; Vue hiển thị qua composable. Liên hệ riêng tư tách profile; dữ liệu công khai trong nhóm tách snapshot điện thoại. Mỗi lần chốt có revision giữ lịch sử đối soát.

**Tech Stack:** Vue 3, Clerk JWT text ID, Supabase RLS/RPC, Vitest, PGlite và PostgreSQL local cho concurrency.

**Spec:** [Thiết kế](../specs/2026-10-29-slack-delivery-and-sponsor-proposal.md). **Depends on:** Task 0 của [rollout](2026-10-29-lunch-rollout.md).

## Global Constraints

- Áp dụng toàn bộ Global Constraints và quy trình commit của rollout. Giữ free tier, frontend static, self-tick; không service_role/backend mới.
- Ngày VN; số điện thoại chỉ chính chủ và chủ menu có nhu cầu điều phối được đọc. Người được đặt hộ tự đồng ý nhận.
- Đơn cũ không bị đổi thanh toán/quán/giá. Giá không biết là null. Mọi tên API dưới đây là hợp đồng dùng trong các kế hoạch sau.
- Migration tạo bằng Supabase CLI, đọc `--help` trước; ghi filename/version trả về vào release manifest, không tự đặt timestamp. Đừng sửa migration đã từng áp dụng. Tách ba migration theo task D1/D2/D3 để mỗi commit chạy độc lập. RPC dùng SECURITY INVOKER, search_path cố định, revoke EXECUTE của PUBLIC/anon và chỉ grant cho authenticated; RLS vẫn kiểm actor trong từng thao tác.

## Task D1: Liên hệ và khả năng nhận theo ngày

**Files:** tạo migration bằng `rtk proxy npx supabase migration new lunch_pickup_contacts`; tạo `shared/pickup.js`, `shared/pickup.d.ts`, `tests/unit/pickup.test.js`, `tests/database/pickup.sql`; sửa `tests/database/run-embedded.mjs`, `tests/database/run-local.sh` để chạy migration mới và fixture mới đúng thứ tự.

**Interfaces:** `normalizePickupPhone(input): string` trả E.164 hoặc throw; `choosePickupCandidate(candidates, randomIndex): candidate|null`, candidate `{userId,receivedCount}`, chỉ random trong nhóm có receivedCount thấp nhất. `randomIndex(upperExclusive)` được inject vào test; production dùng crypto với rejection sampling.

- [ ] Viết test trước:

```js
import { expect, test } from 'vitest'
import { normalizePickupPhone, choosePickupCandidate } from '../../shared/pickup.js'
test('normalizes once-saved VN contact', () => {
  expect(normalizePickupPhone('090 123 4567')).toBe('+84901234567')
  expect(normalizePickupPhone('+84 901234567')).toBe('+84901234567')
  expect(() => normalizePickupPhone('123')).toThrow()
})
test('picks unique least-used volunteers', () => {
  expect(choosePickupCandidate([{userId:'a',receivedCount:2},{userId:'b',receivedCount:0}], () => 0).userId).toBe('b')
  expect(choosePickupCandidate([], () => 0)).toBeNull()
})
```

- [ ] Chạy `rtk proxy npm run test:unit -- tests/unit/pickup.test.js`, xác nhận thiếu module trước khi implement. Hàm chuẩn hóa bỏ space/dấu phân cách thông dụng, chuyển số 0 đầu sang +84, kiểm `^\+84[35789][0-9]{8}$`; cùng quy tắc check ở SQL. Không thêm xác minh OTP.
- [ ] Migration tạo `pickup_contacts(user_id text PK references profiles, phone_e164 text not null, updated_at timestamptz)` và `pickup_availability(user_id text, menu_date date, available boolean, updated_at timestamptz, PK(user_id,menu_date))`. Khả năng nhận có bản ghi false để không hỏi lại trong cùng ngày.
- [ ] RLS: self insert/update; không đổi user_id. Availability đọc bởi self hoặc poster của menu cùng ngày có đơn của user đó. Contact đọc bởi self hoặc poster có user đã đồng ý, có đơn trong menu mình; sau chốt dùng quyền qua phân công đang hoạt động. Không SELECT cho anon; không đưa contact vào `profiles`/presence/nested menu public.
- [ ] Tạo RPC invoker `save_pickup_preferences(p_date date,p_available boolean,p_phone text default null)` trong một transaction. Không có p_phone thì giữ số cũ; available=true mà không có số hợp lệ phải từ chối. Có thể lưu số nhưng chỉ đổi available theo ngày yêu cầu. Tạo `update_pickup_phone(p_phone text)` cho chính chủ; task D1 chỉ cập nhật pickup_contacts. D3 sẽ mở rộng function này để đồng bộ snapshot sau khi bảng phân công đã tồn tại, kể cả menu đã chốt; lượt đã nhận giữ lịch sử.
- [ ] Fixture SQL test A không sửa số/consent B; đặt hộ không tạo consent B; số lưu dùng ngày sau không nhập lại; C không đọc số B; A chỉ đọc số B nếu điều kiện điều phối thỏa; đổi số không sửa món/is_paid. Test helper `public.test_assert`/`public.test_rejected` đã có trong `checks.sql`.
- [ ] Chạy unit và `test:db`, inspect RLS không recursion, commit `feat: save pickup contacts and daily availability` theo quy trình rollout.

## Task D2: Bữa được mời và hợp đồng tài chính dùng chung

**Files:** tạo migration bằng `rtk proxy npx supabase migration new lunch_sponsorship_and_finance`; tạo `shared/lunch-finance.js`, `shared/lunch-finance.d.ts`, `tests/unit/lunch-finance.test.js`, `tests/database/finance.sql`; sửa `src/lib/manage-summary.js`, `src/composables/useMenus.js`, `src/composables/useOrders.js`, `src/composables/useDashboard.js` và các call site tiền sau khi grep/impact.

**Interfaces:** `orderSettlement(menu,order,closureItems)` trả `{vendorAmount:number|null,amountDue:number|null,paymentState:'paid'|'unpaid'|'sponsored',priceSource:'frozen'|'current'|'legacy_unknown'}`. `isOutstanding(menu,order)` chỉ true khi mode self và !is_paid. Excel/QR/ledger/statistics dùng hai helper này.

- [ ] Viết test: sponsored có vendorAmount 35000, amountDue=0, state sponsored dù is_paid=false; tự trả giá null vẫn là khoản chưa trả chưa rõ tiền; item 0 là giá đã biết; giá của closure không đổi khi menu đổi giá; đơn legacy closed không có snapshot không được ghi là giá chốt lịch sử.

```js
expect(orderSettlement({payment_mode:'sponsored'}, {is_paid:false}, [{unit_price:35000}]))
  .toMatchObject({vendorAmount:35000,amountDue:0,paymentState:'sponsored'})
expect(isOutstanding({payment_mode:'sponsored'}, {is_paid:false})).toBe(false)
```

- [ ] Migration add `menus.payment_mode text not null default 'self' check in ('self','sponsored')`, `sponsor_user_id text nullable FK profiles`, `sponsor_reason text <=240`, `archived_at timestamptz`. Sponsored phải sponsor=poster; chỉ poster chuyển mode trước khi có đơn. Đơn cũ default self; không update is_paid/paid_at.
- [ ] Giữ RPC `save_lunch_menu` cũ để client cũ còn gọi được; thêm `save_lunch_menu_v2(p_id uuid default null,p_title text default '',p_menu_date date default (clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date,p_note text default null,p_restaurant_id uuid default null,p_image_url text default null,p_payment_mode text default null,p_sponsor_reason text default null)` trả row menus. Function invoker gọi save cũ và cập nhật mode/reason trong cùng transaction; p_payment_mode=null giữ mode cũ khi sửa, default self khi tạo. Sponsor tự lấy poster, không nhận sponsor ID tùy ý từ client. useMenus.createMenu/updateMenu truyền payment_mode/reason vào v2 và vẫn cleanup image nếu toàn transaction lỗi.
- [ ] Tạo `menu_closures(id uuid PK,menu_id uuid,revision integer,closed_by text,closed_at timestamptz,payment_mode text,sponsor_user_id text,unique(menu_id,revision))` và `closure_items(closure_id uuid,order_item_id uuid,order_id uuid,user_id text,name_snapshot text,unit_price integer nullable,PK(closure_id,order_item_id))`. Metadata closure read authenticated; insert chỉ poster trong transaction chốt; chặn sửa/xóa snapshot qua Data API/trigger. Không lưu phone vào hai bảng này.
- [ ] `menus.current_closure_id` nullable FK. Menu đang mở dùng giá hiện tại; sau chốt đọc current closure, không fallback giá hiện tại cho unit_price=null của snapshot. Đơn legacy đã chốt trước release không backfill giá giả; hiển thị chưa có giá chốt, giữ bản ghi cũ. Giá known dùng exact menu item ID hoặc unique exact name cho text, không lowercase/fuzzy đoán giá.
- [ ] Đồng bộ toàn bộ ledger/dashboard/history/QR/OrderCard/OrderConfirmDialog/ManagePayments và CSV; query listPostedUnpaidOrders lọc `menu.payment_mode=self` ngay trên DB để count/phân trang không gồm sponsored. Giữ vendor cost riêng số người ăn phải trả trong thống kê: được mời không nhắc nợ, không mở nút trả tiền; self giữ chủ đơn tự tick sau chốt. Không xóa payment status gốc của bản ghi cũ.
- [ ] `test:db` so sánh toàn bộ ID/user_id/item_text/note/is_paid/paid_at/profile payment_info trước/sau migration. Test cả structured match, unmatched, duplicate JSON và plain text. Unit helper, build, commit `feat: separate sponsored meals and frozen settlement values`.

## Task D3: Giao dịch chốt, người nhận, dự phòng và lưu trữ

**Files:** tạo migration bằng `rtk proxy npx supabase migration new lunch_close_and_pickup`; tạo `tests/database/close-pickup.sql`, `tests/database/close-concurrency.sql`; sửa `src/composables/useMenus.js`; tạo `src/composables/usePickup.js`.

**Interfaces SQL:** `list_pickup_candidates(p_menu_id uuid)` trả user_id/name, available, last_received_at, received_count 30 ngày tính theo số menu_id đã nhận khác nhau và phone chỉ cho poster; `close_lunch_menu(p_menu_id uuid,p_expected_revision integer,p_primary_user_id text,p_backup_user_id text default null)` trả `{menu_id,closure_id,revision,pickup_id}`; `reopen_lunch_menu(p_menu_id uuid,p_expected_revision integer)`; `activate_pickup_backup(p_pickup_id uuid,p_expected_version integer)`; `mark_lunch_received(p_pickup_id uuid)`; `archive_lunch_menu(p_menu_id uuid)`.

- [ ] Thêm `menu_pickups(id uuid PK,closure_id uuid unique,menu_id uuid,primary_user_id text,backup_user_id text,version integer,status text,received_at timestamptz)` chứa danh tính công khai trong nhóm, không phone. `menu_pickup_contacts(pickup_id uuid,user_id text,phone_e164 text,PK(pickup_id,user_id))` chỉ subject và poster đọc; không cho backup đọc số của primary. Trigger guard snapshot chỉ sửa liên hệ đang hoạt động bởi RPC của chính chủ, hoàn tất thì immutable.
- [ ] Viết SQL rejected writes: B không chốt menu A; primary phải có consent đúng ngày, số hợp lệ và có đơn trong menu; dedup user; backup khác primary; menu không ứng viên chỉ poster được tự nhận và phải có số/đồng ý rõ ràng. Endpoint không nhận phone/name/giá từ client để ghi snapshot.
- [ ] Chốt atomically: lock menu theo thứ tự advisory lock thống nhất với catalog/orders hiện có → row lock → kiểm poster/revision → kiểm candidate mới nhất → tạo closure và giá → lưu pickup/contact snapshots → is_closed=true/current_closure_id. Giá/order list đọc sau khóa để gồm đơn vừa commit trước chốt; refetch sau commit. Direct update is_closed từ frontend cũ cũng phải qua guard/trigger tạo snapshot tài chính; lưu pickup trạng thái unassigned nếu client cũ không truyền người nhận, để không làm hỏng luồng chuyển phiên bản. RPC/UI mới yêu cầu phân công hợp lệ; không phát tin tag từ pickup unassigned. Không để đường bypass ghi đóng nhưng thiếu snapshot. Không hồi tố giả giá cho menu legacy đã đóng.
- [ ] Reopen không xóa closure/pickup. Chốt lại sinh revision mới, giữ lịch sử; UI điền lại người nhận cũ, không random lại nếu không bấm. Ngăn edit giá/note/mode sau chốt bằng DB, không chỉ UI. Khi mở lại có đổi giá, lần chốt mới hiển thị đối chiếu revision; bản chốt trước không bị sửa.
- [ ] Mở rộng `update_pickup_phone` từ D1: sau lưu contact, cập nhật các dòng menu_pickup_contacts của chính user ở lượt status chưa received, không đụng món/is_paid/closure_items; dùng chung khóa với close để không chốt số cũ khi update vừa commit.
- [ ] `mark_lunch_received` chỉ primary hiện tại hoặc poster; idempotent, lưu thời điểm server. Backup chỉ thành primary sau RPC activate có poster và expected version; sự kiện Slack chỉ tag primary mới. Dùng một timestamp nhận cho fairness, không đếm lại mỗi revision đóng/mở cùng lượt giao đã nhận.
- [ ] Archive menu có đơn, lọc khỏi Today mặc định nhưng giữ history/ledger/reviews. DB từ chối delete menu có đơn kể cả đã trả; menu rỗng vẫn xóa được. Archive không làm biến mất khoản chưa thu hoặc thay đổi paid status; không xóa ảnh Storage của menu đang lưu trữ.
- [ ] Test concurrency native PostgreSQL ít nhất hai kết nối: order insert vs close, hai close cùng revision, đổi consent/phone vs close. Nếu native unavailable, ghi rõ chưa chứng minh concurrency và chưa cho phát hành phần chốt chỉ bằng PGlite. Kiểm self-pay sau chốt vẫn pass. Commit `feat: close menus atomically with pickup and financial revisions`.

## Task D4: Giao diện người đặt và người đăng

**Files:** tạo `src/components/PickupPreferenceForm.vue`, `src/components/MenuPickupPanel.vue`, `src/components/CloseMenuDialog.vue`, `src/components/SponsorshipField.vue`; sửa `src/pages/MenuPage.vue`, `src/pages/ManagePage.vue`, `src/pages/PostMenuPage.vue`, `src/components/OrderConfirmDialog.vue`, `src/components/OrderOnBehalfDialog.vue`, `src/components/MenuEditor.vue`, `src/components/ui/OrderSummaryPanel.vue`, `src/pages/HistoryPage.vue`, `src/components/OrderCard.vue`.

**Interfaces JS:** `usePickup()` cung cấp `getMyPickupPreferences(date)`, `savePickupPreferences({date,available,phone})`, `updatePickupPhone(phone)`, `listPickupCandidates(menuId)`, `activateBackup({pickupId,version})`, `markReceived(pickupId)`. `useMenus().setMenuClosed` dùng close/reopen RPC và trả closure result; `CloseMenuDialog` phát confirm `{primaryUserId,backupUserId,expectedRevision}`.

- [ ] Form xác nhận chỉ hiện câu hỏi nếu chưa có availability ngày đó. Chọn có và có contact thì hiển thị số đã lưu cùng Đổi số, không mở lại input bắt buộc; chọn không không yêu cầu phone. Trong MenuPickupPanel luôn có Đổi số cho chính chủ. Save phone lỗi giữ input/đơn nháp; đổi tài khoản hủy phản hồi cũ.
- [ ] Lưu order trước hoặc cùng xử lý preference có trạng thái rõ ràng: order đã lưu nhưng preference lỗi không báo order thất bại để tạo trùng. Giao diện cho retry riêng preference; đặt hộ C chỉ hỏi khả năng nhận của chính người đang thao tác nếu họ chủ động đăng ký, không ghi availability C.
- [ ] Dialog chốt hiện candidates, số lần nhận, Bốc thăm/Chọn thủ công/Backup, kiểm không trùng. Không ứng viên có nút “Tôi nhận” của poster hoặc quay lại; không tự chọn người không đồng ý. Confirm gửi expected revision, conflict refetch/giữ lựa chọn còn hợp lệ, không tự chốt lại.
- [ ] Sau chốt hiện tên primary, liên hệ chỉ đúng quyền, Đã nhận cơm, đổi số và kích hoạt dự phòng đúng actor. Mở lại không tự random. Lưu trạng thái nghiệp vụ thành công trước mọi dispatch Slack; D4 không import Worker trực tiếp, phát event để kế hoạch Slack nối vào.
- [ ] Post có self/sponsored + reason; sửa mode khóa khi có đơn. QR/paid button ẩn với sponsored; các trạng thái self không đổi. Archive menu dùng nhãn “Lưu trữ”, giải thích vẫn giữ lịch sử/công nợ.
- [ ] Browser fixture hai user, ngày hôm sau, mobile, ESC/focus dialog, network fail sau order commit, đổi account giữa RPC. Unit/DB/build, docs và changelog, commit `feat: add pickup coordination and sponsored menu flows`.

## Bàn giao

Ghi actual migration paths và RPC signatures vào `docs/architecture/api.md`/data-model.md. Chuyển cho Slack các mutation result `{menu_id,closure_id,revision,pickup_id}`; Excel dùng `orderSettlement` và closure_items, không tự tính lại tiền.

# Owner Menu Editor and Order Deadline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép người đăng chỉnh sửa menu OCR bằng giao diện trực quan và đặt deadline tuỳ chọn để khoá nội dung đơn sau giờ chốt, đồng bộ Warm Paper UI trên desktop/mobile.

**Architecture:** Giữ quyền owner-only hiện tại (`poster_id`/`user_id` + Clerk JWT subject), tách parser/serializer menu và deadline state thành các helper thuần để test deterministic, rồi dùng một `MenuEditorDialog` và `OrderDeadlineField` dùng chung cho tạo/sửa. Deadline được kiểm tra ở client để UX rõ ràng và ở PostgreSQL trigger để không thể bypass bằng gọi Supabase trực tiếp. Không thêm backend riêng, role admin hay thay đổi contract đặt hộ/self-tick.

**Tech Stack:** Vue 3 + Vite, Vitest, Supabase Postgres/RLS, Clerk, Flatpickr hiện có, CSS tokens Warm Paper, Supabase local RLS test harness.

## Global Constraints

- Chỉ người đăng menu được sửa menu/deadline; không thêm role `admin`.
- Deadline là tuỳ chọn; `null` nghĩa là không giới hạn và menu cũ phải tiếp tục hoạt động.
- Deadline áp dụng cho mọi người, kể cả người đăng; có thể gia hạn hoặc xoá để mở lại.
- Sau deadline chặn tạo/sửa/xoá nội dung đơn; update chỉ `is_paid`/`paid_at` vẫn được phép.
- RLS hiện tại phải giữ: `orders_insert with check (true)` cho đặt hộ, `orders_update` chỉ chủ đơn, `menus_update` chỉ poster.
- Không thêm backend, service-role key vào client, webhook, runtime image tool, hoặc migration role.
- Structured menu giữ format `{ notes, dishes }`; plain text không tự chuyển thành JSON.
- Ảnh menu gốc chỉ xem để đối chiếu; không thay `image_url`, crop hoặc ép tỉ lệ.
- Hiển thị/nhập deadline theo `Asia/Ho_Chi_Minh` (UTC+7), quyết định cuối cùng dùng `now()` của database.
- Trước mỗi commit: cập nhật `src/changelog.json`, chạy `gitnexus_detect_changes(scope: "staged")`, `git diff --cached --check`.
- Trước sửa function/class/method hiện hữu: chạy GitNexus upstream impact; HIGH/CRITICAL phải dừng để review.

---

## File Map

- `src/lib/menuEditor.js`: parse/serialize/validate structured và plain menu drafts.
- `src/lib/orderDeadline.js`: deadline conversion, quick actions, state/countdown helpers.
- `src/components/ui/OrderDeadlineField.vue`: field datetime + quick actions, Warm Paper styles.
- `src/components/ui/MenuEditorDialog.vue`: owner editor shell, dirty/save/error state, original image, MenuBoard/TextArea.
- `src/components/ui/MenuBoard.vue`: lock rename/delete/price actions for already-ordered dishes.
- `src/components/ui/index.js`: export shared components.
- `src/composables/useMenus.js`: include `order_deadline`, ordered item metadata, update payload.
- `src/composables/useOrders.js`: preserve current ownership calls; export `isDeadlineError(error)`.
- `src/pages/PostMenuPage.vue`: create deadline field and payload.
- `src/pages/MyMenusPage.vue`: replace inline title/note editor with shared editor dialog.
- `src/pages/MenuPage.vue`: lock order form/order edit after deadline; keep payment actions.
- `src/pages/TodayPage.vue`: show deadline state on today menu cards.
- `src/changelog.json`: user-facing bullets per commit.
- `supabase/migrations/0004_menu_order_deadline.sql`: nullable deadline column and order enforcement trigger.
- `tests/ui/lib/menu-editor.test.js`: parser/serializer/validation.
- `tests/ui/lib/order-deadline.test.js`: deterministic deadline helpers.
- `tests/ui/components/order-deadline-field.test.js`: field/quick-action UI.
- `tests/ui/components/menu-editor-dialog.test.js`: draft/owner/lock/save states.
- `tests/ui/pages/menu-deadline.test.js`: page integration states.
- `tests/rls/orders.test.js`, `tests/rls/menus.test.js`: database deadline and ownership coverage.

---

### Task 1: Add pure menu editor and deadline domain helpers

**Files:**
- Create: `src/lib/menuEditor.js`
- Create: `src/lib/orderDeadline.js`
- Create: `tests/ui/lib/menu-editor.test.js`
- Create: `tests/ui/lib/order-deadline.test.js`
- Modify: `src/changelog.json`

**Interfaces:**

```js
parseMenuEditorDraft(note) // -> { kind: 'structured', notes, dishes } | { kind: 'plain', text } | { kind: 'invalid', raw }
serializeMenuEditorDraft(draft) // -> string | null
validateMenuEditorDraft(draft) // -> { valid: boolean, error: string | null }
getOrderedDishUsage(dishes, orders) // -> { orderedNames: Set<string>, paidNames: Set<string>, counts: Map<string, number> }
```

```js
getDeadlineState(deadline, now = new Date()) // -> { kind, remainingMs, label, isLocked }
toDeadlineInputValue(deadline, timezone = 'Asia/Ho_Chi_Minh') // -> 'YYYY-MM-DDTHH:mm' | ''
fromDeadlineInputValue(value, timezone = 'Asia/Ho_Chi_Minh') // -> ISO string | null
buildQuickDeadline(kind, now = new Date()) // -> ISO string | null
isOrderContentLocked(deadline, now = new Date()) // -> boolean
```

- [ ] **Step 1: Write failing parser tests.**

```js
it('round-trips structured OCR notes without losing fields', () => {
  const draft = parseMenuEditorDraft(JSON.stringify({
    notes: 'Ít cay',
    dishes: [{ name: 'Cơm gà', price: 45000, category: 'Món chính' }],
  }))
  expect(draft.kind).toBe('structured')
  expect(serializeMenuEditorDraft(draft)).toBe(
    '{"notes":"Ít cay","dishes":[{"name":"Cơm gà","price":45000,"category":"Món chính"}]}',
  )
})

it('keeps plain text and malformed JSON distinguishable', () => {
  expect(parseMenuEditorDraft('Cơm tấm - 40k')).toEqual({
    kind: 'plain',
    text: 'Cơm tấm - 40k',
  })
  expect(parseMenuEditorDraft('{"dishes":')).toEqual({
    kind: 'invalid',
    raw: '{"dishes":',
  })
})

it('validates names and normalizes prices', () => {
  const result = validateMenuEditorDraft({
    kind: 'structured',
    notes: '',
    dishes: [{ name: '  Cơm gà ', price: '45.000đ', category: 'Món chính' }],
  })
  expect(result).toEqual({ valid: true, error: null })
})
```

- [ ] **Step 2: Run RED.**

Run `npx vitest run tests/ui/lib/menu-editor.test.js`.

Expected: fail because `src/lib/menuEditor.js` does not exist.

- [ ] **Step 3: Implement helpers without page dependencies.**

`parseMenuEditorDraft` must accept only a parsed object whose `dishes` is an array; `serializeMenuEditorDraft` must JSON.stringify `{ notes, dishes }`; `validateMenuEditorDraft` must reject an empty/whitespace dish name and non-finite/negative price, while leaving plain text unchanged. `getOrderedDishUsage` must split each `order.item_text` on newlines, use exact case-sensitive names, and count paid/unpaid matches.

- [ ] **Step 4: Write deadline tests.**

```js
const base = new Date('2026-07-23T03:00:00.000Z') // 10:00 VN

it('returns unlimited/open/closing-soon/closed states', () => {
  expect(getDeadlineState(null, base).kind).toBe('open-unlimited')
  expect(getDeadlineState('2026-07-23T04:00:00.000Z', base).kind).toBe('open')
  expect(getDeadlineState('2026-07-23T03:20:00.000Z', base).kind).toBe('closing-soon')
  expect(getDeadlineState('2026-07-23T02:59:00.000Z', base).kind).toBe('closed')
})

it('builds quick deadlines in UTC for VN display', () => {
  expect(buildQuickDeadline('plus-30m', base)).toBe('2026-07-23T03:30:00.000Z')
  expect(buildQuickDeadline('plus-1h', base)).toBe('2026-07-23T04:00:00.000Z')
})

it('round-trips local datetime input', () => {
  const iso = fromDeadlineInputValue('2026-07-23T10:30')
  expect(toDeadlineInputValue(iso)).toBe('2026-07-23T10:30')
})
```

- [ ] **Step 5: Run RED, implement, and run GREEN.**

Run `npx vitest run tests/ui/lib/order-deadline.test.js`; implement with `Intl.DateTimeFormat`/explicit UTC+7 conversion, then rerun both helper files. `getDeadlineState` must return `remainingMs = 0` for closed and `label` suitable for UI copy.

- [ ] **Step 6: Update changelog, inspect, commit.**

Append `"Tách riêng logic chỉnh sửa menu OCR và trạng thái hạn chót đặt món"` to the current 2026-07-23 entry. Stage only helper/test/changelog files, run GitNexus staged detection, then commit:

```bash
git add src/lib/menuEditor.js src/lib/orderDeadline.js tests/ui/lib/menu-editor.test.js tests/ui/lib/order-deadline.test.js src/changelog.json
git commit -m "feat: add menu editor and deadline domain helpers"
```

---

### Task 2: Add nullable deadline column and database enforcement

**Files:**
- Create: `supabase/migrations/0004_menu_order_deadline.sql`
- Modify: `tests/rls/menus.test.js`
- Modify: `tests/rls/orders.test.js`
- Modify: `src/changelog.json`

**Interfaces:**

```sql
menus.order_deadline timestamptz null
public.enforce_order_deadline() trigger
```

- [ ] **Step 1: Run GitNexus impact for existing RLS test symbols and inspect migration ordering.**

Run impact on the existing test describes only if editing helper functions; migration work itself has no JS symbol. Confirm `0003_prod_safe.sql` is the baseline and `0004` is applied after it.

- [ ] **Step 2: Add failing RLS cases before migration.**

Extend `tests/rls/orders.test.js` with an `expiredMenu` fixture and assertions:

```js
it('chặn tạo đơn sau deadline', async () => {
  const { error } = await asUser(USER_B).from('orders').insert({
    menu_id: expiredMenu.id,
    user_id: USER_B,
    item_text: 'Bún bò',
  })
  expect(error?.message).toContain('ORDER_DEADLINE_PASSED')
})

it('cho phép self-tick thanh toán sau deadline nhưng chặn sửa món', async () => {
  const paid = await asUser(USER_A).from('orders')
    .update({ is_paid: true, paid_at: new Date().toISOString() })
    .eq('id', expiredOrder.id)
  expect(paid.error).toBeNull()

  const edited = await asUser(USER_A).from('orders')
    .update({ item_text: 'Món khác' })
    .eq('id', expiredOrder.id)
  expect(edited.error?.message).toContain('ORDER_DEADLINE_PASSED')
})
```

Also add delete-after-deadline rejection, null-deadline success, poster update/clear deadline, and other-user update rejection.

- [ ] **Step 3: Run RED against local Supabase.**

Run `supabase db reset` then `npm test`. Expected: new deadline tests fail because column/trigger do not exist.

- [ ] **Step 4: Create migration.**

Use `alter table menus add column if not exists order_deadline timestamptz;` and create/replace a trigger function that:

1. Rejects `menu_id`/`user_id` changes.
2. On `UPDATE`, returns immediately when only `is_paid`, `paid_at`, and `updated_at` changed.
3. Selects the relevant menu deadline using `coalesce(NEW.menu_id, OLD.menu_id)`.
4. Raises `exception using message = 'ORDER_DEADLINE_PASSED'` when deadline is non-null and `now() >= deadline`.
5. Returns `NEW` for insert/update and `OLD` for delete.

Attach `before insert or update or delete on public.orders`.

- [ ] **Step 5: Run GREEN RLS tests.**

Run `supabase db reset && npm test`; expected all existing plus new RLS tests pass. Verify migration is idempotent by running reset twice.

- [ ] **Step 6: Update changelog, stage, detect, commit.**

Append `"Cơ sở dữ liệu tự chặn đơn mới và sửa đơn sau hạn chót"`; run `gitnexus_detect_changes(scope: "staged")`, then:

```bash
git add supabase/migrations/0004_menu_order_deadline.sql tests/rls/menus.test.js tests/rls/orders.test.js src/changelog.json
git commit -m "feat: enforce order deadlines in postgres"
```

---

### Task 3: Extend menu/order composables and payload contracts

**Files:**
- Modify: `src/composables/useMenus.js`
- Modify: `src/composables/useOrders.js`
- Create: `tests/ui/composables/use-menus-deadline.test.js`
- Create: `tests/ui/composables/use-orders-deadline.test.js`
- Modify: `src/changelog.json`

**Interfaces:**

```js
createMenu({ title, menu_date, note, imageFile, order_deadline = null })
updateMenu({ id, title, note, order_deadline = null })
listMyMenus() // orders select must include item_text,is_paid
isDeadlineError(error) // -> boolean
```

- [ ] **Step 1: Run GitNexus upstream impact on `createMenu`, `updateMenu`, `listMyMenus`, `createOrder`, `updateOrder`, `togglePaid`.**

Record callers in PostMenuPage, MyMenusPage, MenuPage and stop only for HIGH/CRITICAL.

- [ ] **Step 2: Add failing composable contract tests.**

Mock `useSupabaseClient` with a chainable `from().insert/update/select/single` object and assert:

```js
expect(insertPayload).toMatchObject({ order_deadline: '2026-07-23T04:00:00.000Z' })
expect(updatePayload).toMatchObject({ order_deadline: null })
expect(selectColumns).toContain('orders(item_text, is_paid)')
```

- [ ] **Step 3: Implement minimal payload/query changes.**

Pass `order_deadline` through create/update; do not alter `poster_id`, user ownership, or image upload behavior. Change only `listMyMenus` nested order projection from `orders(id, is_paid)` to `orders(id, item_text, is_paid)`. Keep `createOrder`, `updateOrder`, and `togglePaid` signatures unchanged. Export `isDeadlineError(error)` that returns true only when `error?.message === 'ORDER_DEADLINE_PASSED'`.

- [ ] **Step 4: Run focused GREEN tests.**

Run `npx vitest run tests/ui/composables/use-menus-deadline.test.js tests/ui/composables/use-orders-deadline.test.js`.

- [ ] **Step 5: Update changelog, detect, commit.**

Append `"Đồng bộ payload tạo/sửa menu với hạn chót đặt món"`; stage only Task 3 files, run staged detect, commit:

```bash
git add src/composables/useMenus.js src/composables/useOrders.js tests/ui/composables/use-menus-deadline.test.js tests/ui/composables/use-orders-deadline.test.js src/changelog.json
git commit -m "feat: pass menu order deadlines through composables"
```

---

### Task 4: Build shared deadline field and owner editor shell

**Files:**
- Create: `src/components/ui/OrderDeadlineField.vue`
- Create: `src/components/ui/MenuEditorDialog.vue`
- Modify: `src/components/ui/MenuBoard.vue`
- Modify: `src/components/ui/index.js`
- Create: `tests/ui/components/order-deadline-field.test.js`
- Create: `tests/ui/components/menu-editor-dialog.test.js`
- Modify: `src/changelog.json`

**Interfaces:**

```vue
<OrderDeadlineField
  v-model="draft.order_deadline"
  :original-value="menu.order_deadline"
  :now="now"
/>

<MenuEditorDialog
  :menu="menu"
  :orders="menu.orders"
  :open="editingId === menu.id"
  :saving="saving"
  :error="saveError"
  @close="cancel"
  @save="saveMenuDraft"
/>
```

- [ ] **Step 1: Run GitNexus impact on `MenuBoard` edit methods and inspect existing modal CSS before edits.**

Impact `startEdit`, `saveEdit`, `removeDish`, `addDishInGroup`, `addNewGroup`; warn on HIGH/CRITICAL.

- [ ] **Step 2: Write failing component tests.**

Cover:

```js
it('shows quick deadline actions and emits ISO value', async () => {
  const wrapper = mount(OrderDeadlineField, { props: { modelValue: null, now: fixedNow } })
  await wrapper.get('[data-testid="deadline-plus-30m"]').trigger('click')
  expect(wrapper.emitted('update:modelValue')[0][0]).toBe('2026-07-23T03:30:00.000Z')
})

it('locks rename/delete for ordered dishes and locks paid price', () => {
  const wrapper = mount(MenuEditorDialog, { props: { menu, orders, open: true } })
  expect(wrapper.get('[data-testid="dish-name-0"]').attributes('disabled')).toBeDefined()
  expect(wrapper.get('[data-testid="dish-remove-0"]').attributes('disabled')).toBeDefined()
  expect(wrapper.get('[data-testid="dish-price-0"]').attributes('disabled')).toBeDefined()
})

it('keeps plain text menus in TextArea mode', () => {
  const wrapper = mount(MenuEditorDialog, { props: { menu: { note: 'Cơm tấm - 40k' }, orders: [], open: true } })
  expect(wrapper.find('[data-testid="menu-editor-plain-note"]').exists()).toBe(true)
  expect(wrapper.find('.menu-board').exists()).toBe(false)
})
```

- [ ] **Step 3: Implement `OrderDeadlineField`.**

Use a native `datetime-local` control for reliable mobile input, the existing `TextField` visual classes, quick-action buttons, `clear` button, labels/hints, and a future-value error. Preserve an unchanged past `original-value`; reject only newly changed past values.

- [ ] **Step 4: Extend `MenuBoard` lock props and events.**

Add props `lockedDishNames`, `lockedPriceNames`, `orderedCounts`. Disable only the matching name/remove/price controls; allow category/description/calories edits. For an unpaid ordered dish price change, call `window.confirm` with the exact affected-order count before emitting update. For a paid ordered dish, do not enter price edit. Add `data-testid` attributes for tests and keep view mode unchanged.

- [ ] **Step 5: Implement `MenuEditorDialog`.**

On open, clone title/deadline and parse note with `parseMenuEditorDraft`; collect ordered/paid names with `getOrderedDishUsage`; use `MenuBoard mode="edit"` for structured or `TextArea` for plain. Track initial serialized payload for dirty state, validate before emit, preserve original image preview, and emit `{ id, title, note, order_deadline }` on save. Use modal overlay on desktop and a full-screen sheet breakpoint on mobile.

- [ ] **Step 6: Run focused component tests and existing UI regressions.**

Run:

```bash
npx vitest run tests/ui/components/order-deadline-field.test.js tests/ui/components/menu-editor-dialog.test.js tests/ui/pages/protected-pages.test.js
```

Expected: all pass; no application console output from tests.

- [ ] **Step 7: Update changelog, detect, commit.**

Append `"Thêm editor trực quan cho menu OCR và trường hạn chót đồng bộ desktop/mobile"`; stage Task 4 files, run staged detect, commit:

```bash
git add src/components/ui/OrderDeadlineField.vue src/components/ui/MenuEditorDialog.vue src/components/ui/MenuBoard.vue src/components/ui/index.js tests/ui/components/order-deadline-field.test.js tests/ui/components/menu-editor-dialog.test.js src/changelog.json
git commit -m "feat: add owner menu editor UI"
```

---

### Task 5: Integrate create/edit deadline and owner editor

**Files:**
- Modify: `src/pages/PostMenuPage.vue`
- Modify: `src/pages/MyMenusPage.vue`
- Modify: `src/pages/MenuPage.vue` only if shared menu refresh helper is needed
- Create: `tests/ui/pages/menu-editor-integration.test.js`
- Modify: `src/changelog.json`

**Interfaces:**

```js
// PostMenuPage create payload
createMenu({ title, menu_date, note, imageFile, order_deadline })

// MyMenusPage save handler
saveMenuDraft({ id, title, note, order_deadline })
```

- [ ] **Step 1: Run GitNexus impact on `submit`, `load`, `saveEdit`, `startEdit`, `cancelEdit`, and the page template action blocks.**

Grep all current callers before changing existing patterns; stop only for HIGH/CRITICAL.

- [ ] **Step 2: Add failing page integration tests.**

Assert PostMenu payload includes `order_deadline`, MyMenus opens `MenuEditorDialog` only for owner data, and successful save replaces title/note/deadline in local `menus` state without refetch.

- [ ] **Step 3: Add `OrderDeadlineField` to PostMenuPage.**

Keep deadline draft through existing sessionStorage form-state restoration, include `order_deadline` in `createMenu`, clear it on successful reset, and retain OCR draft behavior. Render the field with current page `DateField`/card spacing and no JSON textarea.

- [ ] **Step 4: Replace MyMenus inline edit.**

Remove duplicate `editDraft`/inline title-note editor; open `MenuEditorDialog` from owner action, pass `menu.orders`, call `updateMenu`, map deadline error to `saveError`, merge returned row into `menus.value`, and close only on success. Keep copy/delete/detail actions unchanged.

- [ ] **Step 5: Run focused and full UI tests.**

Run:

```bash
npx vitest run tests/ui/pages/menu-editor-integration.test.js tests/ui/pages/protected-pages.test.js
npm run test:ui
```

- [ ] **Step 6: Update changelog, detect, commit.**

Append `"Có thể chỉnh sửa món OCR và hạn chót ngay trong Menu của tôi"`; stage Task 5 files, run staged detect, commit:

```bash
git add src/pages/PostMenuPage.vue src/pages/MyMenusPage.vue tests/ui/pages/menu-editor-integration.test.js src/changelog.json
git commit -m "feat: integrate owner menu editor and deadline"
```

---

### Task 6: Lock ordering UX and show deadline status

**Files:**
- Modify: `src/pages/MenuPage.vue`
- Modify: `src/pages/TodayPage.vue`
- Modify: `src/pages/MyMenusPage.vue` if card status was not completed in Task 5
- Create: `src/components/ui/DeadlineStatus.vue`
- Create: `tests/ui/pages/menu-deadline.test.js`
- Modify: `src/components/ui/index.js`
- Modify: `src/changelog.json`

**Interfaces:**

```vue
<DeadlineStatus :deadline="menu.order_deadline" :now="now" />
```

- [ ] **Step 1: Run GitNexus impact on `submitOrder`, `saveEdit`, `handleToggle`, `loadMenu`, TodayPage menu-card render and order form handlers.**

Record blast radius before edits; HIGH/CRITICAL requires review.

- [ ] **Step 2: Write failing deadline page tests.**

Cover:

```js
it('locks new order and order edit after deadline but leaves payment toggle enabled', () => {
  expect(wrapper.get('[data-testid="order-closed-state"]').text()).toContain('Menu đã chốt đơn')
  expect(wrapper.find('[data-testid="order-form"]').exists()).toBe(false)
  expect(wrapper.get('[data-testid="paid-toggle"]').isVisible()).toBe(true)
})

it('maps database deadline rejection and retains draft', async () => {
  createOrder.mockResolvedValue({ error: { message: 'ORDER_DEADLINE_PASSED' } })
  await wrapper.get('[data-testid="submit-order"]').trigger('click')
  expect(wrapper.get('[data-testid="order-draft"]').element.value).toContain('Cơm gà')
  expect(wrapper.text()).toContain('Menu đã chốt đơn')
})
```

- [ ] **Step 3: Implement `DeadlineStatus`.**

Render unlimited/open/closing-soon/closed states, update `now` every 30 seconds, clear timer on unmount, and use only existing tokens/accessible text.

- [ ] **Step 4: Guard `MenuPage`.**

Compute `isOrderLocked` from helper; hide/disable create form and order-content edit after closed; keep `togglePaid`, QR and order list active. On `ORDER_DEADLINE_PASSED`, refetch menu, preserve draft, and show closed message. Do not change placed-for-other-user ownership.

- [ ] **Step 5: Add status to Today and My Menus cards.**

Show `DeadlineStatus` near order count, ensure mobile wraps without overflow, and refresh menu data when the tab regains focus. Use original loaded `order_deadline`; no client-only bypass.

- [ ] **Step 6: Run focused/full tests.**

Run:

```bash
npx vitest run tests/ui/pages/menu-deadline.test.js tests/ui/pages/menu-editor-integration.test.js
npm run test:ui
```

- [ ] **Step 7: Update changelog, detect, commit.**

Append `"Hiển thị hạn chót rõ ràng và tự khoá đặt/sửa đơn sau giờ chốt"`; stage Task 6 files, run staged detect, commit:

```bash
git add src/pages/MenuPage.vue src/pages/TodayPage.vue src/pages/MyMenusPage.vue src/components/ui/DeadlineStatus.vue src/components/ui/index.js tests/ui/pages/menu-deadline.test.js src/changelog.json
git commit -m "feat: lock ordering after menu deadline"
```

---

### Task 7: Documentation, regression suite, and local QA

**Files:**
- Modify: `docs/DEPLOY.md`
- Modify: `src/changelog.json`
- Verify: the approved spec and all source/test/migration files from Tasks 1–6

- [ ] **Step 1: Run all automated verification.**

```bash
supabase db reset
npm run test:all
npm run build
```

Expected: all UI/RLS tests pass, build exits 0, no secret/runtime backend additions.

- [ ] **Step 2: Update deployment documentation.**

Document `order_deadline` migration, local `supabase db reset`, deadline smoke cases, and that Supabase trigger—not browser clock—is authoritative. Keep free-tier/no-backend instructions.

- [ ] **Step 3: Run Vercel local HTTP smoke.**

Start with `.env.local`:

```bash
set -a
source .env.local
set +a
vercel dev --yes --listen 4173
```

Verify:

- create/edit menu payload includes null/future `order_deadline`;
- before deadline order request returns success;
- after deadline returns friendly `ORDER_DEADLINE_PASSED`;
- payment-only update after deadline succeeds;
- menu share/OG behavior from the previous feature remains unchanged.

- [ ] **Step 4: Run browser QA.**

At 1280×900 and 390×844 inspect `/`, `/post`, `/history`, `/manage/menus`, `/manage/payments`, `/profile`, a menu detail page, and the owner editor:

- modal/sheet layout;
- original image natural ratio;
- locked dish controls and price warning;
- deadline open/closing/closed states;
- sticky actions and no overflow;
- no application console errors.

- [ ] **Step 5: Run final repository checks.**

```bash
git status --short
git diff --check
rg -n "service_role|SUPABASE_SERVICE_ROLE|express\\(|app\\.listen|chromium|puppeteer" src api package.json
```

Expected: only ignored local brainstorm artifacts may exist; no client secrets/backend/runtime image tooling.

- [ ] **Step 6: Update changelog, detect, review, commit.**

Append `"Hoàn thiện luồng chỉnh sửa menu và chốt giờ đặt món trên desktop/mobile"`; run GitNexus staged detect and the full verification-before-completion checklist, then:

```bash
git add docs/DEPLOY.md src/changelog.json
git commit -m "docs: document menu editing and order deadlines"
```

After Task 7, run the final branch review and use `superpowers:finishing-a-development-branch` before merge/PR choice.

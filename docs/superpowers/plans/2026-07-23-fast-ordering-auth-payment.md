# Fast Ordering, Auth Resume & Payment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Biến MenuPage thành luồng chọn món nhanh trên mobile, hai cột rõ ràng trên desktop, giữ draft qua đăng nhập và dẫn người đặt tới thanh toán đúng quyền.

**Architecture:** Tách giao diện lớn khỏi `MenuPage.vue` thành các component chỉ nhận dữ liệu/phát event; giữ Supabase mutations trong page/composable hiện có. Draft được serialize bằng helper thuần, có version và TTL; auth gate chỉ chuyển state sang xác nhận sau đăng nhập, không tự tạo đơn. Payment action dựa trên owner của order và luôn tuân RLS self-tick.

**Tech Stack:** Vue 3.5, Vue Router 5, Clerk Vue, Supabase JS, Vitest 4, Vue Test Utils, happy-dom, CSS Grid/Container Queries.

## Global Constraints

- Thực hiện sau Plan 1 `2026-07-23-ux-foundation-navigation.md`.
- Không thêm backend, serverless function, webhook, secret key, bảng/cột hoặc RLS mới.
- Structured menu chỉ cho chọn chính xác dish hiện có; text menu vẫn cho nhập tự do.
- Chỉ chủ đơn được đổi `is_paid`; đặt hộ không hiện hành động thanh toán cho người đặt.
- Ảnh menu là ảnh gốc trước OCR: không crop, không ép tỷ lệ, không upscale ảnh nhỏ.
- Draft guest phải còn sau reload và Google sign-in; không tự submit sau sign-in.
- Mọi function/method được sửa phải chạy GitNexus impact upstream trước; HIGH/CRITICAL phải báo người dùng.
- Grep toàn bộ consumer trước khi sửa shared component; trước mỗi commit cập nhật changelog, chạy staged change detection và review diff.

---

## File Map

- Create `src/lib/orderDraft.js` — version, TTL, serialize/restore/revalidate.
- Create `src/lib/menuOrder.js` — parse menu, exact matching, total, payment eligibility.
- Create `src/components/menu/MenuHero.vue` — metadata và social summary.
- Create `src/components/menu/MenuImageReference.vue` — ảnh tự nhiên, error và lightbox.
- Create `src/components/menu/DishList.vue`, `DishRow.vue` — chọn món structured.
- Create `src/components/menu/StickyOrderBar.vue`, `OrderOptionsSheet.vue` — summary và options.
- Create `src/components/menu/GuestOrderGate.vue` — resume sau auth.
- Create `src/components/menu/OrderSuccessSheet.vue` — success/payment/delegated outcomes.
- Modify `src/pages/MenuPage.vue` — state machine và integration.
- Modify `src/components/ui/PaymentQRModal.vue` — fallback và explicit paid action.
- Modify `src/styles/tokens.css` — responsive menu shell.
- Create `tests/ui/lib/order-draft.test.js`, `menu-order.test.js`.
- Create `tests/ui/components/menu-image-reference.test.js`, `dish-list.test.js`, `guest-order-gate.test.js`, `order-success-sheet.test.js`.

## Task 1: Versioned Draft Persistence and Revalidation

**Files:**
- Create: `src/lib/orderDraft.js`
- Test: `tests/ui/lib/order-draft.test.js`

**Interfaces:**
- Produces: `draftKey(menuId)`, `saveOrderDraft(storage, menuId, draft, now)`, `restoreOrderDraft(storage, menu, profiles, now)`, `clearOrderDraft(storage, menuId)`.
- Draft shape: `{ version: 1, savedAt, itemText, note, orderFor, dishNames }`.
- Restore result: `{ draft, removedDishNames, orderForRemoved }` or `null`.

- [ ] **Step 1: Write the failing helper tests**

Create `tests/ui/lib/order-draft.test.js`:

```js
import { describe, expect, it } from 'vitest'
import {
  clearOrderDraft,
  draftKey,
  restoreOrderDraft,
  saveOrderDraft,
} from '../../../src/lib/orderDraft'

function memoryStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
}

const now = Date.UTC(2026, 6, 23, 5)
const menu = {
  id: 'menu-1',
  note: JSON.stringify({ dishes: [{ name: 'Cơm gà', price: 45000 }] }),
}

describe('order draft', () => {
  it('round-trips a current structured draft', () => {
    const storage = memoryStorage()
    saveOrderDraft(storage, menu.id, {
      itemText: 'Cơm gà',
      note: 'Ít cơm',
      orderFor: 'user-a',
      dishNames: ['Cơm gà'],
    }, now)

    expect(restoreOrderDraft(
      storage,
      menu,
      [{ id: 'user-a' }],
      now + 1000,
    )).toEqual({
      draft: {
        itemText: 'Cơm gà',
        note: 'Ít cơm',
        orderFor: 'user-a',
        dishNames: ['Cơm gà'],
      },
      removedDishNames: [],
      orderForRemoved: false,
    })
  })

  it('removes missing exact dish names and an unavailable beneficiary', () => {
    const storage = memoryStorage()
    saveOrderDraft(storage, menu.id, {
      itemText: 'Cơm gà\nBún bò',
      note: '',
      orderFor: 'missing-user',
      dishNames: ['Cơm gà', 'Bún bò'],
    }, now)
    expect(restoreOrderDraft(storage, menu, [], now + 1000)).toMatchObject({
      draft: { itemText: 'Cơm gà', orderFor: '', dishNames: ['Cơm gà'] },
      removedDishNames: ['Bún bò'],
      orderForRemoved: true,
    })
  })

  it('drops drafts older than 24 hours', () => {
    const storage = memoryStorage()
    saveOrderDraft(storage, menu.id, { itemText: 'Cơm gà' }, now)
    expect(restoreOrderDraft(storage, menu, [], now + 24 * 60 * 60 * 1000 + 1)).toBeNull()
    expect(storage.getItem(draftKey(menu.id))).toBeNull()
  })

  it('clears a saved draft', () => {
    const storage = memoryStorage()
    saveOrderDraft(storage, menu.id, { itemText: 'Cơm gà' }, now)
    clearOrderDraft(storage, menu.id)
    expect(storage.getItem(draftKey(menu.id))).toBeNull()
  })
})
```

- [ ] **Step 2: Run and verify failure**

```bash
npx vitest run tests/ui/lib/order-draft.test.js
```

Expected: FAIL because `src/lib/orderDraft.js` does not exist.

- [ ] **Step 3: Implement the helper**

Use constants:

```js
const VERSION = 1
const TTL_MS = 24 * 60 * 60 * 1000
export const draftKey = (menuId) => `lunch-order-draft:v1:${menuId}`
```

`saveOrderDraft` must normalize missing fields to empty strings/arrays and catch storage quota/security errors. `restoreOrderDraft` must catch invalid JSON/version, delete expired data, parse `menu.note` defensively, keep free text unchanged for non-structured menus, filter structured `dishNames` by exact case-sensitive equality, rebuild `itemText` with `\n`, and clear `orderFor` unless its id exists in `profiles`.

- [ ] **Step 4: Verify and commit**

```bash
npx vitest run tests/ui/lib/order-draft.test.js
```

Expected: 4 tests PASS. Add changelog bullet:

```json
"Giữ lại món đã chọn khi tải lại trang hoặc đăng nhập giữa chừng"
```

Run staged GitNexus detection, then:

```bash
git add src/lib/orderDraft.js tests/ui/lib/order-draft.test.js src/changelog.json
git commit -m "feat: persist and revalidate order drafts"
```

## Task 2: Pure Menu and Payment Rules

**Files:**
- Create: `src/lib/menuOrder.js`
- Test: `tests/ui/lib/menu-order.test.js`

**Interfaces:**
- Produces: `parseStructuredMenu(note)`, `calculateSelection(dishes)`, `exactDishMatches(itemText, dishes)`, `canSelfPay(currentUserId, order)`.
- Consumes: existing JSON `menus.note` shape and `orders.user_id`.

- [ ] **Step 1: Write failing tests**

```js
import { describe, expect, it } from 'vitest'
import {
  calculateSelection,
  canSelfPay,
  exactDishMatches,
  parseStructuredMenu,
} from '../../../src/lib/menuOrder'

const dishes = [
  { name: 'Cơm gà', price: 45000 },
  { name: 'Rau thêm', price: 10000 },
]

describe('menu order rules', () => {
  it('accepts only a valid dishes array', () => {
    expect(parseStructuredMenu(JSON.stringify({ dishes }))).toEqual(dishes)
    expect(parseStructuredMenu('Menu hôm nay')).toBeNull()
    expect(parseStructuredMenu('{"dishes":"invalid"}')).toBeNull()
  })

  it('calculates count and total only when every price is numeric', () => {
    expect(calculateSelection(dishes)).toEqual({ count: 2, total: 55000 })
    expect(calculateSelection([{ name: 'Giá liên hệ' }])).toEqual({ count: 1, total: null })
  })

  it('matches structured order lines exactly', () => {
    expect(exactDishMatches('Cơm gà\nRau thêm', dishes)).toEqual(dishes)
    expect(exactDishMatches('cơm gà', dishes)).toEqual([])
  })

  it('allows payment only for the order owner', () => {
    expect(canSelfPay('user-a', { user_id: 'user-a' })).toBe(true)
    expect(canSelfPay('user-b', { user_id: 'user-a' })).toBe(false)
    expect(canSelfPay('', { user_id: 'user-a' })).toBe(false)
  })
})
```

- [ ] **Step 2: Run red, implement minimally, run green**

```bash
npx vitest run tests/ui/lib/menu-order.test.js
```

Implement defensive pure functions without importing Vue or Supabase, then rerun. Expected: 4 tests PASS.

- [ ] **Step 3: Commit**

Add changelog bullet:

```json
"Kiểm tra lựa chọn món và quyền thanh toán rõ ràng hơn"
```

Run staged GitNexus detection, then:

```bash
git add src/lib/menuOrder.js tests/ui/lib/menu-order.test.js src/changelog.json
git commit -m "test: codify menu and payment rules"
```

## Task 3: Menu Hero and Original-image Reference

**Files:**
- Create: `src/components/menu/MenuHero.vue`
- Create: `src/components/menu/MenuImageReference.vue`
- Test: `tests/ui/components/menu-image-reference.test.js`

**Interfaces:**
- `MenuHero` consumes `menu`, `viewerCount`; emits `copy-link`.
- `MenuImageReference` consumes `src`, `alt`; handles load/error/lightbox internally.
- Image error never hides or blocks the component's following siblings.

- [ ] **Step 1: Inspect current image/lightbox code and impact**

```bash
rg -n "image_url|zoomImage|closeZoom|zoomedImageUrl|menu-image|lightbox" src
```

Run upstream impact for `zoomImage`, `closeZoom`, and `handleEsc`. Expected risk: LOW, limited to `MenuPage`.

- [ ] **Step 2: Write failing image behavior tests**

Create a happy-dom test that asserts:

```js
const wrapper = mount(MenuImageReference, {
  props: { src: '/portrait.jpg', alt: 'Menu Cơm Nhà' },
})
expect(wrapper.get('img').attributes('alt')).toBe('Menu Cơm Nhà')
expect(wrapper.get('img').classes()).toContain('menu-reference__image')
await wrapper.get('img').trigger('error')
expect(wrapper.text()).toContain('Không tải được ảnh menu')
expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
```

Add a second test: click loaded image → dialog exists; press Escape → dialog closes and focus returns to the trigger button.

- [ ] **Step 3: Run red and implement components**

```bash
npx vitest run tests/ui/components/menu-image-reference.test.js
```

`MenuImageReference.vue` must omit itself when `src` is empty and render the original image inside a centered neutral panel:

```css
.menu-reference__image {
  display: block;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: min(55vh, 560px);
  margin: 0 auto;
  object-fit: contain;
}
```

Do not set `width: 100%`, `aspect-ratio`, fixed height, or `object-fit: cover`. Use the same `src` in the lightbox, support Escape, and return focus to the image button. The error view contains `Thử tải lại ảnh`; retry changes an internal cache-busting key, not menu data.

- [ ] **Step 4: Verify and commit**

```bash
npx vitest run tests/ui/components/menu-image-reference.test.js
npm run build
```

Add changelog bullet:

```json
"Hiển thị ảnh menu gốc trọn vẹn ở mọi tỷ lệ và cho phép phóng to"
```

Run staged detection and commit:

```bash
git add src/components/menu tests/ui/components/menu-image-reference.test.js src/changelog.json
git commit -m "feat: add responsive menu image reference"
```

## Task 4: Structured Dish Selection and Sticky Summary

**Files:**
- Create: `src/components/menu/DishRow.vue`
- Create: `src/components/menu/DishList.vue`
- Create: `src/components/menu/StickyOrderBar.vue`
- Create: `src/components/menu/OrderOptionsSheet.vue`
- Test: `tests/ui/components/dish-list.test.js`

**Interfaces:**
- `DishList` props `dishes`, `selectedNames`; emits `toggle(name)`.
- `StickyOrderBar` props `count`, `total`, `disabled`, `submitting`; emits `submit`, `open-options`.
- `OrderOptionsSheet` uses controlled props `open`, `note`, `orderFor`, `profiles`; emits updates and `close`.

- [ ] **Step 1: Impact-check existing selection functions**

Run upstream GitNexus impact for `toggleDish`, `getAllDishes`, `findDishByName`, and `picksTotal`. Grep:

```bash
rg -n "toggleDish|getAllDishes|picksTotal|draft\\.note|draft\\.orderFor" src
```

- [ ] **Step 2: Write failing component tests**

Test that a row has a native checkbox/button with a 44px class, selected state includes text/icon rather than color only, exact selected names are emitted, total renders as `55.000đ`, zero selection disables submit, and options sheet labels note/beneficiary controls.

- [ ] **Step 3: Implement presentational components**

Use `DishRow` as the only renderer of a dish. `DishList` must not mutate props. `StickyOrderBar` must render:

```text
0 món                   Chọn món để đặt
2 món · 55.000đ         Đặt món
```

On viewport ≤1079px it is fixed above safe-area; on ≥1080px it is normal content inside the sticky desktop rail. `OrderOptionsSheet` closes on Escape, traps focus, and returns focus to its trigger.

- [ ] **Step 4: Run tests/build and commit**

```bash
npx vitest run tests/ui/components/dish-list.test.js
npm run build
```

Add changelog bullet:

```json
"Chọn món nhanh hơn với danh sách rõ ràng và thanh tóm tắt luôn trong tầm tay"
```

Run staged detection, then:

```bash
git add src/components/menu tests/ui/components/dish-list.test.js src/styles/tokens.css src/changelog.json
git commit -m "feat: add fast dish selection controls"
```

## Task 5: Guest Auth Resume and Explicit Confirmation

**Files:**
- Create: `src/components/menu/GuestOrderGate.vue`
- Modify: `src/pages/MenuPage.vue`
- Test: `tests/ui/components/guest-order-gate.test.js`

**Interfaces:**
- `GuestOrderGate` props `open`, `isSignedIn`; emits `authenticated`, `cancel`.
- `MenuPage` state transitions: `viewing → selecting → ready → authenticating → confirming → submitting`.
- Consumes: `orderDraft.js`, Plan 1 localized `SignInModal`, Clerk `isLoaded/isSignedIn`.

- [ ] **Step 1: Impact and grep before page edits**

Run GitNexus upstream impact on `load`, `toggleDish`, `handleFormSubmit`, and `submitOrder`; report HIGH/CRITICAL before continuing. Then:

```bash
rg -n "showSignIn|handleFormSubmit|submitOrder|localStorage|sessionStorage|SignInModal" src
```

- [ ] **Step 2: Write auth-gate tests**

Mount `GuestOrderGate` with a stubbed `SignInModal`. Assert:

1. `open=true`, `isSignedIn=false` renders sign-in.
2. Changing `isSignedIn` to true emits `authenticated` once.
3. Closing before sign-in emits `cancel`.

- [ ] **Step 3: Integrate one draft source**

Remove legacy `picks_menu_*`, `draft_note_menu_*`, and `draft_orderFor_menu_*` writes after the new helper is wired. A single deep watcher saves `{ itemText, note, orderFor, dishNames }` to localStorage. `load()` restores only after both menu and profiles resolve; show a non-blocking warning listing removed dishes/beneficiary.

- [ ] **Step 4: Gate submit without auto-ordering**

`handleFormSubmit()` must:

1. Validate at least one exact dish for structured menu or non-empty text for plain menu.
2. Persist draft.
3. If guest, set phase `authenticating`.
4. If signed in, set phase `confirming`.

On `authenticated`, restore/revalidate again and set phase `confirming`. Render a confirmation summary with món, ghi chú, người được đặt hộ, tổng tiền and explicit `Xác nhận đặt món`. Never call `submitOrder()` from the auth watcher.

- [ ] **Step 5: Preserve draft on errors and prevent double taps**

Only `Xác nhận đặt món` calls `submitOrder()`. Keep `draft.submitting` as a synchronous guard at the first line; on error return to `confirming`, keep selection, focus the error summary. Clear saved draft only after a successful insert.

- [ ] **Step 6: Verify and commit**

```bash
npx vitest run tests/ui/components/guest-order-gate.test.js tests/ui/lib/order-draft.test.js
npm run build
```

Manual: guest selects → sign-in → confirmation still has selection; cancel auth retains selection; submit failure retains selection.

Add changelog:

```json
"Không còn mất món đã chọn khi đăng nhập và luôn xác nhận trước khi gửi đơn"
```

Run staged detection, then:

```bash
git add src/components/menu/GuestOrderGate.vue src/pages/MenuPage.vue tests/ui/components/guest-order-gate.test.js src/changelog.json
git commit -m "feat: resume guest orders after sign in"
```

## Task 6: Success Outcomes and Self-payment

**Files:**
- Create: `src/components/menu/OrderSuccessSheet.vue`
- Modify: `src/components/ui/PaymentQRModal.vue`
- Modify: `src/pages/MenuPage.vue`
- Test: `tests/ui/components/order-success-sheet.test.js`

**Interfaces:**
- `OrderSuccessSheet` props `order`, `orderedForName`, `canPay`, `hasPaymentInfo`; emits `pay`, `later`, `copy-link`.
- `PaymentQRModal` emits `paid` only from `Tôi đã chuyển tiền xong`.
- Consumes: `canSelfPay(currentUserId, order)` and poster payment profile.

- [ ] **Step 1: Impact-check payment functions**

Run GitNexus upstream impact for `openQRModal`, `handleQRModalPaid`, `hasQRConfig`, and `handleToggle`. Grep all `PaymentQRModal` consumers.

- [ ] **Step 2: Write failing success/payment tests**

Assert:

- Own order renders `Thanh toán ngay` and `Để sau`.
- Delegated order renders `Đã đặt giúp An`, a copy-link action, and no payment button.
- Opening/closing QR does not emit `paid`.
- Only clicking `Tôi đã chuyển tiền xong` emits `paid`.
- Missing QR shows bank/wallet text and copy controls.

- [ ] **Step 3: Implement explicit outcomes**

After a successful insert, preserve the returned order in `lastCreatedOrder`, set phase `success`, and fire confetti with a reduced-motion guard. For own orders, `Thanh toán ngay` opens QR and `Để sau` closes success. For delegated orders, show beneficiary name and copy menu link; do not render or call `togglePaid`.

- [ ] **Step 4: Verify and commit**

```bash
npx vitest run tests/ui/components/order-success-sheet.test.js
npm run test:ui
npm run build
```

Add changelog:

```json
"Sau khi đặt món có lựa chọn thanh toán ngay hoặc để sau, đúng với người sở hữu đơn"
```

Run staged detection, then:

```bash
git add src/components/menu/OrderSuccessSheet.vue src/components/ui/PaymentQRModal.vue src/pages/MenuPage.vue tests/ui/components/order-success-sheet.test.js src/changelog.json
git commit -m "feat: add safe order success and payment flow"
```

## Task 7: Responsive MenuPage Integration

**Files:**
- Modify: `src/pages/MenuPage.vue`
- Modify: `src/styles/tokens.css`
- Test: all Plan 2 UI tests.

**Interfaces:**
- ≥1080px: left content `minmax(0, 1.7fr)`, right sticky rail `minmax(300px, .8fr)`.
- ≤1079px: one column and sticky bottom order bar.
- At browser zoom 200%, layout collapses naturally without horizontal page overflow.

- [ ] **Step 1: Replace page markup with component boundaries**

Keep edit/delete/order-list mutations in `MenuPage`. Compose the ordering area in this order:

```text
MenuHero
  desktop grid
    left: MenuImageReference → plain text or DishList
    right: sticky selection summary → options → submit
  mobile: content → StickyOrderBar
GuestOrderGate / confirmation / OrderSuccessSheet / PaymentQRModal
existing orders and owner controls
```

Image comes before OCR dish results. If `image_url` is absent, omit the panel. If it errors, DishList/plain text and order controls remain interactive.

- [ ] **Step 2: Add scoped responsive CSS**

```css
.menu-order-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(300px, 0.8fr);
  gap: clamp(1.25rem, 3vw, 2.5rem);
  align-items: start;
}
.menu-order-rail {
  position: sticky;
  top: calc(var(--header-height, 72px) + 1rem);
}
@media (max-width: 1079px) {
  .menu-order-layout { grid-template-columns: minmax(0, 1fr); }
  .menu-order-rail { position: static; }
}
```

Do not set an image aspect ratio. Ensure fixed mobile controls use safe-area and do not overlap modal, nav, or final content.

- [ ] **Step 3: Full verification**

```bash
npm run test:ui
npm test
npm run build
git diff --check
```

Browser QA:

- 360/390/430px: selection and CTA reachable, no horizontal overflow.
- 1080/1280/1440px: two columns; rail sticky; dialogs not obscured.
- Portrait, landscape, very tall, and naturally small images: entire image visible and small image not enlarged.
- Broken image: ordering still works.
- Structured menu rejects free text; plain menu accepts it.
- Guest reload/auth resume and delegated-order payment restrictions behave as specified.

- [ ] **Step 4: Commit integration**

Add changelog:

```json
"Tối ưu trang menu cho cả điện thoại và PC với bố cục hai cột dễ đặt món"
```

Run staged GitNexus detection, then:

```bash
git add src/pages/MenuPage.vue src/styles/tokens.css src/changelog.json
git commit -m "feat: complete responsive fast ordering layout"
```

## Plan 2 Final Verification

- [ ] Run `npm run test:ui`, `npm test`, `npm run build`, and `git status --short`.
- [ ] Run `gitnexus_detect_changes({ scope: "all" })`; confirm only menu selection/auth/payment flows changed.
- [ ] Confirm no new network/service dependency beyond Clerk localization from Plan 1.
- [ ] Confirm no `service_role`, Clerk secret, backend route, schema, or RLS change exists.
- [ ] Record manual usability timing: a returning signed-in user can choose a main, optional side/note, submit, and reach success in ≤30 seconds.

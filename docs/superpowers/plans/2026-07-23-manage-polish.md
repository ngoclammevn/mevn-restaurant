# Manage Quality Floor & Measured Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng các màn Hôm nay, Đăng menu, Đơn của tôi và Quản lý lên cùng quality floor; sau đó thêm gợi ý đặt lại, độ phổ biến và presence gọn mà không đổi data model.

**Architecture:** Tái sử dụng navigation/async primitives từ Plan 1 và menu helpers/components từ Plan 2. Các chỉ số social được derive thuần từ orders hiện có, không lưu DB. PostMenu được tách theo trạng thái progressive disclosure nhưng giữ nguyên OCR/upload mutation trong page.

**Tech Stack:** Vue 3.5, Vue Router 5, Clerk Vue, Supabase JS/Realtime, Vitest 4, Vue Test Utils, happy-dom, CSS Grid.

## Global Constraints

- Thực hiện sau Plan 1 và Plan 2.
- Không thêm backend, dịch vụ trả phí, notification service, schema/RLS, role admin hoặc khả năng collector tick paid hộ.
- Today chỉ là index/social dashboard nhẹ, không copy order form.
- OCR là tùy chọn chỉ xuất hiện sau khi có ảnh; draft PostMenu không mất khi auth/OCR lỗi.
- Quick reorder structured chỉ hiện khi tên món cũ khớp chính xác dish hiện tại.
- Popularity chỉ đếm match tin cậy từ orders hiện tại; không ghi lại DB.
- Presence không được thay đổi scroll, focus hoặc local picks.
- Trước mỗi symbol edit: GitNexus upstream impact; trước mỗi commit: changelog, staged detect, diff review.

---

## File Map

- Modify `src/pages/TodayPage.vue` — responsive menu grid và CTA.
- Create `src/components/menu/MenuIndexCard.vue` — card dashboard nhẹ.
- Modify `src/pages/HistoryPage.vue` — unpaid-first và payment CTA.
- Modify `src/pages/MyMenusPage.vue`, `DashboardPage.vue`, `ManagePage.vue` — manage quality floor.
- Create `src/components/post/PostMenuBasicForm.vue`, `OcrPreviewEditor.vue`.
- Modify `src/pages/PostMenuPage.vue` — progressive disclosure.
- Create `src/lib/orderInsights.js` — quick reorder/popularity helpers.
- Create `src/components/menu/OrderSuggestions.vue` — valid reorder chips.
- Modify `src/components/menu/DishRow.vue`, `MenuHero.vue`, `src/pages/MenuPage.vue` — insights/presence.
- Modify `src/styles/tokens.css` — measured responsive polish/reduced motion.
- Create/update tests under `tests/ui/lib` and `tests/ui/components`.

## Task 1: Today as a Lightweight Menu Index

**Files:**
- Create: `src/components/menu/MenuIndexCard.vue`
- Modify: `src/pages/TodayPage.vue`
- Test: `tests/ui/components/menu-index-card.test.js`

**Interfaces:**
- `MenuIndexCard` props `menu`, `viewerCount`; renders metadata, compact order count and route CTA.
- `TodayPage` continues consuming the existing menu query; no new per-card request.

- [ ] **Step 1: Inspect query and impact**

Run GitNexus context/impact for `TodayPage` loader and grep:

```bash
rg -n "TodayPage|listToday|getToday|menu-card|orders" src/pages/TodayPage.vue src/composables src/components
```

Confirm the current query already supplies card counts/summary; if it does not, derive only from returned `orders` and do not create N+1 queries.

- [ ] **Step 2: Write failing card tests**

Assert title/date/poster summary, `Vào chọn món` links to `/menu/:id`, optional counts render only when data exists, and no input/submit order controls are present.

- [ ] **Step 3: Implement card and grid**

At ≥900px render two columns; below it use one column. Cards must have one primary CTA, ≥44px target, keyboard focus ring, no nested interactive elements, and stable height without truncating menu title.

- [ ] **Step 4: Verify and commit**

```bash
npx vitest run tests/ui/components/menu-index-card.test.js
npm run build
```

Add changelog:

```json
"Trang Hôm nay dễ quét hơn với danh sách menu và nút vào chọn món rõ ràng"
```

Run staged detection, then:

```bash
git add src/components/menu/MenuIndexCard.vue src/pages/TodayPage.vue tests/ui/components/menu-index-card.test.js src/changelog.json
git commit -m "feat: improve today menu index"
```

## Task 2: Unpaid-first History and Safe Payment Entry

**Files:**
- Modify: `src/pages/HistoryPage.vue`
- Reuse: `src/components/ui/PaymentQRModal.vue`
- Test: `tests/ui/components/history-orders.test.js`

**Interfaces:**
- Produces: `sortedOrders` with unpaid first, then newest.
- Payment CTA is shown only for current user's unpaid order and opens payment details for that order's menu poster.
- No collector mutation is introduced.

- [ ] **Step 1: Impact-check history helpers**

Run upstream impact for `load`, `groupedByDay`, `displayOrderItemText`, and `displayOrderNote`. Grep all `listMyOrders` consumers.

- [ ] **Step 2: Write failing tests**

Stub `listMyOrders` with one paid newer order and one unpaid older order. Assert unpaid renders first and has `Thanh toán`; paid has stamp and no CTA. Assert signed-out state does not call `listMyOrders`.

- [ ] **Step 3: Supply payment profile data without schema changes**

After GitNexus impact on `listMyOrders`, change its selection to:

```js
.select(`
  *,
  menu:menus(
    id,
    title,
    menu_date,
    poster:profiles!menus_poster_id_fkey(id, full_name, payment_info)
  )
`)
```

This uses the existing `menus_poster_id_fkey` relation already used by `useMenus.js`. Do not fetch secrets or add RPC/backend.

- [ ] **Step 4: Implement and verify**

Use `PaymentQRModal`; opening it does not mark paid. Its explicit completion action calls `togglePaid(order.id, true)` and updates only that order.

```bash
npx vitest run tests/ui/components/history-orders.test.js
npm run build
```

Add changelog:

```json
"Đưa đơn chưa trả lên trước và giúp mở thanh toán ngay từ Đơn của tôi"
```

Run staged detection and commit:

```bash
git add src/pages/HistoryPage.vue src/composables/useOrders.js tests/ui/components/history-orders.test.js src/changelog.json
git commit -m "feat: prioritize unpaid order history"
```

## Task 3: Manage Tabs Quality Floor

**Files:**
- Modify: `src/pages/ManagePage.vue`
- Modify: `src/pages/MyMenusPage.vue`
- Modify: `src/pages/DashboardPage.vue`
- Modify: `src/components/navigation/ManageTabs.vue`
- Test: `tests/ui/components/manage-page.test.js`

**Interfaces:**
- `/manage/menus`: open/share/edit/delete behavior remains available.
- `/manage/payments`: read-only collector view grouped by person/menu.
- Both consume Plan 1 `SignedOutState`/`AsyncState`.

- [ ] **Step 1: Inspect and impact-check page loaders/actions**

```bash
rg -n "function |async function |isSignedIn|togglePaid|delete|copy|share" src/pages/MyMenusPage.vue src/pages/DashboardPage.vue
```

Run upstream impact for every function that will be moved or modified. Explicitly confirm Dashboard has no `togglePaid` mutation before proceeding.

- [ ] **Step 2: Write failing route-shell tests**

Assert tab semantics (`aria-current`/router active), signed-out login prompt on both routes, error retry, empty My Menus CTA to `/post`, and Dashboard contains no button with paid-marking copy.

- [ ] **Step 3: Implement measured layout**

Keep tabs visible below the page heading. Desktop can use wider tables/cards; mobile stacks person totals and orders. Preserve all current menu owner actions. Use route links rather than local duplicated tab state.

- [ ] **Step 4: Verify and commit**

```bash
npx vitest run tests/ui/components/manage-page.test.js
npm run build
```

Add changelog:

```json
"Hoàn thiện khu Quản lý với hai tab Menu của tôi và Thu tiền dễ dùng trên mọi màn hình"
```

Run staged detection, then:

```bash
git add src/pages/ManagePage.vue src/pages/MyMenusPage.vue src/pages/DashboardPage.vue src/components/navigation/ManageTabs.vue tests/ui/components/manage-page.test.js src/changelog.json
git commit -m "feat: polish manage workflows"
```

## Task 4: Progressive Post-menu Disclosure

**Files:**
- Create: `src/components/post/PostMenuBasicForm.vue`
- Create: `src/components/post/OcrPreviewEditor.vue`
- Modify: `src/pages/PostMenuPage.vue`
- Test: `tests/ui/components/post-menu-flow.test.js`

**Interfaces:**
- `PostMenuBasicForm` controlled props for date/title/text/image; emits field updates and image selection.
- `OcrPreviewEditor` props `imagePreview`, `ocrResult`, `processing`, `error`; emits `run-ocr`, `update-result`, `retry`.
- `PostMenuPage` retains upload/create side effects and existing session draft format until a tested migration is needed.

- [ ] **Step 1: Impact and grep before splitting**

Run GitNexus upstream impact for `saveFormState`, `restoreFormState`, `clearFormState`, `submit`, `cancelPreview`, and OCR trigger functions. Then:

```bash
rg -n "saveFormState|restoreFormState|sessionStorage|OCR|ocr|preview|image" src/pages/PostMenuPage.vue src
```

- [ ] **Step 2: Write failing flow tests**

Assert:

1. Initial view shows date/title/text/image fields but no OCR editor.
2. Selecting an image shows `Dùng OCR để đọc món` opt-in.
3. Enabling OCR shows image/reference plus processing/editor state.
4. OCR error keeps basic draft and exposes retry.
5. Submit disabled/loading prevents double-click.

- [ ] **Step 3: Extract presentational components**

Move markup only first, keep behavior identical, run tests/build. Then add progressive state `basic | ocr-ready | ocr-processing | ocr-review`. Desktop OCR review uses two columns (original image left, editor right); ≤900px stacks them. Reuse natural-ratio image rules from `MenuImageReference` without coupling to MenuPage.

- [ ] **Step 4: Preserve drafts and errors**

Continue calling `saveFormState()` for every meaningful field transition. Auth/OCR/upload failure must not clear it. Only successful menu creation calls `clearFormState()` and `resetForm()`.

- [ ] **Step 5: Verify and commit**

```bash
npx vitest run tests/ui/components/post-menu-flow.test.js
npm run build
```

Add changelog:

```json
"Đơn giản hóa đăng menu và chỉ hiện OCR khi có ảnh và người đăng muốn dùng"
```

Run staged detection and commit:

```bash
git add src/components/post src/pages/PostMenuPage.vue tests/ui/components/post-menu-flow.test.js src/changelog.json
git commit -m "feat: simplify menu posting flow"
```

## Task 5: Exact Quick Reorder and Dish Popularity

**Files:**
- Create: `src/lib/orderInsights.js`
- Create: `src/components/menu/OrderSuggestions.vue`
- Modify: `src/components/menu/DishRow.vue`
- Modify: `src/pages/MenuPage.vue`
- Test: `tests/ui/lib/order-insights.test.js`
- Test: `tests/ui/components/order-suggestions.test.js`

**Interfaces:**
- Produces: `getValidReorderSuggestion(previousOrders, currentDishes, isStructured)`.
- Produces: `countExactDishSelections(currentOrders, currentDishes)`.
- No persistence; consumes already-loaded order/menu data only.

- [ ] **Step 1: Write failing pure tests**

Cover:

- Structured previous `Cơm gà` matches current exact `Cơm gà`.
- Case difference or removed dish produces no suggestion.
- Multi-line exact selection is valid only when every line exists.
- Plain-text previous order returns its text as a prefill suggestion.
- Popularity counts only exact structured lines and ignores ambiguous free text.

- [ ] **Step 2: Implement pure parsers**

Reuse `exactDishMatches` from `menuOrder.js`. Return:

```js
{ itemText, dishNames, note }
```

or `null` for suggestion; return `Map<dishName, count>` for popularity. Never guess substring matches.

- [ ] **Step 3: Wire non-submitting suggestions**

`OrderSuggestions` emits `apply`; MenuPage updates draft/picks and then requires the normal submit/confirmation flow. `DishRow` renders `N người đã chọn` only for count >0. Do not add a Supabase write or a new query per dish.

- [ ] **Step 4: Verify and commit**

```bash
npx vitest run tests/ui/lib/order-insights.test.js tests/ui/components/order-suggestions.test.js
npm run build
```

Add changelog:

```json
"Gợi ý đặt lại món còn hợp lệ và hiển thị món đang được nhiều người chọn"
```

Run staged detection, then:

```bash
git add src/lib/orderInsights.js src/components/menu/OrderSuggestions.vue src/components/menu/DishRow.vue src/pages/MenuPage.vue tests/ui src/changelog.json
git commit -m "feat: add exact order insights"
```

## Task 6: Compact, Non-disruptive Presence

**Files:**
- Modify: `src/components/menu/MenuHero.vue`
- Modify: `src/components/menu/DishRow.vue`
- Modify: `src/pages/MenuPage.vue`
- Modify: `src/composables/usePresence.js` only if an existing value cannot be consumed safely.
- Test: `tests/ui/components/menu-presence.test.js`

**Interfaces:**
- Header renders stable `N người đang xem`.
- Dish signal is visual/semantic only; it never mutates local selection.
- Existing `setMyPicks`, `setActiveDish`, `selfRemotePicks` contract remains intact.

- [ ] **Step 1: Context and impact**

Run GitNexus context for `usePresence`; impact-check any composable function before editing. Prefer adapting values in MenuPage rather than changing realtime protocol.

- [ ] **Step 2: Write regression tests**

Assert viewer count update does not remount DishList, remote active-dish update does not emit local `toggle`, and `prefers-reduced-motion` disables ripple/transform animation while preserving text.

- [ ] **Step 3: Implement stable presentation**

Use fixed-height text slots and opacity/border changes only. Do not auto-scroll, focus, reorder dishes, or call `applyRemotePicks` for other users' picks. Keep remote reconciliation scoped to the current user's own presence key as existing code intends.

- [ ] **Step 4: Verify and commit**

```bash
npx vitest run tests/ui/components/menu-presence.test.js
npm run build
```

Add changelog:

```json
"Hiển thị người đang xem và món được quan tâm theo cách gọn, không làm xê dịch trang"
```

Run staged detection and commit:

```bash
git add src/components/menu src/pages/MenuPage.vue src/composables/usePresence.js tests/ui/components/menu-presence.test.js src/changelog.json
git commit -m "feat: make menu presence non-disruptive"
```

## Task 7: Responsive, Accessibility, and Regression QA

**Files:**
- Modify only files with verified defects found by this task.
- Modify: `src/styles/tokens.css`
- Test: all UI and RLS tests.

**Interfaces:**
- Breakpoints: 360, 390, 430, 1080, 1280, 1440 CSS px.
- Forms remain ≤760px measure; Menu/Today/Manage can use 1200px shell.
- Reduced motion, keyboard focus, 200% zoom and image error are acceptance gates.

- [ ] **Step 1: Automated verification**

```bash
npm run test:ui
npm test
npm run build
git diff --check
```

All must pass before browser QA.

- [ ] **Step 2: Browser matrix**

Run the app and verify Today, Menu, Post, History, Manage and Profile at:

```text
360×800, 390×844, 430×932,
1080×800, 1280×800, 1440×900
```

For every width: no page overflow, targets ≥44px, visible keyboard focus, no content hidden by fixed nav/sticky bar, signed-out states terminate, errors have retry.

- [ ] **Step 3: Primary-flow scenarios**

Verify:

- Guest Slack link → select → sign in → restore → confirm → success.
- Signed-in order → QR → explicit self-tick.
- Delegated order → beneficiary success → copy link → no payment action.
- Structured exact selection and text-menu free entry.
- PostMenu draft survives OCR/upload error.
- Collector can see unpaid grouping but cannot mark paid.
- Old `/my-menus`, `/dashboard`, and `/share/:id` URLs still resolve.

- [ ] **Step 4: Image and desktop matrix**

Use portrait, landscape, very tall, small-natural-size, and broken URLs. Confirm no crop/upscale, image precedes OCR result, lightbox keyboard behavior, and ordering remains usable after image error. At desktop widths, Menu uses two columns and Today uses two-card grid. At browser zoom 200%, both collapse without horizontal overflow.

- [ ] **Step 5: Accessibility scan and focused fixes**

Run the available browser accessibility scan for the primary menu flow. Fix serious/critical findings only after grep and GitNexus impact on affected symbols. Re-run targeted UI test plus the full automated suite.

- [ ] **Step 6: Final changelog and commit**

Add:

```json
"Hoàn tất rà soát responsive, bàn phím và độ ổn định cho toàn bộ luồng đặt cơm"
```

Run `gitnexus_detect_changes({ scope: "staged" })`, review `git diff --cached`, then:

```bash
git add src tests/ui src/changelog.json
git commit -m "fix: complete UI UX quality pass"
```

## Plan 3 Final Verification

- [ ] `npm run test:ui`, `npm test`, and `npm run build` all pass from a clean checkout.
- [ ] `gitnexus_detect_changes({ scope: "all" })` reports only expected UI/order/profile query flows.
- [ ] No backend, secret, paid service, schema/RLS, admin role, or collector-paid mutation was added.
- [ ] All acceptance criteria in the approved design spec sections 10–17 are checked and recorded.
- [ ] `git status --short` contains no accidental generated files or unrelated staged changes.

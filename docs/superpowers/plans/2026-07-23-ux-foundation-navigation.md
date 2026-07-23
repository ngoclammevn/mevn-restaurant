# UX Foundation & Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây nền UX nhất quán, accessible và responsive; thay navigation mobile cuộn ngang bằng bốn nhóm rõ ràng và tạo shell Quản lý tương thích route cũ.

**Architecture:** Giữ Vue/Vite static và các page/composable hiện có. Shared UI primitives chịu trách nhiệm accessibility; `App.vue` chỉ điều phối shell theo route meta; `ManagePage.vue` gom hai page quản lý bằng nested routes mà không đổi query hoặc RLS.

**Tech Stack:** Vue 3.5, Vue Router 5, Clerk Vue 2.4, Vitest 4, Vue Test Utils, happy-dom, CSS variables.

## Global Constraints

- Miễn phí hoàn toàn; không thêm dịch vụ trả phí.
- Không thêm backend, serverless function, Clerk webhook hoặc secret key.
- Không đổi schema hoặc RLS trong plan này.
- `/menu/:id` và `/share/:id` phải tiếp tục hoạt động.
- `/my-menus` và `/dashboard` phải redirect, không trả 404.
- Vùng chạm tối thiểu 44×44 CSS px; contrast chữ thường tối thiểu 4.5:1.
- Trước khi sửa function/method, chạy `gitnexus_impact({ target, direction: "upstream" })`; cảnh báo trước nếu HIGH/CRITICAL.
- Grep toàn bộ `src/` trước khi sửa shared component/pattern.
- Trước mỗi commit: cập nhật `src/changelog.json`, chạy `gitnexus_detect_changes({ scope: "staged" })`, review diff.

---

## File Map

- Modify `package.json` — thêm UI-test scripts/dependencies.
- Modify `src/styles/tokens.css` — accessibility tokens, shell rộng, desktop/mobile nav spacing.
- Modify `src/components/ui/TextField.vue`, `TextArea.vue`, `DateField.vue`, `Spinner.vue`, `AppButton.vue` — semantic form/status primitives.
- Create `src/components/ui/AsyncState.vue` — loading/error/retry/empty state chung.
- Create `src/components/ui/SignedOutState.vue` — signed-out prompt chung.
- Create `src/components/navigation/AppBottomNav.vue` — mobile navigation bốn mục.
- Create `src/components/navigation/ManageTabs.vue` — tabs quản lý.
- Create `src/pages/ManagePage.vue` — nested route shell.
- Modify `src/App.vue`, `src/router.js`, `src/main.js`, `src/components/ui/index.js` — shell, routes, Clerk localization, exports.
- Modify `src/pages/MyMenusPage.vue`, `DashboardPage.vue`, `HistoryPage.vue`, `ProfilePage.vue` — auth/async states.
- Modify `tests/rls/orders.test.js` — đồng bộ hợp đồng đặt hộ.
- Create `tests/ui/components/form-fields.test.js`, `async-state.test.js`, `navigation.test.js`.

## Task 1: UI Test Harness and Accessible Primitives

**Files:**
- Modify: `package.json`
- Modify: `src/components/ui/TextField.vue`
- Modify: `src/components/ui/TextArea.vue`
- Modify: `src/components/ui/DateField.vue`
- Modify: `src/components/ui/Spinner.vue`
- Modify: `src/components/ui/AppButton.vue`
- Test: `tests/ui/components/form-fields.test.js`

**Interfaces:**
- Produces: `TextField`/`TextArea` props `id`, `label`, `hint`, `error`; generated ids when omitted.
- Produces: `Spinner` as `role="status"`; loading buttons expose `aria-busy`.
- Consumes: Vue `useId()` and existing `.field`, `.input`, `.alert` styles.

- [ ] **Step 1: Inspect shared usage and impact**

Run:

```bash
rg -n "<TextField|<TextArea|<DateField|<Spinner|<AppButton" src
```

Then run GitNexus impact for `TextField`, `TextArea`, `DateField`, `Spinner`, and `AppButton`. Expected: shared UI risk may be MEDIUM; review all direct consumers before editing.

- [ ] **Step 2: Add the UI test dependencies and script**

Run:

```bash
npm install --save-dev @vue/test-utils happy-dom
```

Add to `package.json` scripts without changing the existing RLS `test` script:

```json
{
  "test:ui": "vitest run tests/ui",
  "test:all": "npm run test:ui && npm test"
}
```

- [ ] **Step 3: Write the failing accessibility tests**

Create `tests/ui/components/form-fields.test.js`:

```js
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TextField from '../../../src/components/ui/TextField.vue'
import TextArea from '../../../src/components/ui/TextArea.vue'
import Spinner from '../../../src/components/ui/Spinner.vue'
import AppButton from '../../../src/components/ui/AppButton.vue'

describe('form primitives', () => {
  it.each([
    [TextField, 'input'],
    [TextArea, 'textarea'],
  ])('connects label, hint and error for %s', (component, selector) => {
    const wrapper = mount(component, {
      props: { label: 'Ghi chú', hint: 'Không bắt buộc', error: 'Không hợp lệ' },
    })
    const control = wrapper.get(selector)
    const id = control.attributes('id')
    expect(wrapper.get('label').attributes('for')).toBe(id)
    expect(control.attributes('aria-describedby')).toContain(`${id}-hint`)
    expect(control.attributes('aria-describedby')).toContain(`${id}-error`)
    expect(control.attributes('aria-invalid')).toBe('true')
  })
})

describe('loading semantics', () => {
  it('announces spinner status', () => {
    const wrapper = mount(Spinner, { props: { label: 'Đang tải menu…' } })
    expect(wrapper.get('[role="status"]').text()).toContain('Đang tải menu')
  })

  it('marks loading buttons busy', () => {
    const wrapper = mount(AppButton, {
      props: { loading: true },
      slots: { default: 'Đặt món' },
    })
    expect(wrapper.get('button').attributes('aria-busy')).toBe('true')
  })
})
```

- [ ] **Step 4: Run the test and verify failure**

Run:

```bash
npx vitest run tests/ui/components/form-fields.test.js
```

Expected: FAIL because labels lack `for`, controls lack described-by ids, spinner lacks `role=status`, and button lacks `aria-busy`.

- [ ] **Step 5: Implement the minimal semantic primitives**

Use this structure in both `TextField.vue` and `TextArea.vue`:

```vue
<script setup>
import { computed, useId } from 'vue'

const props = defineProps({
  id: { type: String, default: '' },
  label: { type: String, default: '' },
  modelValue: { type: [String, Number], default: '' },
  type: { type: String, default: 'text' },
  placeholder: { type: String, default: '' },
  hint: { type: String, default: '' },
  error: { type: String, default: '' },
  rows: { type: [Number, String], default: 3 },
})
defineEmits(['update:modelValue'])

const generatedId = useId()
const controlId = computed(() => props.id || generatedId)
const describedBy = computed(() => [
  props.hint && `${controlId.value}-hint`,
  props.error && `${controlId.value}-error`,
].filter(Boolean).join(' ') || undefined)
</script>
```

The rendered control must use:

```vue
<label v-if="label" :for="controlId">{{ label }}</label>
<input
  :id="controlId"
  :aria-describedby="describedBy"
  :aria-invalid="error ? 'true' : undefined"
/>
<span v-if="hint" :id="`${controlId}-hint`" class="hint">{{ hint }}</span>
<span v-if="error" :id="`${controlId}-error`" class="field-error">{{ error }}</span>
```

Apply the same id pattern to `DateField.vue`. Update `Spinner.vue` root to:

```vue
<div class="row loading-row" role="status" aria-live="polite">
  <span class="spinner" aria-hidden="true" />
  <span>{{ label }}</span>
</div>
```

Update the button branch in `AppButton.vue`:

```vue
<button
  v-else
  :class="cls"
  :type="type"
  :disabled="disabled || loading"
  :aria-busy="loading ? 'true' : undefined"
>
```

Add `.field-error` to `tokens.css` with accent text and `font-size: var(--fs-xs)`.

- [ ] **Step 6: Run tests and build**

Run:

```bash
npx vitest run tests/ui/components/form-fields.test.js
npm run build
```

Expected: tests PASS and Vite build succeeds.

- [ ] **Step 7: Update changelog and commit**

Add this bullet to the current VN-date entry:

```json
"Cải thiện khả năng đọc và sử dụng bàn phím cho biểu mẫu"
```

Run staged GitNexus detection, then commit:

```bash
git add package.json package-lock.json src/components/ui src/styles/tokens.css tests/ui src/changelog.json
git commit -m "fix: improve form accessibility"
```

## Task 2: Shared Signed-out, Loading, Error, and Retry States

**Files:**
- Create: `src/components/ui/AsyncState.vue`
- Create: `src/components/ui/SignedOutState.vue`
- Modify: `src/components/ui/index.js`
- Modify: `src/pages/MyMenusPage.vue`
- Modify: `src/pages/DashboardPage.vue`
- Modify: `src/pages/HistoryPage.vue`
- Modify: `src/pages/ProfilePage.vue`
- Test: `tests/ui/components/async-state.test.js`

**Interfaces:**
- Produces: `AsyncState` props `loading`, `error`, `empty`; emits `retry`.
- Produces: `SignedOutState` emits `sign-in`.
- Consumes: `EmptyState`, `Spinner`, `AppButton`, Clerk `isLoaded/isSignedIn`.

- [ ] **Step 1: Grep and impact-check every auth/loading pattern**

Run:

```bash
rg -n "isSignedIn|loading|errorMsg|<Spinner|<EmptyState" src/pages src/components
```

Run GitNexus impact on each page `load` function before editing. If any result is HIGH/CRITICAL, stop and report it.

- [ ] **Step 2: Write failing component tests**

Create `tests/ui/components/async-state.test.js`:

```js
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AsyncState from '../../../src/components/ui/AsyncState.vue'
import SignedOutState from '../../../src/components/ui/SignedOutState.vue'

describe('AsyncState', () => {
  it('shows retry for an error', async () => {
    const wrapper = mount(AsyncState, { props: { error: 'Không tải được dữ liệu.' } })
    expect(wrapper.text()).toContain('Không tải được dữ liệu.')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })
})

describe('SignedOutState', () => {
  it('uses one shared login action', async () => {
    const wrapper = mount(SignedOutState)
    expect(wrapper.text()).toContain('Chưa đăng nhập')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('sign-in')).toHaveLength(1)
  })
})
```

- [ ] **Step 3: Run and verify failure**

Run:

```bash
npx vitest run tests/ui/components/async-state.test.js
```

Expected: FAIL because the two components do not exist.

- [ ] **Step 4: Implement the shared states**

Create `AsyncState.vue`:

```vue
<script setup>
import EmptyState from './EmptyState.vue'
import Spinner from './Spinner.vue'
import AppButton from './AppButton.vue'

defineProps({
  loading: Boolean,
  error: { type: String, default: '' },
  empty: Boolean,
  emptyTitle: { type: String, default: 'Chưa có dữ liệu' },
  emptyDescription: { type: String, default: '' },
})
defineEmits(['retry'])
</script>

<template>
  <Spinner v-if="loading" label="Đang tải…" />
  <div v-else-if="error" class="stack-sm" role="alert">
    <p class="alert">{{ error }}</p>
    <AppButton variant="ghost" size="sm" @click="$emit('retry')">Thử lại</AppButton>
  </div>
  <EmptyState
    v-else-if="empty"
    :title="emptyTitle"
    :description="emptyDescription"
  />
  <slot v-else />
</template>
```

Create `SignedOutState.vue`:

```vue
<script setup>
import EmptyState from './EmptyState.vue'
import AppButton from './AppButton.vue'
defineProps({ description: { type: String, default: 'Đăng nhập để tiếp tục.' } })
defineEmits(['sign-in'])
</script>

<template>
  <EmptyState title="Chưa đăng nhập" :description="description" icon="🔒">
    <AppButton @click="$emit('sign-in')">Đăng nhập</AppButton>
  </EmptyState>
</template>
```

Export both from `src/components/ui/index.js`.

- [ ] **Step 5: Guard page loaders before network calls**

In MyMenus, Dashboard, History, and Profile, destructure:

```js
const { user, isLoaded, isSignedIn } = useUser()
```

At the beginning of protected `load()` functions:

```js
if (!isLoaded.value || !isSignedIn.value) {
  loading.value = false
  return
}
```

Render `SignedOutState` before `AsyncState`. Pass `load` to `@retry`. Do not query Supabase while signed out.

- [ ] **Step 6: Run UI tests and build**

Run:

```bash
npx vitest run tests/ui/components
npm run build
```

Expected: PASS; signed-out pages no longer show spinner/network error.

- [ ] **Step 7: Update changelog and commit**

Add:

```json
"Hiển thị hướng dẫn đăng nhập và nút thử lại nhất quán trên mọi màn hình"
```

Then:

```bash
git add src/components/ui src/pages src/changelog.json
git commit -m "fix: unify authentication and async states"
```

## Task 3: Four-group Navigation and Manage Route Shell

**Files:**
- Create: `src/components/navigation/AppBottomNav.vue`
- Create: `src/components/navigation/ManageTabs.vue`
- Create: `src/pages/ManagePage.vue`
- Modify: `src/App.vue`
- Modify: `src/router.js`
- Modify: `src/styles/tokens.css`
- Test: `tests/ui/components/navigation.test.js`

**Interfaces:**
- Produces: route group `/manage/menus` and `/manage/payments`.
- Produces: redirects from `/my-menus` and `/dashboard`.
- Produces: route meta `layout: "wide"` and `focused: true`.
- Consumes: existing `MyMenusPage.vue`, `DashboardPage.vue`, `HistoryPage.vue`, `PostMenuPage.vue`.

- [ ] **Step 1: Inspect route and nav consumers**

Run:

```bash
rg -n "'/my-menus'|\"/my-menus\"|'/dashboard'|\"/dashboard\"|app-nav|nav-link" src
```

Review all links before editing `router.js` or `App.vue`.

- [ ] **Step 2: Write failing navigation tests**

Create `tests/ui/components/navigation.test.js`:

```js
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AppBottomNav from '../../../src/components/navigation/AppBottomNav.vue'

describe('AppBottomNav', () => {
  it('contains exactly four primary destinations', () => {
    const wrapper = mount(AppBottomNav, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    })
    expect(wrapper.findAll('a').map((link) => link.text())).toEqual([
      'Hôm nay',
      'Đăng menu',
      'Đơn của tôi',
      'Quản lý',
    ])
  })
})
```

- [ ] **Step 3: Run and verify failure**

Run:

```bash
npx vitest run tests/ui/components/navigation.test.js
```

Expected: FAIL because `AppBottomNav.vue` does not exist.

- [ ] **Step 4: Implement navigation components**

Create `AppBottomNav.vue`:

```vue
<script setup>
const items = [
  { to: '/', label: 'Hôm nay', icon: '🍱' },
  { to: '/post', label: 'Đăng menu', icon: '＋' },
  { to: '/history', label: 'Đơn của tôi', icon: '◷' },
  { to: '/manage/menus', label: 'Quản lý', icon: '☰' },
]
</script>

<template>
  <nav class="bottom-nav" aria-label="Điều hướng chính">
    <router-link v-for="item in items" :key="item.to" :to="item.to" class="bottom-nav__item">
      <span aria-hidden="true">{{ item.icon }}</span>
      <span>{{ item.label }}</span>
    </router-link>
  </nav>
</template>
```

Create `ManageTabs.vue` with links `/manage/menus` and `/manage/payments`, `aria-label="Quản lý"`.
Create `ManagePage.vue`:

```vue
<script setup>
import ManageTabs from '../components/navigation/ManageTabs.vue'
</script>
<template>
  <div class="manage-page stack">
    <ManageTabs />
    <router-view />
  </div>
</template>
```

- [ ] **Step 5: Replace routes without breaking old URLs**

Use this route structure in `src/router.js`:

```js
{
  path: '/manage',
  component: () => import('./pages/ManagePage.vue'),
  redirect: '/manage/menus',
  meta: { layout: 'wide' },
  children: [
    { path: 'menus', component: () => import('./pages/MyMenusPage.vue') },
    { path: 'payments', component: () => import('./pages/DashboardPage.vue') },
  ],
},
{ path: '/my-menus', redirect: '/manage/menus' },
{ path: '/dashboard', redirect: '/manage/payments' },
```

Add `meta: { public: true, focused: true, layout: 'wide' }` to `/menu/:id`; add `layout: 'wide'` to `/`.

- [ ] **Step 6: Update App shell and responsive CSS**

In `App.vue`, use `useRoute()` and:

```js
const route = useRoute()
const isFocused = computed(() => route.meta.focused === true)
const isWide = computed(() => route.meta.layout === 'wide')
const nav = [
  { to: '/', label: 'Hôm nay' },
  { to: '/post', label: 'Đăng menu' },
  { to: '/history', label: 'Đơn của tôi' },
  { to: '/manage/menus', label: 'Quản lý' },
]
```

Render the full desktop header and `AppBottomNav` only when `!isFocused`. Bind:

```vue
<main class="app-main" :class="{ 'app-main--wide': isWide, 'app-main--focused': isFocused }">
```

In `tokens.css`, add:

```css
:root { --maxw-wide: 1200px; }
.app-main--wide { max-width: var(--maxw-wide); }
.bottom-nav { display: none; }

@media (max-width: 600px) {
  .app-nav { display: none; }
  .bottom-nav {
    position: fixed;
    inset: auto 0 0;
    z-index: 70;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    padding: 0.35rem max(0.5rem, env(safe-area-inset-right))
      calc(0.35rem + env(safe-area-inset-bottom))
      max(0.5rem, env(safe-area-inset-left));
    background: var(--card);
    border-top: 1px solid var(--line);
  }
  .bottom-nav__item {
    min-height: 52px;
    display: grid;
    place-items: center;
    align-content: center;
    gap: 0.1rem;
    font-size: var(--fs-xs);
    text-decoration: none;
  }
  .app-main:not(.app-main--focused) { padding-bottom: 6rem; }
}
```

- [ ] **Step 7: Verify navigation**

Run:

```bash
npx vitest run tests/ui/components/navigation.test.js
npm run build
```

Manual checks:

- `/my-menus` → `/manage/menus`
- `/dashboard` → `/manage/payments`
- `/menu/:id` hides global bottom nav
- 390px shows four bottom items with ≥44px targets
- desktop shows four top-level items

- [ ] **Step 8: Update changelog and commit**

Add:

```json
"Thay thanh điều hướng mobile bằng 4 mục rõ ràng và gom chức năng quản lý vào một nơi"
```

Then:

```bash
git add src/App.vue src/router.js src/styles/tokens.css src/components/navigation src/pages/ManagePage.vue tests/ui src/changelog.json
git commit -m "feat: simplify navigation and add manage shell"
```

## Task 4: Clerk Localization, Account Menu, and Contract-aligned RLS Test

**Files:**
- Modify: `src/main.js`
- Modify: `src/App.vue`
- Modify: `tests/rls/orders.test.js`
- Modify: `package.json`
- Test: `tests/rls/orders.test.js`

**Interfaces:**
- Produces: Vietnamese Clerk UI and account links for Hồ sơ/changelog.
- Produces: RLS test matching approved `orders_insert with check (true)`.
- Consumes: existing `SignInModal.vue`, Clerk `UserButton.MenuItems`, local Supabase test stack.

- [ ] **Step 1: Install Clerk localization**

Run:

```bash
npm install @clerk/localizations
```

- [ ] **Step 2: Configure Vietnamese sign-in copy**

Update `src/main.js`:

```js
import { viVN } from '@clerk/localizations'

createApp(App)
  .use(router)
  .use(clerkPlugin, {
    publishableKey: PUBLISHABLE_KEY,
    localization: viVN,
    appearance: {
      variables: {
        colorPrimary: '#1f6e45',
        borderRadius: '14px',
      },
    },
  })
  .mount('#app')
```

In `App.vue`, replace the self-closing user button with direct menu children:

```vue
<UserButton v-if="isSignedIn">
  <UserButton.MenuItems>
    <UserButton.Link href="/profile" label="Hồ sơ">
      <template #labelIcon><span aria-hidden="true">👤</span></template>
    </UserButton.Link>
    <UserButton.Action label="Có gì mới" :on-click="() => { showChangelog = true }">
      <template #labelIcon><span aria-hidden="true">✨</span></template>
    </UserButton.Action>
  </UserButton.MenuItems>
</UserButton>
```

Keep Clerk's built-in manage-account and sign-out actions. Deep-merge the `viVN` localization object in `main.js` so `signIn.start.title` reads `Đăng nhập vào Cơm Trưa`; do not mutate the imported object.

- [ ] **Step 3: Correct the stale RLS test**

Replace the incorrect test in `tests/rls/orders.test.js` with:

```js
it('cho phép đặt hộ người khác nhưng đơn thuộc về người được đặt hộ', async () => {
  const { data, error } = await asUser(USER_B)
    .from('orders')
    .insert({ menu_id: menu.id, user_id: USER_A, item_text: 'Đặt giúp A' })
    .select('user_id')
    .single()

  expect(error).toBeNull()
  expect(data.user_id).toBe(USER_A)
})
```

Do not change the update test: USER_B must still be unable to tick USER_A's order paid.

- [ ] **Step 4: Run verification**

Run:

```bash
npm run test:ui
npm test
npm run build
```

Expected: UI tests PASS; RLS tests PASS against local Supabase; build succeeds. If local Supabase is not running, start it before re-running `npm test`.

- [ ] **Step 5: Update changelog and commit**

Add:

```json
"Việt hoá màn hình đăng nhập và sửa kiểm thử đặt hộ đúng với cách ứng dụng đang hoạt động"
```

Then:

```bash
git add src/main.js src/App.vue package.json package-lock.json tests/rls/orders.test.js src/changelog.json
git commit -m "fix: localize auth and align delegated-order tests"
```

## Plan 1 Final Verification

- [ ] Run:

```bash
npm run test:ui
npm test
npm run build
git status --short
```

- [ ] Browser QA at 390px and 1280px:

  - Four-item nav is reachable and does not overlap content.
  - Focused menu route hides global nav.
  - My Menus/Dashboard signed-out states show login, not spinner/error.
  - All form controls have associated labels.
  - Clerk sign-in is Vietnamese and branded “Cơm Trưa”.

- [ ] Run `gitnexus_detect_changes({ scope: "all" })` and confirm only navigation/auth/accessibility flows are affected.

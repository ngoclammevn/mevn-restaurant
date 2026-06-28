# Today Page + MenuPage Guest UX Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove inline order form from Today page (add CTA to menu page instead), and fix MenuPage layout overflow for guest/anonymous users.

**Architecture:** Two independent file changes. TodayPage becomes a social dashboard (orders visible, form gone, CTA links to menu). MenuPage fixes a `right: 16px` presence card that bleeds past viewport and polishes the guest-banner.

**Tech Stack:** Vue 3 SFC, scoped CSS.

## Global Constraints

- No new npm packages
- No TypeScript annotations
- Keep edit-order inline form on TodayPage (Sửa button stays)
- Keep PaidToggle on TodayPage (self-tick stays)
- No changes to routing or auth

---

### Task 1: TodayPage — Remove order form, clean up state, add CTA

**Files:**
- Modify: `src/pages/TodayPage.vue`

**Interfaces:**
- Produces: TodayPage without `drafts`/`submitOrder`/`toggleDish`/`profiles`/`initDraft`; MenuBoard in view-only mode; "Vào chọn món →" button per card

- [ ] **Step 1: Remove form-related state from script**

In `src/pages/TodayPage.vue`, make these script changes:

**Line 24** — remove `createOrder` and `listProfiles` from destructure:
```js
const { updateOrder, togglePaid } = useOrders()
```

**Remove the `profiles` ref** (line 36):
```js
// DELETE: const profiles = ref([])
```

**Remove `drafts` reactive** (line 40):
```js
// DELETE: const drafts = reactive({})
```

**Remove `initDraft` function** (lines 46-50):
```js
// DELETE entire function initDraft(menuId) { ... }
```

**Remove `toggleDish` function** (lines 52-62):
```js
// DELETE entire function toggleDish(menuId, dish) { ... }
```

**Remove `submitOrder` function** (lines 85-120, the entire async function submitOrder):
```js
// DELETE entire async function submitOrder(menu) { ... }
```

- [ ] **Step 2: Clean up `load()` function**

In `load()`, remove the `listProfiles` call and `initDraft` loop. The updated `load()` becomes:

```js
async function load() {
  loading.value = true
  errorMsg.value = ''
  const { data, error } = await listMenusByDate()
  if (error) {
    errorMsg.value = 'Không tải được menu hôm nay. Kiểm tra kết nối rồi thử lại.'
  } else {
    menus.value = data ?? []
  }
  loading.value = false
}
```

- [ ] **Step 3: Update PageHeader sub text**

Find:
```html
sub="Đặt món bằng cách gõ vào form bên dưới mỗi menu."
```

Replace with:
```html
sub="Xem ai đang đặt gì — click vào menu để chọn món."
```

- [ ] **Step 4: Update MenuBoard to view-only (remove picks + toggle handler)**

Find in template:
```html
<MenuBoard
  v-if="isStructured(menu.note)"
  :note="menu.note"
  :picks="drafts[menu.id]?.picks ?? {}"
  @toggle-dish="(d) => toggleDish(menu.id, d)"
/>
```

Replace with:
```html
<MenuBoard
  v-if="isStructured(menu.note)"
  :note="menu.note"
/>
```

- [ ] **Step 5: Replace inline `<form>` with CTA button**

Find and remove the entire form block (from `<hr class="divider" />` before the form through `</form>`):
```html
          <hr class="divider" />

          <!-- Order form -->
          <form class="stack-sm" @submit.prevent="submitOrder(menu)">
            <div class="eyebrow">Đặt món</div>
            <div v-if="drafts[menu.id]" class="field">
              <label>Đặt cho</label>
              <select v-model="drafts[menu.id].orderFor" class="input">
                <option value="">Tôi (chính mình)</option>
                <option v-for="p in profiles" :key="p.id" :value="p.id">
                  {{ p.full_name }}
                </option>
              </select>
            </div>
            <TextArea
              v-if="drafts[menu.id]"
              v-model="drafts[menu.id].item_text"
              label="Món bạn muốn đặt"
              placeholder="Ví dụ: cơm tấm sườn bì chả"
              :rows="3"
            />
            <TextField
              v-if="drafts[menu.id]"
              v-model="drafts[menu.id].note"
              label="Ghi chú (tuỳ chọn)"
              placeholder="Ví dụ: ít cay, không hành"
            />
            <p v-if="drafts[menu.id]?.submitError" class="alert">
              {{ drafts[menu.id].submitError }}
            </p>
            <AppButton
              type="submit"
              :loading="drafts[menu.id]?.submitting"
              :disabled="!drafts[menu.id]?.item_text?.trim()"
            >
              Đặt món
            </AppButton>
          </form>
```

Replace with:
```html
          <hr class="divider" />

          <AppButton :to="`/menu/${menu.id}`" size="sm">
            Vào chọn món →
          </AppButton>
```

- [ ] **Step 6: Build and verify**

```bash
cd /Users/nhatminh/Desktop/MEVN/mevn-restaurant && npx vite build --mode development 2>&1 | tail -5
```

Expected: `✓ built in ...ms` with no errors. If there are "unused variable" warnings about `TextField` or `TextArea`, check if `TextArea` is still used in the edit-order inline form (it is — at `v-model="editDraft.item_text"`). Remove `TextField` from the import list if it's no longer referenced anywhere in the template.

- [ ] **Step 7: Commit**

```bash
git add src/pages/TodayPage.vue
git commit -m "feat(today): remove inline order form, add 'Vào chọn món' CTA per menu card"
```

---

### Task 2: MenuPage — Fix presence card overflow + guest-banner

**Files:**
- Modify: `src/pages/MenuPage.vue`

**Interfaces:**
- Consumes: nothing from Task 1
- Produces: no horizontal scrollbar from presence card; cleaner guest-banner text

- [ ] **Step 1: Fix `.presence-card` CSS overflow**

In `<style scoped>`, find:
```css
@media (min-width: 1080px) {
  .presence-card {
    display: block; position: fixed; top: 80px; right: 16px;
    width: 210px; z-index: 60; overflow: visible;
  }
}
```

Replace with:
```css
@media (min-width: 1080px) {
  .presence-card {
    display: block; position: fixed; top: 80px; right: 40px;
    width: 210px; z-index: 60; overflow: clip;
  }
}
```

`right: 40px` keeps the grid's `-24px` bleed inside the viewport (40 - 24 = 16px margin). `overflow: clip` contains the bleed without creating a scroll context.

- [ ] **Step 2: Update guest-banner text**

Find:
```html
<div class="guest-banner">
  <p class="guest-banner-text">Đăng nhập để đặt cơm trưa 🍱</p>
  <AppButton :to="'/sign-in'">Đăng nhập</AppButton>
</div>
```

Replace with:
```html
<div class="guest-banner">
  <p class="guest-banner-text">🍱 Đăng nhập để đặt cơm trưa cùng mọi người</p>
  <AppButton :to="'/sign-in'">Đăng nhập</AppButton>
</div>
```

- [ ] **Step 3: Build and verify**

```bash
npx vite build --mode development 2>&1 | tail -5
```

Expected: `✓ built in ...ms`, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/MenuPage.vue
git commit -m "fix(menu): presence card overflow (right: 40px, overflow: clip), guest-banner text"
```

---

## Self-Review

**Spec coverage:**
| Requirement | Task |
|---|---|
| Remove inline order form from Today page | Task 1 Steps 1–5 |
| Keep orders list (social nudge) | Not touched — already there |
| Keep edit inline for own orders | Not touched — `editDraft`, `editingOrderId`, `startEdit`, `saveEdit` kept |
| Keep PaidToggle | Not touched |
| Add "Vào chọn món" CTA button | Task 1 Step 5 |
| Update PageHeader sub text | Task 1 Step 3 |
| MenuBoard in view-only mode | Task 1 Step 4 |
| Fix presence card horizontal overflow | Task 2 Step 1 |
| Guest-banner text improvement | Task 2 Step 2 |

**Placeholder scan:** No TBDs. All code is complete.

**Type consistency:** No shared interfaces between tasks — independent.

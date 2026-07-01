# Order Summary & QR Breakdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm bảng tổng hợp đơn cần mua cho chủ menu trên MenuPage, và hiển thị chi tiết món + giá trong popup QR chuyển khoản.

**Architecture:** Tạo `OrderSummaryPanel.vue` (component mới) dùng aggregation logic thuần computed — không query DB, không composable riêng. `PaymentQRModal.vue` thêm computed `breakdown` + section template. Cả hai reuse Inspira UI components đã có trong project (`BorderBeam`, `NumberTicker`, `BlurReveal`).

**Tech Stack:** Vue 3 Composition API, motion-v (BlurReveal), @vueuse/core (NumberTicker), CSS tokens từ `src/styles/tokens.css`

## Global Constraints

- Không thêm dependency mới — `motion-v` và `@vueuse/core` đã có sẵn
- Không chạm data model, RLS, Supabase queries
- Không dùng `service_role` key hay secret key
- Clerk user id dùng `auth.jwt()->>'sub'`, không phải `auth.uid()`
- Free tier Vercel/Supabase/Clerk — không thêm backend
- Mọi thay đổi commit trước khi sang task tiếp theo
- Cập nhật `src/changelog.json` ở task cuối

---

## File Map

| File | Thay đổi |
|------|---------|
| `src/components/ui/OrderSummaryPanel.vue` | **Tạo mới** — component tổng hợp đơn |
| `src/components/ui/index.js` | **Sửa** — export `OrderSummaryPanel` |
| `src/pages/MenuPage.vue` | **Sửa** — import + dùng `<OrderSummaryPanel>` |
| `src/components/ui/PaymentQRModal.vue` | **Sửa** — thêm computed `breakdown` + template section |
| `src/changelog.json` | **Sửa** — ghi nhận tính năng mới |

---

## Task 1: Tạo OrderSummaryPanel.vue

**Files:**
- Create: `src/components/ui/OrderSummaryPanel.vue`
- Modify: `src/components/ui/index.js`

**Interfaces:**
- Consumes: `props.orders` (Array of `{ item_text: string, user: { full_name: string } }`), `props.menuNote` (string — JSON hoặc plain text)
- Produces: component `<OrderSummaryPanel>` dùng được trong Task 2

- [ ] **Step 1: Tạo file và viết aggregation logic**

Tạo `src/components/ui/OrderSummaryPanel.vue` với nội dung đầy đủ sau:

```vue
<script setup>
import { computed } from 'vue'
import BorderBeam from './BorderBeam.vue'
import NumberTicker from './NumberTicker.vue'
import BlurReveal from './BlurReveal.vue'

const props = defineProps({
  orders:   { type: Array,  required: true },
  menuNote: { type: String, default: '' },
})

function parseDishMap(note) {
  try {
    const parsed = JSON.parse(note)
    if (!Array.isArray(parsed.dishes)) return null
    const map = new Map()
    for (const d of parsed.dishes) {
      if (d.name) map.set(d.name.toLowerCase(), d.price ?? null)
    }
    return map
  } catch {
    return null
  }
}

const summary = computed(() => {
  const dishMap = parseDishMap(props.menuNote)
  const agg = new Map()

  for (const order of props.orders) {
    const lines = (order.item_text || '').split('\n').map(l => l.trim()).filter(Boolean)
    const personName = order.user?.full_name || '?'
    for (const line of lines) {
      const key = line.toLowerCase()
      if (!agg.has(key)) {
        const price = dishMap ? (dishMap.get(key) ?? null) : null
        agg.set(key, { displayName: line, count: 0, people: [], unitPrice: price })
      }
      const entry = agg.get(key)
      entry.count++
      entry.people.push(personName)
    }
  }

  return [...agg.values()]
    .map(e => ({
      ...e,
      total: e.unitPrice != null ? e.unitPrice * e.count : null,
      peopleLabel: e.people.length > 3
        ? `${e.people.slice(0, 3).join(', ')} +${e.people.length - 3} khác`
        : e.people.join(', '),
    }))
    .sort((a, b) => b.count - a.count || a.displayName.localeCompare(b.displayName, 'vi'))
})

const totalParts = computed(() => summary.value.reduce((s, e) => s + e.count, 0))

const grandTotal = computed(() => {
  const totals = summary.value.map(e => e.total)
  if (totals.some(t => t === null)) return null
  return totals.reduce((s, t) => s + t, 0)
})

function fmt(val) {
  if (val == null) return ''
  return new Intl.NumberFormat('vi-VN').format(val) + 'đ'
}
</script>

<template>
  <div v-if="summary.length" class="osp-wrap">
    <BorderBeam :size="120" :duration="8" colorFrom="#dcb464" colorTo="#1f6e45" />

    <!-- Header -->
    <div class="osp-header">
      <span class="eyebrow">🛒 Danh sách cần mua</span>
      <span class="badge badge--paid osp-badge">
        <NumberTicker :value="totalParts" /> phần
      </span>
    </div>

    <div class="osp-divider" />

    <!-- Rows -->
    <div class="osp-body">
      <BlurReveal
        v-for="(item, i) in summary"
        :key="item.displayName"
        :delay="i * 0.05"
      >
        <div class="osp-row">
          <span class="osp-dish">{{ item.displayName }}</span>
          <span class="osp-count">×{{ item.count }}</span>
          <span class="osp-people">{{ item.peopleLabel }}</span>
          <span v-if="item.total !== null" class="osp-price">{{ fmt(item.total) }}</span>
        </div>
      </BlurReveal>
    </div>

    <!-- Total (chỉ hiện khi tất cả món đều có giá) -->
    <template v-if="grandTotal !== null">
      <div class="osp-divider" />
      <div class="osp-total">
        <span>Tổng {{ totalParts }} phần</span>
        <span class="osp-total-price">
          <NumberTicker :value="grandTotal" />đ
        </span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.osp-wrap {
  position: relative;
  overflow: hidden;
  background: var(--primary-soft);
  border: 1px solid rgba(31, 110, 69, 0.25);
  border-radius: var(--radius-sm);
  padding: 0.85rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.osp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.osp-badge {
  font-size: var(--fs-xs);
  padding: 0.15rem 0.6rem;
}

.osp-divider {
  height: 1px;
  background: rgba(31, 110, 69, 0.18);
}

.osp-body {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.osp-row {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding: 0.1rem 0;
}

.osp-dish {
  font-weight: 600;
  font-size: var(--fs-sm);
  color: var(--ink);
  flex-shrink: 0;
  max-width: 40%;
}

.osp-count {
  background: var(--primary);
  color: #fff;
  font-size: var(--fs-xs);
  font-weight: 700;
  padding: 0.05rem 0.45rem;
  border-radius: var(--radius-pill);
  flex-shrink: 0;
}

.osp-people {
  color: var(--muted);
  font-size: var(--fs-xs);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.osp-price {
  color: var(--primary-ink);
  font-weight: 700;
  font-size: var(--fs-sm);
  margin-left: auto;
  flex-shrink: 0;
}

.osp-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 700;
  font-size: var(--fs-sm);
  color: var(--primary-ink);
}

.osp-total-price {
  font-size: var(--fs-base);
}
</style>
```

- [ ] **Step 2: Export từ index.js**

Đọc `src/components/ui/index.js`, thêm dòng export vào cuối (hoặc theo thứ tự alphabetical nếu file có sắp xếp):

```js
export { default as OrderSummaryPanel } from './OrderSummaryPanel.vue'
```

- [ ] **Step 3: Verify component không có lỗi syntax**

```bash
cd /Users/nhatminh/Desktop/MEVN/mevn-restaurant
npm run build 2>&1 | head -40
```

Expected: build pass hoặc chỉ warn về unused vars — không có error đỏ liên quan đến `OrderSummaryPanel`.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/OrderSummaryPanel.vue src/components/ui/index.js
git commit -m "feat: add OrderSummaryPanel component with aggregation logic and Inspira UI"
```

---

## Task 2: Tích hợp OrderSummaryPanel vào MenuPage

**Files:**
- Modify: `src/pages/MenuPage.vue`

**Interfaces:**
- Consumes: `OrderSummaryPanel` từ Task 1 — props `orders` (Array) và `menuNote` (String)
- Produces: section mới hiện cho chủ menu trong MenuPage

- [ ] **Step 1: Import OrderSummaryPanel trong MenuPage**

Mở `src/pages/MenuPage.vue`. Tìm block import destructure từ `'../components/ui'` (khoảng dòng 10–26):

```js
import {
  AppCard,
  AppButton,
  Avatar,
  TextField,
  TextArea,
  PageHeader,
  EmptyState,
  PaidStamp,
  PaidToggle,
  Spinner,
  MenuBoard,
  SparklesText,
  ConfettiBurst,
  SignInModal,
  PaymentQRModal,
} from '../components/ui'
```

Thêm `OrderSummaryPanel` vào danh sách:

```js
import {
  AppCard,
  AppButton,
  Avatar,
  TextField,
  TextArea,
  PageHeader,
  EmptyState,
  OrderSummaryPanel,
  PaidStamp,
  PaidToggle,
  Spinner,
  MenuBoard,
  SparklesText,
  ConfettiBurst,
  SignInModal,
  PaymentQRModal,
} from '../components/ui'
```

- [ ] **Step 2: Thêm OrderSummaryPanel vào template**

Trong template của `MenuPage.vue`, tìm section orders (bắt đầu khoảng dòng 478):

```html
<!-- Orders list -->
<div v-if="menu.orders && menu.orders.length > 0" class="stack-sm orders-section">
```

Thêm `<OrderSummaryPanel>` **ngay trước** `<div v-if="menu.orders && menu.orders.length > 0"...>`, nhưng **sau** `<hr class="divider" />` trước đó:

```html
<!-- Shopping list — chỉ hiện cho chủ menu -->
<OrderSummaryPanel
  v-if="menu.poster_id === myId"
  :orders="menu.orders ?? []"
  :menu-note="menu.note ?? ''"
/>

<!-- Orders list -->
<div v-if="menu.orders && menu.orders.length > 0" class="stack-sm orders-section">
```

- [ ] **Step 3: Verify thủ công**

```bash
npm run dev
```

Mở trình duyệt → vào một menu mà bạn là người đăng → kiểm tra:
- Panel xanh "🛒 Danh sách cần mua" xuất hiện phía trên danh sách đơn
- NumberTicker animate tổng số phần khi page load
- BlurReveal stagger từng dòng món
- BorderBeam chạy quanh panel
- Người khác không thấy panel (mở incognito hoặc account khác)
- Nếu menu có structured dishes (OCR): cột giá hiện, dòng tổng tiền hiện
- Nếu menu free text: chỉ hiện tên món + count + người đặt, không có cột giá

- [ ] **Step 4: Commit**

```bash
git add src/pages/MenuPage.vue
git commit -m "feat: show OrderSummaryPanel on MenuPage for menu poster"
```

---

## Task 3: Thêm breakdown vào PaymentQRModal

**Files:**
- Modify: `src/components/ui/PaymentQRModal.vue`

**Interfaces:**
- Consumes: `props.order.item_text` (string), `props.menu.note` (string | undefined) — đã có sẵn trong props
- Produces: section "Món bạn đặt" hiện trong modal trước tab VietQR/MoMo

- [ ] **Step 1: Thêm imports BlurReveal và NumberTicker**

Mở `src/components/ui/PaymentQRModal.vue`. Tìm dòng import (khoảng dòng 124–127):

```js
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import AppButton from './AppButton.vue'
import MomoQRGenerator from './MomoQRGenerator.vue'
import { LIST_BANKS } from '../../lib/banks'
```

Thêm hai import:

```js
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import AppButton from './AppButton.vue'
import BlurReveal from './BlurReveal.vue'
import MomoQRGenerator from './MomoQRGenerator.vue'
import NumberTicker from './NumberTicker.vue'
import { LIST_BANKS } from '../../lib/banks'
```

- [ ] **Step 2: Thêm computed `orderLines` và `breakdown`**

Trong `<script setup>`, thêm sau computed `memo` (khoảng dòng 209–218):

```js
const orderLines = computed(() =>
  (props.order?.item_text || '').split('\n').map(l => l.trim()).filter(Boolean)
)

const breakdown = computed(() => {
  if (!props.menu?.note) return { mode: 'free-text', lines: orderLines.value }
  try {
    const parsed = JSON.parse(props.menu.note)
    if (!Array.isArray(parsed.dishes)) return { mode: 'free-text', lines: orderLines.value }

    const items = orderLines.value.map(line => {
      const dish = parsed.dishes.find(d => d.name === line)
      return { name: line, price: dish?.price != null ? Number(dish.price) : null }
    })

    if (items.every(item => item.price !== null)) {
      return {
        mode: 'priced',
        items,
        total: items.reduce((s, i) => s + i.price, 0),
      }
    }
    return { mode: 'free-text', lines: orderLines.value }
  } catch {
    return { mode: 'free-text', lines: orderLines.value }
  }
})
```

- [ ] **Step 3: Thêm section breakdown vào template**

Trong template, tìm `.amount-display-container` (khoảng dòng 10–14):

```html
<!-- Prominent formatted price display -->
<div class="amount-display-container">
  <div class="amount-label">Số tiền cần thanh toán</div>
  <div class="amount-val">{{ formatVNCurrency(amount) }}</div>
</div>

<!-- Sleek amount adjustment field -->
<div class="field amount-adjust-field">
```

Chèn section breakdown **giữa** hai block đó:

```html
<!-- Prominent formatted price display -->
<div class="amount-display-container">
  <div class="amount-label">Số tiền cần thanh toán</div>
  <div class="amount-val">{{ formatVNCurrency(amount) }}</div>
</div>

<!-- Order breakdown -->
<BlurReveal :duration="0.4" :delay="0.1">
  <div class="breakdown-card">
    <div class="breakdown-title">Món bạn đặt</div>
    <div class="breakdown-hr" />

    <!-- Mode: có giá (structured menu, tất cả dòng match) -->
    <template v-if="breakdown.mode === 'priced'">
      <div v-for="item in breakdown.items" :key="item.name" class="breakdown-row">
        <span class="breakdown-name">{{ item.name }}</span>
        <div class="breakdown-dots" />
        <span class="breakdown-price">
          <NumberTicker :value="item.price" />đ
        </span>
      </div>
      <div class="breakdown-hr" />
      <div class="breakdown-row breakdown-row--total">
        <span>Tổng</span>
        <div class="breakdown-dots" />
        <span class="breakdown-price breakdown-price--total">
          <NumberTicker :value="breakdown.total" />đ
        </span>
      </div>
    </template>

    <!-- Mode: free text (không có giá) -->
    <template v-else>
      <div v-for="line in breakdown.lines" :key="line" class="breakdown-free-line">
        {{ line }}
      </div>
      <div class="breakdown-hr" />
      <div class="breakdown-hint">💡 Nhập số tiền bên trên theo thỏa thuận</div>
    </template>
  </div>
</BlurReveal>

<!-- Sleek amount adjustment field -->
<div class="field amount-adjust-field">
```

- [ ] **Step 4: Thêm CSS cho breakdown section**

Trong `<style scoped>` của `PaymentQRModal.vue`, thêm vào cuối (trước closing tag `</style>`):

```css
/* ── Order breakdown ── */
.breakdown-card {
  background: var(--bg-soft, var(--bg-tint));
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.breakdown-title {
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--ink-soft);
}

.breakdown-hr {
  height: 1px;
  background: var(--line);
}

.breakdown-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.breakdown-row--total {
  font-weight: 700;
}

.breakdown-name {
  font-size: var(--fs-sm);
  color: var(--ink);
  flex-shrink: 0;
}

.breakdown-dots {
  flex: 1;
  border-bottom: 1px dashed rgba(140, 110, 51, 0.35);
  margin-bottom: 3px;
  min-width: 1rem;
}

.breakdown-price {
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--ink);
  white-space: nowrap;
  flex-shrink: 0;
}

.breakdown-price--total {
  color: var(--primary-ink);
  font-weight: 700;
}

.breakdown-free-line {
  font-size: var(--fs-sm);
  color: var(--ink);
}

.breakdown-hint {
  font-size: var(--fs-xs);
  color: var(--muted);
  font-style: italic;
  line-height: 1.4;
}
```

- [ ] **Step 5: Verify thủ công**

```bash
npm run dev
```

Mở trình duyệt → vào một menu có orders → click "🔗 Quét QR" trên đơn của mình → kiểm tra:

**Trường hợp menu có OCR (structured + prices):**
- Section "Món bạn đặt" hiện ngay dưới số tiền lớn
- Từng món có dot leader và `NumberTicker` animate giá
- Dòng "Tổng" bold green cuối section
- Số tiền trong ô "Chỉnh sửa" trùng với tổng tính được

**Trường hợp menu free text:**
- Section hiện danh sách dòng text thuần
- Có hint "💡 Nhập số tiền bên trên theo thỏa thuận"
- Ô nhập tiền vẫn hoạt động bình thường

**Cả hai trường hợp:**
- BlurReveal fade+blur khi modal mở
- Layout không bị vỡ trên mobile (max-width 680px)
- Không có console error

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/PaymentQRModal.vue
git commit -m "feat: add order breakdown visualization in PaymentQRModal"
```

---

## Task 4: Cập nhật changelog

**Files:**
- Modify: `src/changelog.json`

**Interfaces:**
- Consumes: không
- Produces: entry ngày 2026-06-29 với 2 bullet points

- [ ] **Step 1: Đọc changelog hiện tại và thêm entry**

Mở `src/changelog.json`. Kiểm tra entry đầu tiên trong mảng:
- Nếu `date === "2026-06-29"` → **thêm vào mảng `changes`** của entry đó
- Nếu chưa có → **thêm object mới vào đầu mảng**

Nội dung cần thêm vào `changes`:
```json
"Thêm bảng tổng hợp đơn cần mua cho người đăng menu (tên món, số lượng, ai đặt, tổng tiền)",
"Hiển thị chi tiết món và giá ngay trong popup quét QR để rõ hơn cơ sở tính tiền"
```

Ví dụ nếu cần tạo entry mới:
```json
{
  "date": "2026-06-29",
  "changes": [
    "Thêm bảng tổng hợp đơn cần mua cho người đăng menu (tên món, số lượng, ai đặt, tổng tiền)",
    "Hiển thị chi tiết món và giá ngay trong popup quét QR để rõ hơn cơ sở tính tiền"
  ]
}
```

- [ ] **Step 2: Verify build cuối cùng**

```bash
npm run build 2>&1 | tail -20
```

Expected: `✓ built in ...` — không có error.

- [ ] **Step 3: Commit cuối**

```bash
git add src/changelog.json
git commit -m "chore: update changelog for order summary and QR breakdown features"
```

---

## Self-Review

**Spec coverage:**
- ✅ Shopping list hiện trên MenuPage cho chủ menu → Task 2
- ✅ Gộp đơn case-insensitive (free text) / exact match (structured) → Task 1 `parseDishMap` + `key = line.toLowerCase()`
- ✅ Cột tên món, count badge, người đặt (truncate >3), giá → Task 1 template
- ✅ Sort: count DESC → Task 1 `.sort()`
- ✅ Tổng tiền chỉ hiện khi tất cả có giá → Task 1 `grandTotal`
- ✅ BorderBeam + NumberTicker + BlurReveal → Task 1
- ✅ QR modal: priced mode với dot leader + NumberTicker → Task 3
- ✅ QR modal: free-text mode với hint → Task 3
- ✅ Logic `onMounted` tính `amount.value` không thay đổi → Task 3 không chạm onMounted
- ✅ Changelog → Task 4

**Placeholder scan:** Không có TBD, TODO, hay "similar to Task N".

**Type consistency:** `breakdown.mode` dùng `'priced'` / `'free-text'` nhất quán giữa computed và template. `breakdown.items[].price` luôn là `Number | null`. `breakdown.total` là `Number`.

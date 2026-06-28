# PostMenuPage — Overflow Fix + DateField Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix image preview overflow trong FileUpload component và thêm DateField component dùng flatpickr thay native date input trong PostMenuPage.

**Architecture:** Task 1 là CSS fix độc lập trên FileUpload.vue. Task 2 tạo DateField.vue mới wrap flatpickr, export ra ui/index.js, rồi swap vào PostMenuPage. Hai task độc lập — có thể làm song song.

**Tech Stack:** Vue 3, flatpickr, GSAP (đã có), CSS scoped

## Global Constraints

- Không thêm dependency nào khác ngoài flatpickr
- Giữ `modelValue` format `YYYY-MM-DD` để tương thích với logic hiện tại trong PostMenuPage
- Style dùng CSS variables đã có: `--primary`, `--bg`, `--card`, `--line`, `--line-strong`, `--radius`, `--radius-sm`, `--ink`, `--ink-soft`, `--fs-sm`, `--fs-xs`
- Không refactor logic OCR, submit, hay bất kỳ phần nào khác của PostMenuPage

---

## Task 1: Fix overflow trong FileUpload.vue

**Files:**
- Modify: `src/components/ui/FileUpload.vue` (CSS section, dòng ~280–385)

**Interfaces:**
- Produces: không thay đổi API component — chỉ fix visual

- [ ] **Step 1: Thêm `overflow: hidden` vào `.file-upload-container`**

Trong `<style scoped>` của `FileUpload.vue`, tìm:

```css
.file-upload-container {
  position: relative;
  width: 100%;
  border-radius: var(--radius-lg);
  isolation: isolate;
}
```

Thay bằng:

```css
.file-upload-container {
  position: relative;
  width: 100%;
  border-radius: var(--radius-lg);
  isolation: isolate;
  overflow: hidden;
}
```

- [ ] **Step 2: Tắt `transform-style` khi `has-file`**

Tìm block `.liquid-glass-card` (có `transform-style: preserve-3d`):

```css
.liquid-glass-card {
  ...
  transform-style: preserve-3d;
}
```

Thêm override cho trạng thái `has-file`:

```css
.liquid-glass-card.has-file {
  cursor: default;
  padding: 0.6rem;
  background: rgba(255, 255, 255, 0.35);
  transform-style: flat;
}
```

> `transform-style: flat` hủy 3D context, ngăn children bị đẩy ra ngoài bounds khi GSAP tilt đã xong.

- [ ] **Step 3: Verify thủ công**

1. Chạy `npm run dev`
2. Vào `/post`
3. Upload một ảnh thực đơn
4. Kiểm tra: image preview nằm gọn trong card, ocr-checkbox-field không bị overlap
5. Kiểm tra: nút xoá ảnh (✕) vẫn hoạt động

---

## Task 2: DateField component với flatpickr

**Files:**
- Install: `flatpickr` npm package
- Create: `src/components/ui/DateField.vue`
- Modify: `src/components/ui/index.js` — thêm export
- Modify: `src/pages/PostMenuPage.vue` — swap date input

**Interfaces:**
- Produces: `<DateField v-model="menuDate" label="Ngày" />`
  - Props: `label: String`, `modelValue: String` (format `YYYY-MM-DD`)
  - Emits: `update:modelValue` với string `YYYY-MM-DD`

### Step 2.1 — Cài flatpickr

- [ ] **Chạy:**

```bash
npm install flatpickr
```

Kiểm tra `package.json` có `"flatpickr": "^4.x.x"` trong `dependencies`.

### Step 2.2 — Tạo DateField.vue

- [ ] **Tạo file `src/components/ui/DateField.vue`:**

```vue
<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import flatpickr from 'flatpickr'
import { Vietnamese } from 'flatpickr/dist/l10n/vn.js'
import 'flatpickr/dist/flatpickr.min.css'

const props = defineProps({
  modelValue: { type: String, default: '' },
  label:      { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const inputRef = ref(null)
let fp = null

onMounted(() => {
  fp = flatpickr(inputRef.value, {
    dateFormat:    'Y-m-d',
    locale:        Vietnamese,
    allowInput:    true,
    disableMobile: false,
    defaultDate:   props.modelValue || undefined,
    onChange(selectedDates, dateStr) {
      emit('update:modelValue', dateStr)
    },
  })
})

onUnmounted(() => {
  fp?.destroy()
})

watch(() => props.modelValue, (val) => {
  if (fp && val !== fp.input.value) {
    fp.setDate(val, false)
  }
})
</script>

<template>
  <div class="field">
    <label v-if="label">{{ label }}</label>
    <input ref="inputRef" type="text" class="input" :value="modelValue" readonly placeholder="Chọn ngày..." />
  </div>
</template>

<style>
/* Override flatpickr calendar để match design system */
.flatpickr-calendar {
  font-family: var(--font, system-ui, sans-serif);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius);
  box-shadow: 0 8px 24px rgba(15, 20, 13, 0.12);
  background: var(--card);
}

.flatpickr-day.selected,
.flatpickr-day.selected:hover {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}

.flatpickr-day:hover {
  background: var(--primary-soft);
  border-color: transparent;
  color: var(--primary-ink);
}

.flatpickr-day.today {
  border-color: var(--primary);
}

.flatpickr-months .flatpickr-month,
.flatpickr-weekdays,
span.flatpickr-weekday {
  background: var(--card);
  color: var(--ink);
}

.flatpickr-current-month .flatpickr-monthDropdown-months,
.flatpickr-current-month input.cur-year {
  color: var(--ink);
  font-weight: 700;
}

.flatpickr-prev-month svg,
.flatpickr-next-month svg {
  fill: var(--ink-soft);
}

.flatpickr-prev-month:hover svg,
.flatpickr-next-month:hover svg {
  fill: var(--primary);
}

.flatpickr-day {
  color: var(--ink);
  border-radius: var(--radius-sm);
}

.flatpickr-day.flatpickr-disabled,
.flatpickr-day.flatpickr-disabled:hover {
  color: var(--ink-soft);
  opacity: 0.4;
}
</style>
```

> CSS cho flatpickr dùng `<style>` không có `scoped` vì flatpickr render calendar ra ngoài DOM component.

### Step 2.3 — Export ra index.js

- [ ] **Mở `src/components/ui/index.js`, thêm dòng:**

```js
export { default as DateField } from './DateField.vue'
```

### Step 2.4 — Swap trong PostMenuPage.vue

- [ ] **Thêm `DateField` vào import trong PostMenuPage:**

```js
import { AppCard, AppButton, TextArea, TextField, PageHeader, FileUpload, DateField } from '../components/ui'
```

- [ ] **Tìm và thay đoạn date input (dòng ~370–378):**

Xoá:
```html
<!-- Date -->
<div class="field">
  <label>Ngày</label>
  <input
    v-model="menuDate"
    type="date"
    class="input"
  />
</div>
```

Thay bằng:
```html
<!-- Date -->
<DateField v-model="menuDate" label="Ngày" />
```

### Step 2.5 — Verify thủ công

- [ ] **Kiểm tra:**

1. Chạy `npm run dev`
2. Vào `/post`
3. Click vào field "Ngày" — flatpickr calendar hiện ra, tiếng Việt
4. Chọn một ngày → field cập nhật, tiêu đề menu tự update theo
5. Kiểm tra ngày được truyền đúng format `YYYY-MM-DD` vào `menuDate`
6. Submit form → menu được tạo với ngày đúng

---

## Self-Review

**Spec coverage:**
- ✓ Fix overflow FileUpload → Task 1
- ✓ DateField với flatpickr, 1 input → Task 2
- ✓ Style match design system → CSS override block trong DateField.vue
- ✓ Format YYYY-MM-DD preserved → `dateFormat: 'Y-m-d'`
- ✓ Export + swap trong PostMenuPage → Steps 2.3 & 2.4

**Placeholders:** Không có.

**Type consistency:** `modelValue` là `String` format `YYYY-MM-DD` xuyên suốt — khớp với `menuDate` ref trong PostMenuPage và `title` computed dùng `formatVNDate(menuDate.value)`.

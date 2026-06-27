# Spec: PostMenuPage — Fix Overflow + DateField Component

**Date:** 2026-06-26  
**Scope:** `src/pages/PostMenuPage.vue`, `src/components/ui/FileUpload.vue`, new `src/components/ui/DateField.vue`

---

## 1. Fix overflow trong FileUpload

### Vấn đề
Sau khi chọn ảnh, image preview và ocr-checkbox-field bên dưới bị "vỡ" ra ngoài `.card` wrapper. Hai nguyên nhân:

1. `.liquid-blob` dùng `top: -20px; bottom: -10px` — tràn ra ngoài `.file-upload-container` dù có `isolation: isolate`
2. `.liquid-glass-card` có `transform-style: preserve-3d` — khi GSAP tilt, children bị đẩy ra ngoài stacking context

### Fix
- Thêm `overflow: hidden` vào `.file-upload-container` → clip blobs bên trong
- Khi `has-file`: tắt `transform-style` (không cần tilt khi đang preview ảnh) bằng cách thêm class conditional hoặc CSS override

**Files thay đổi:** `src/components/ui/FileUpload.vue`

---

## 2. DateField component

### Mục tiêu
Thay raw `<input type="date" class="input">` trong PostMenuPage bằng component `DateField.vue` dùng **flatpickr** — 1 input duy nhất, style khớp design system.

### Cài đặt
```
npm install flatpickr
```

### Component API
```vue
<DateField
  v-model="menuDate"
  label="Ngày"
/>
```

- `modelValue`: string `YYYY-MM-DD`
- `label`: string (optional)
- Emit: `update:modelValue` với string `YYYY-MM-DD`

### Implementation
- Tạo `src/components/ui/DateField.vue`
- Mount flatpickr trên `<input class="input">` trong `onMounted`, destroy trong `onUnmounted`
- Config flatpickr:
  - `dateFormat: 'Y-m-d'` (match format hiện tại)
  - `locale: Vietnamese` (import từ `flatpickr/dist/l10n/vn.js`)
  - `allowInput: true`
  - `disableMobile: false`
- Watch `modelValue` để sync ngược từ ngoài vào flatpickr instance
- Override CSS flatpickr với CSS variables của project (`--primary`, `--bg`, `--card`, `--line`, etc.)
- Export từ `src/components/ui/index.js`

### PostMenuPage thay đổi
- Import `DateField` thay vì raw `<input>`
- Xoá `<div class="field">` wrapper thủ công (DateField tự có)

---

## 3. Không thay đổi
- Logic OCR, form submit, image handling — giữ nguyên
- Các component khác trong `ui/` — không đụng tới

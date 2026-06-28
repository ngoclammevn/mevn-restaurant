# Ordering UX v2 — Swipeable Menu + Cart + Social Nudge

**Ngày:** 2026-06-25  
**Trạng thái:** Đã duyệt  
**Phạm vi:** TodayPage, MenuPage, composables, deps mới

---

## 1. Tổng quan

Nâng cấp trải nghiệm đặt cơm từ "form nhập liệu" thành "app đặt đồ ăn thực sự" cho nhóm ~20 người. Gồm 4 nhóm thay đổi:

1. **Bug fixes** — nhỏ, làm trước
2. **Social nudge** — ai chưa đặt (Feature 9)
3. **Quick re-order** — đặt lại như lần trước (Feature 8)
4. **Swipe carousel + Cart** — layout ngang + chọn món có số lượng (Feature 7)

Ràng buộc bất biến: không đổi DB schema, không thêm backend, tương thích ngược hoàn toàn với đơn hàng cũ.

---

## 2. Bug Fixes (Nhóm 1)

### 2.1 Tên model sai
- **File:** `src/pages/PostMenuPage.vue` dòng 418
- **Hiện tại:** `"Gemini 3.5 Flash (Miễn phí)"`
- **Sửa thành:** `"Gemini 3.1 Flash Lite (Miễn phí)"`

### 2.2 `selectedDish` không reset sau submit
- **File:** `src/pages/TodayPage.vue` trong hàm `submitOrder()`
- **Hiện tại:** `draft.item_text`, `draft.note`, `draft.orderFor` bị reset nhưng thiếu `draft.selectedDish`
- **Sửa:** thêm `draft.selectedDish = null` vào khối reset sau submit thành công

### 2.3 Dropdown "Đặt cho" list cả bản thân
- **File:** `src/pages/TodayPage.vue` trong template dropdown
- **Sửa:** filter `profiles.filter(p => p.id !== myId)` trước khi render options

---

## 3. Social Nudge — "Ai chưa đặt" (Nhóm 2)

### Mục tiêu
Hiển thị ngay trên mỗi menu card: ai đã đặt, ai chưa — giúp người thu tiền và đồng nghiệp nhắc nhau mà không cần vào Dashboard.

### Logic
```
chưa đặt = profiles.filter(p => !menu.orders.some(o => o.user_id === p.id))
đã đặt   = profiles.filter(p =>  menu.orders.some(o => o.user_id === p.id))
```

### UI
- Vị trí: ngay dưới header của menu card, trước phần hiển thị món
- Dạng: một dòng nhỏ `"X/20 người đã đặt"` + row avatar nhỏ (28px) của **những người chưa đặt**
- Avatar dùng `Animated Tooltip` (Inspira UI) — hover/tap hiện tên
- Nếu tất cả đã đặt: ẩn row này hoặc hiện `"✓ Mọi người đã đặt rồi!"` màu xanh
- Nếu chỉ mình chưa đặt: highlight nhẹ avatar của mình (ring màu --accent)

### Data availability
`profiles` đã được load sẵn trong `TodayPage.onMounted()` — không cần query thêm.

---

## 4. Quick Re-order — "Đặt lại như lần trước" (Nhóm 3)

### Mục tiêu
Người dùng hay đặt cùng 1 món mỗi ngày → 1 tap là xong.

### Logic
Khi load TodayPage, nếu user chưa có đơn trong menu hiện tại → fetch 1 order gần nhất của họ (bất kỳ menu nào, kể cả hôm nay):

```sql
SELECT item_text, note FROM orders
WHERE user_id = $myId
ORDER BY created_at DESC
LIMIT 1
```

Chip chỉ hiện khi `menu.orders.find(o => o.user_id === myId)` là falsy — tức là chưa đặt cho menu này. Không cần filter theo menu_id.

Lưu vào composable `useOrders` hoặc local ref `lastOrder`.

### UI
- Vị trí: ngay trên form đặt món, chỉ hiện khi user **chưa có đơn** trong menu này
- Dạng: chip nhỏ với text `"↩ Đặt lại: Cơm tấm sườn"` (tên từ `lastOrder.item_text`)
- Tap vào chip → pre-fill cart/form với món đó (quantity = 1)
- Chip ẩn đi sau khi đã chọn hoặc sau khi đặt thành công

### Backward compat
- `lastOrder` có thể là đơn text tự do (không có `selected_dish`) → vẫn pre-fill `item_text`, không cần dish object
- Nếu menu hiện tại là OCR structured → chip pre-fill item_text, người dùng vẫn có thể chọn lại từ dish list

---

## 5. Swipe Carousel + Cart Ordering (Nhóm 4)

### 5.1 Layout mới cho TodayPage

**Trước:** vertical stack `<AppCard v-for="menu in menus">`

**Sau:** horizontal carousel dùng **Apple Card Carousel** (Inspira UI)
- Mỗi menu = 1 slide full-width
- Dot/pill indicator ở dưới khi có ≥2 menus (ẩn khi chỉ có 1)
- Vuốt ngang hoặc click dot để chuyển menu
- Keyboard: ArrowLeft/ArrowRight để chuyển (accessibility)
- Mobile: touch swipe native

**Backward compat:** Layout mới chỉ thay đổi cách navigate giữa các menu. Nội dung bên trong mỗi card giữ nguyên logic.

### 5.2 Dish Selection với Cart (chỉ cho OCR structured menu)

**Điều kiện áp dụng:** `isStructuredMenu(menu.note) === true`

**UI trong mỗi menu card:**

```
[Tab phân loại — Morphing Tabs]
  Cơm gà | Món canh | Món thêm

[Danh sách món theo category]
  Cơm tấm sườn bì chả        45.000đ    [−] 0 [+]
  Cơm gà nướng               40.000đ    [−] 0 [+]
  ─────────────────────────────────────────────────
  Canh chua cá                15.000đ   [−] 0 [+]

[Footer sticky trong card]
  Ghi chú: [___________________]
  [   ✨ Đặt 95.000đ   ]  ← Shimmer Button + Number Ticker
```

- `[−] 0 [+]` — quantity stepper đơn giản, min 0, max 5
- Khi tất cả quantity = 0 → nút Đặt bị disable
- Tổng tiền dùng **Number Ticker** animate mỗi lần thêm/bớt
- Nút Đặt dùng **Shimmer Button**
- Submit xong → **Confetti** burst nhỏ + nút đổi thành "✓ Đã đặt"

**Đặt cho người khác:** dropdown "Đặt cho" vẫn giữ, nằm trên dish list. Khi chọn người khác → Confetti không hiện (tránh nhầm lẫn).

### 5.3 Text-only menu (backward compat)

Nếu `isStructuredMenu(menu.note) === false` → hiển thị y chang cũ:
- Ảnh menu (nếu có)
- Note text
- OcrHelper (Tesseract fallback nếu có ảnh)
- Textarea tự do + TextField ghi chú
- Nút "Đặt món" (AppButton bình thường, không Shimmer)

### 5.4 Data model — Cart trong `note` JSON

**Format mới** (đơn từ OCR cart):
```json
{
  "items": [
    { "dish": { "name": "Cơm tấm sườn bì chả", "price": 45000, "category": "Cơm", "calories": 650, "description": "..." }, "quantity": 1 },
    { "dish": { "name": "Canh chua cá", "price": 15000, "category": "Món canh", "calories": 80, "description": "..." }, "quantity": 2 }
  ],
  "user_note": "Ít cay"
}
```

**`item_text`** = human-readable summary: `"Cơm tấm sườn bì chả x1, Canh chua cá x2"`

**Tổng tiền** = `items.reduce((sum, i) => sum + i.dish.price * i.quantity, 0)`

**Backward compat đọc đơn cũ:**
```js
function parseOrderDisplay(order) {
  // Format mới: items array
  if (order.note?.items) return order.note
  // Format cũ: selected_dish
  if (order.note?.selected_dish) return { items: [{ dish: order.note.selected_dish, quantity: 1 }], user_note: order.note.user_note }
  // Thuần text
  return { items: null, user_note: order.note }
}
```

### 5.5 Dashboard & hiển thị đơn đã đặt

- `displayOrderItemText(order)` đã có → thêm case cho format mới: ghép items thành string
- Tổng tiền per person: `parseOrderDisplay(order).items?.reduce(...)` → hiển thị trong Dashboard
- `is_paid` vẫn là boolean per order (không thay đổi)

---

## 6. Dependencies mới cần cài

```bash
npm install motion-v canvas-confetti
```

- `motion-v` — cho Apple Card Carousel, Morphing Tabs, Animated Tooltip, Number Ticker
- `canvas-confetti` — cho Confetti component
- `gsap` đã có sẵn
- TailwindCSS v4 **không cần** — dùng CSS variables override

### Inspira UI components cần copy vào `src/components/ui/`:
1. `AppleCardCarousel.vue` — swipe carousel
2. `NumberTicker.vue` — animated price
3. `ShimmerButton.vue` — CTA order button
4. `AnimatedTooltip.vue` — avatar tooltip
5. `MorphingTabs.vue` — category tabs
6. `Confetti.vue` — celebration

---

## 7. Files bị ảnh hưởng

| File | Thay đổi |
|------|----------|
| `src/pages/TodayPage.vue` | Layout carousel, cart UI, social nudge, re-order chip |
| `src/composables/useOrders.js` | Thêm `fetchLastOrder()` |
| `src/pages/MenuPage.vue` | Đồng bộ cart UI (tương tự TodayPage) |
| `src/pages/PostMenuPage.vue` | Sửa tên model |
| `src/components/ui/` | Thêm 6 Inspira UI components |
| `src/lib/useOCR.js` | Không thay đổi |
| `src/lib/gemini.js` | Không thay đổi |
| `supabase/migrations/` | Không thay đổi |

---

## 8. Thứ tự triển khai đề xuất

1. Bug fixes (15 phút) — deploy ngay không risk
2. Cài deps + copy Inspira UI components (30 phút)
3. Social nudge "ai chưa đặt" (1-2 giờ)
4. Quick re-order chip (1-2 giờ)
5. Swipe carousel layout (2-3 giờ)
6. Cart dish selection UI (3-4 giờ)
7. Sync MenuPage với cart logic (1 giờ)
8. Test backward compat với đơn cũ + đăng changelog

---

## 9. Rủi ro & lưu ý

- **Apple Card Carousel** của Inspira UI có thể cần adapt vì dùng Tailwind class — sẽ override bằng CSS vars của app
- **Morphing Tabs** cần check render với nhiều category (>5 nhóm) trên mobile
- `fetchLastOrder()` chỉ chạy 1 lần khi load, không realtime — chấp nhận được
- Đơn cũ (text tự do) **không có tổng tiền** — Dashboard sẽ hiện `N/A` hoặc bỏ trống cột giá, không crash

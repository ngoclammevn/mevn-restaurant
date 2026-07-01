# Design: Order Summary Panel & QR Breakdown

**Date:** 2026-06-29
**Status:** Approved
**Branch:** nhat

---

## Tổng quan

Hai tính năng bổ sung nhau, giúp **chủ đơn** và **người đặt** đều có thông tin rõ ràng hơn:

1. **OrderSummaryPanel** — Bảng tổng hợp đơn cần mua (chỉ chủ menu thấy) trên `MenuPage`
2. **QR Breakdown** — Hiển thị chi tiết món + giá trong `PaymentQRModal`

---

## Feature 1: OrderSummaryPanel

### Vị trí & Điều kiện hiện

- File: `src/components/ui/OrderSummaryPanel.vue` (component mới)
- Dùng trong: `src/pages/MenuPage.vue`
- Điều kiện render: `menu.poster_id === myId && menu.orders.length > 0`
- Vị trí trong MenuPage: ngay trên section "Đơn đặt (N)", sau `<hr class="divider" />`

### Props

```js
props: {
  orders:   Array,  // menu.orders — [{ item_text, user: { full_name } }]
  menuNote: String, // menu.note — JSON string hoặc plain text
}
```

### Logic tổng hợp

```
1. Parse menuNote:
   - isStructured = JSON.parse(menuNote).dishes là Array hợp lệ
   - dishMap = Map<name.toLowerCase(), { price }> (chỉ khi isStructured)

2. Với mỗi order trong orders:
   - Tách item_text theo '\n', trim, bỏ dòng rỗng
   - Mỗi dòng là 1 key = dòng.toLowerCase()

3. Gộp theo key:
   aggregated[key] = {
     displayName,     // text gốc của người đầu tiên ghi
     count,           // số lần xuất hiện
     people,          // [full_name] — tên tất cả người đặt dòng này
     unitPrice,       // null | Number (từ dishMap nếu isStructured)
     total,           // null | unitPrice * count
   }

4. Sort: count DESC, displayName ASC

5. Computed:
   - totalParts = sum(count)
   - grandTotal = sum(total) (null nếu bất kỳ total nào là null)
```

### Hiển thị

**Header:**
- Eyebrow label: "🛒 DANH SÁCH CẦN MUA"
- Badge xanh (`.badge--paid`): `<NumberTicker :value="totalParts" /> phần`

**Mỗi dòng món** (BlurReveal stagger 50ms/dòng):
| Cột | Nội dung | Style |
|-----|----------|-------|
| Tên món | `displayName` | `font-weight: 600`, `color: var(--ink)` |
| Count | `×N` | pill `background: var(--primary)`, `color: #fff` |
| Người đặt | comma-separated `full_name` — truncate: nếu > 3 người thì "Minh, Lan +N khác" | `color: var(--muted)`, `font-size: var(--fs-xs)` |
| Giá | `fmtPrice(total)` — ẩn nếu `total === null` | `color: var(--primary-ink)`, `font-weight: 700`, align right |

**Dòng tổng** (chỉ hiện khi `grandTotal !== null`):
- Divider + "Tổng `totalParts` phần · `<NumberTicker :value="grandTotal" />đ`"
- Style: `font-weight: 700`, `color: var(--primary-ink)`

**Wrapper:**
- `position: relative; overflow: hidden`
- Background: `var(--primary-soft)` (#e4f0e7)
- Border: `1px solid rgba(31, 110, 69, 0.25)`
- `<BorderBeam :size="120" :duration="8" colorFrom="#dcb464" colorTo="#1f6e45" />`

---

## Feature 2: QR Breakdown trong PaymentQRModal

### Vị trí

File: `src/components/ui/PaymentQRModal.vue` (chỉnh sửa, không tạo file mới)

Section mới đặt **ngay sau** `.amount-display-container`, trước `.amount-adjust-field`.

Bọc toàn bộ section trong `<BlurReveal>` để animate khi modal mở.

### Logic

```js
// computed: orderLines
orderLines = order.item_text
  .split('\n')
  .map(l => l.trim())
  .filter(Boolean)

// computed: breakdown (reuse logic onMounted hiện tại)
if (isStructured(menu.note)):
  forEach line in orderLines:
    dish = dishes.find(d => d.name === line)  // exact match, case-sensitive
    if dish found → { name: line, price: dish.price }
    else          → { name: line, price: null }
  
  allPriced = breakdown.every(b => b.price !== null)
  // Nếu allPriced → mode "có giá", ngược lại → mode "free text"

if NOT isStructured OR NOT allPriced:
  mode = 'free-text'
  breakdown = orderLines.map(l => ({ name: l, price: null }))
```

### Hiển thị

**Mode "có giá" (structured + tất cả dòng match được giá):**
```
┌─ Món bạn đặt ─────────────────────────────────────┐
│  Cơm gà ·············· NumberTicker(35.000) đ     │
│  Canh chua ············ NumberTicker(15.000) đ     │
│  ─────────────────────────────────────────────    │
│  Tổng ················ NumberTicker(50.000) đ     │  bold, primary-ink
└────────────────────────────────────────────────────┘
```
- Dot leader (`·`) giữa tên và giá, giống MenuBoard style
- `NumberTicker` cho mỗi giá và tổng

**Mode "free text" (không có giá hoặc không match):**
```
┌─ Món bạn đặt ─────────────────────────────────────┐
│  Cơm tấm sườn bì chả                              │
│  Canh chua                                         │
│  ─────────────────────────────────────────────    │
│  💡 Nhập số tiền bên trên theo thỏa thuận          │  muted, italic, fs-xs
└────────────────────────────────────────────────────┘
```

**Style container:** reuse `.payment-details-card` (background `var(--bg-soft)`, border `var(--line)`, padding 16px, radius 10px)

**Lưu ý:** Logic `onMounted` tính `amount.value` giữ nguyên — breakdown chỉ là UI minh bạch, không thay đổi cách tính số tiền.

---

## Files thay đổi

| File | Loại thay đổi |
|------|---------------|
| `src/components/ui/OrderSummaryPanel.vue` | Tạo mới |
| `src/components/ui/index.js` | Export `OrderSummaryPanel` |
| `src/pages/MenuPage.vue` | Import + dùng `<OrderSummaryPanel>` |
| `src/components/ui/PaymentQRModal.vue` | Thêm breakdown section + BlurReveal |
| `src/changelog.json` | Cập nhật |

---

## Không thay đổi

- Data model, RLS, Supabase queries — không chạm
- `useDashboard.js`, `useOrders.js` — không thay đổi
- Logic `onMounted` tính `amount.value` trong PaymentQRModal — giữ nguyên
- `TodayPage.vue` — không thêm shopping list (chỉ MenuPage)

---

## Dependencies mới

Không có. Project đã có `motion-v`, `@vueuse/core`, `BorderBeam`, `NumberTicker`, `BlurReveal`.

# Thiết kế — Textarea đặt món + Sửa đơn có lịch sử

> Ngày: 2026-06-23 · Trạng thái: đã duyệt, sẵn sàng implement

## Tóm tắt

Hai cải tiến nhỏ cho luồng đặt món:
1. Trường "Món bạn muốn đặt" đổi sang textarea nhiều dòng.
2. Chủ đơn có thể sửa đơn sau khi đặt; mọi người trên trang menu thấy dấu "đã sửa lúc HH:mm".

## 1. Migration DB

```sql
alter table orders add column updated_at timestamptz;
```

- Nullable — `null` nghĩa là chưa bao giờ sửa, phân biệt được với đơn gốc.
- Không cần RLS mới: policy `orders_update` hiện tại đã cho phép chủ đơn update mọi cột của đơn mình.

## 2. useOrders.js

Thêm hàm `updateOrder`:

```js
async function updateOrder({ id, item_text, note = null }) {
  return sb.from('orders')
    .update({ item_text, note, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
}
```

Export thêm `updateOrder` từ `useOrders`.

## 3. Form đặt món (MenuPage.vue)

- Đổi `TextField` → `TextArea` (rows=3) cho trường `item_text` ("Món bạn muốn đặt").
- Trường `note` giữ nguyên `TextField`.
- Import `TextArea` từ `../components/ui`.

## 4. Hiển thị đơn — dấu "đã sửa"

Trong mỗi `order-row`, sau `<p class="order-item">`:

```html
<p v-if="order.updated_at" class="meta order-edited-at">
  đã sửa lúc {{ formatVNTime(order.updated_at) }}
</p>
```

Hàm `formatVNTime(iso)` thêm vào `src/lib/date.js`:
- Hiện `HH:mm` theo giờ VN (UTC+7) dùng `Intl.DateTimeFormat` với `timeZone: 'Asia/Ho_Chi_Minh'`.

## 5. Edit inline (MenuPage.vue)

### State

```js
const editingOrderId = ref(null)
const editDraft = reactive({ item_text: '', note: '' })
const editSaving = ref(false)
const editError = ref('')
```

### Luồng

1. Chủ đơn bấm nút **Sửa** (ghost, size sm) → `startEdit(order)`: set `editingOrderId`, copy `item_text` + `note` vào `editDraft`.
2. Form inline thay thế phần hiển thị text: TextArea cho `item_text`, TextField cho `note`, nút **Lưu** + **Huỷ**.
3. **Lưu**: gọi `updateOrder`, cập nhật local state (`menu.value.orders[idx]`), clear `editingOrderId`.
4. **Huỷ**: clear `editingOrderId`, không thay đổi gì.
5. Nút Sửa chỉ render khi `order.user_id === myId` — không cho sửa đơn đặt hộ người khác.

### Validation

- Nút Lưu disabled khi `editDraft.item_text.trim()` rỗng (giống nút Đặt món).

## 6. Không thay đổi

- Trường `note` trong form đặt mới giữ `TextField` (ghi chú ngắn, 1 dòng đủ).
- Không tự cuộn sau khi đặt thành công.
- Không thay đổi RLS, không thêm bảng.

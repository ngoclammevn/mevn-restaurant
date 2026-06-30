# Thiết kế — "Menu của tôi" (quản lý menu đã đăng)

> Ngày: 2026-06-30 · Trạng thái: đã duyệt phạm vi, implement trực tiếp (feature nhỏ)

## Tóm tắt

Người đăng menu cần một nơi để **quản lý tất cả menu họ đã đăng** xuyên ngày — hiện
chỉ có Dashboard "ai chưa trả" theo từng ngày và "Đơn của tôi" (đơn mình đặt), chưa có
trang tổng hợp menu mình tạo. Thêm trang **"Menu của tôi"** liệt kê mọi menu của chủ
đơn kèm thống kê đặt món, cho **sửa** (tiêu đề + ghi chú), **xoá**, xem chi tiết, sao chép link.

Toàn bộ nằm trong RLS hiện có (`menus_update`, `menus_delete` đã tồn tại) — **không đổi
data model, không đổi RLS, không đụng hợp đồng hành vi**.

## 1. Route + Nav

- Route mới `/my-menus` → `MyMenusPage.vue` (lazy import như các trang khác).
- Thêm mục nav **"Menu của tôi"** trong `App.vue`, đặt cạnh "Đăng cơm".

## 2. `useMenus.js` — 2 hàm mới

```js
// Mọi menu mình đăng, xuyên ngày, kèm orders(id, is_paid) để đếm.
async function listMyMenus() {
  const uid = user.value?.id
  if (!uid) return { error: new Error('not signed in') }
  return sb.from('menus')
    .select('*, orders(id, is_paid)')
    .eq('poster_id', uid)
    .order('menu_date', { ascending: false })
    .order('created_at', { ascending: false })
}

// Sửa tiêu đề/ghi chú. RLS menus_update đã giới hạn về đúng chủ menu.
async function updateMenu({ id, title, note = null }) {
  return sb.from('menus')
    .update({ title, note })
    .eq('id', id)
    .select()
    .single()
}
```

Export thêm `listMyMenus`, `updateMenu`.

## 3. `MyMenusPage.vue`

- Header "Menu của tôi".
- Nhóm theo `menu_date` giảm dần (mới nhất trước), giống `HistoryPage`.
- Mỗi menu = một thẻ `AppCard ticket`:
  - **Xem:** tiêu đề + badge `X đơn` + badge `đã trả Y/X` (`badge--paid` khi đủ, ngược lại `badge--unpaid`).
  - Hành động: **Xem chi tiết** (`/menu/:id`), **Sao chép link**, **Sửa**, **Xoá**.
  - **Sửa inline:** `TextField` (tiêu đề) + `TextArea` (ghi chú) + Lưu/Huỷ → `updateMenu`, cập nhật state tại chỗ. Nút Lưu disabled khi tiêu đề rỗng.
  - **Xoá:** `deleteMenu` sẵn có + `confirm()` (cảnh báo kèm số đơn sẽ mất, đúng pattern TodayPage/MenuPage).
- Tái dùng `Spinner`/`EmptyState`/`AppCard`/`AppButton`/`TextField`/`TextArea`.

## 4. Ngoài phạm vi (YAGNI)

- Không sửa ảnh menu (chỉ tiêu đề + ghi chú).
- Không đổi ngày menu.
- Không cho chủ menu xoá/sửa **đơn lẻ** của người khác (sẽ cần đổi RLS — để sau, hỏi chủ dự án).

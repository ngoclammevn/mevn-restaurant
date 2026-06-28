# Thiết kế — Đồng bộ chọn món Realtime & Chống trùng lặp Presence

**Ngày:** 2026-06-28  
**Tác giả:** Antigravity  
**Trạng thái:** Chờ duyệt  

---

## 1. Phạm vi & Mục tiêu

Cải thiện hệ thống cộng tác thời gian thực trên trang Menu để đạt được trải nghiệm mượt mà, tức thời và không có lỗi (bugs):

1. **Chống trùng lặp viewer khi đăng nhập:** Khắc phục hiện tượng hiển thị trùng cả viewer ẩn danh và tài khoản chính thức khi người dùng đăng nhập thành công.
2. **Khôi phục giỏ hàng khi reload/redirect:** Tự động lưu và khôi phục các món ăn đã chọn (`picks`) của khách vào `localStorage` để không bị mất khi chuyển hướng đăng nhập.
3. **Đồng bộ avatar tức thời (Supabase Broadcast):** Gửi sự kiện chọn món qua Broadcast Websocket để cập nhật avatar trên các món ăn với độ trễ cực thấp (~50ms thay vì ~1s của Presence Sync).
4. **Thông báo Toast thời gian thực:** Hiển thị popup nhỏ sinh động báo hiệu hành động của những người dùng khác trong phòng.

---

## 2. Chi tiết Thiết kế Kỹ thuật

### 2.1. Cấu trúc Presence Key bằng `deviceId` cố định

**Vấn đề:** Hiện tại `myKey` thay đổi từ Guest ID sang Clerk ID khi đăng nhập, khiến Supabase xem thiết bị đó là 2 người dùng khác nhau và giữ viewer cũ trong 10-30s.

**Giải pháp:**
- Cấp một `deviceId` ngẫu nhiên (UUID) lưu vào `localStorage` cho mỗi thiết bị:
  ```js
  function getDeviceId() {
    try {
      let id = localStorage.getItem('presence_device_id')
      if (!id) {
        id = crypto.randomUUID()
        localStorage.setItem('presence_device_id', id)
      }
      return id
    } catch {
      return crypto.randomUUID()
    }
  }
  ```
- Dùng `deviceId` làm Presence Key cố định khi khởi tạo channel:
  ```js
  const myKey = getDeviceId()
  channel = sb.channel(`menu-presence:${menuId}`, { config: { presence: { key: myKey } } })
  ```
- Khi thông tin người dùng thay đổi (watch `user`), thay vì huỷ/kết nối lại channel, ta chỉ cần gọi `channel.track(getMyPayload())` để cập nhật dữ liệu của slot `deviceId` hiện tại:
  ```js
  watch(user, () => {
    if (channel) {
      scheduleTrack()
    }
  })
  ```

---

### 2.2. Khôi phục giỏ hàng (`picks`) qua `localStorage`

- Lưu trạng thái `picks` vào `localStorage` mỗi khi thay đổi:
  ```js
  // Trong MenuPage.vue
  function savePicksToLocal() {
    try {
      localStorage.setItem(`picks_menu_${menu.value.id}`, JSON.stringify(Object.keys(picks)))
    } catch {}
  }
  ```
- Khi load trang, khôi phục `picks` từ `localStorage`:
  ```js
  function restorePicks() {
    try {
      const saved = localStorage.getItem(`picks_menu_${menu.value.id}`)
      if (saved) {
        const names = JSON.parse(saved)
        applyRemotePicks(names)
      }
    } catch {}
  }
  ```
- Xoá lưu trữ khi đơn hàng được gửi thành công (`submitOrder`).

---

### 2.3. Đồng bộ avatar tức thời & Toast qua Supabase Broadcast

- Đăng ký lắng nghe sự kiện `cart_updated` trên channel:
  ```js
  channel.on('broadcast', { event: 'cart_updated' }, ({ payload }) => {
    // 1. Cập nhật vị trí avatar tức thì cho viewer tương ứng
    updateViewerPicksLocally(payload.presenceKey, payload.picks)
    
    // 2. Hiển thị thông báo Toast
    showCartToast(payload.name, payload.action, payload.itemName)
  })
  ```
- Gửi sự kiện Broadcast khi người dùng click chọn món (Debounce 500ms):
  - Khi click: Cập nhật UI lập tức (Optimistic UI).
  - Sau 500ms không có click mới, gửi tin nhắn:
    ```js
    channel.send({
      type: 'broadcast',
      event: 'cart_updated',
      payload: {
        presenceKey: myKey,
        name: getMyPayload().name,
        picks: currentPicks.value,
        action: actionType, // 'add' hoặc 'remove'
        itemName: dishName
      }
    })
    ```

---

## 3. Kế hoạch Kiểm thử (Verification Plan)

### Kiểm thử Thủ công
1. **Kiểm tra trùng lặp:** 
   - Mở hai trình duyệt khác nhau (hoặc 1 thường, 1 ẩn danh).
   - Trình ẩn danh (Guest) click chọn món → Xem trình duyệt thường thấy hiển thị avatar ẩn danh tức thì.
   - Trình ẩn danh bấm Đăng nhập → Sau khi đăng nhập thành công, kiểm tra xem avatar ẩn danh có biến mất ngay lập tức và thay thế bằng avatar thật hay không (không được có thời gian hiển thị song song cả hai).
2. **Kiểm tra lưu giỏ hàng:**
   - Khi chưa đăng nhập, chọn 2 món.
   - Bấm Đăng nhập → Sau khi chuyển hướng đăng nhập xong và quay lại trang Menu, kiểm tra xem 2 món đã chọn có tự động tích chọn lại hay không.
3. **Kiểm tra độ trễ & Toast:**
   - Click chọn món và kiểm tra xem thông báo Toast có hiển thị trên trình duyệt còn lại ngay lập tức hay không.

---

## 4. Các file bị ảnh hưởng
- `src/composables/usePresence.js` (Cấu trúc Presence Key, deviceId, xử lý Broadcast)
- `src/pages/MenuPage.vue` (Lưu/khôi phục picks vào localStorage, Toast UI & Logic)

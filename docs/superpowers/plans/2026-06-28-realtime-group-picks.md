# Đồng bộ chọn món Realtime & Chống trùng lặp Presence — Kế hoạch Triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai đồng bộ chọn món thời gian thực qua Supabase Broadcast với độ trễ cực thấp, chống trùng lặp viewer khi đăng nhập bằng `deviceId`, và khôi phục giỏ hàng qua `localStorage` sau khi đăng nhập.

**Architecture:** 
- Sử dụng `deviceId` ngẫu nhiên lưu tại `localStorage` làm Presence Key cố định thay vì dùng `userId` để loại bỏ việc huỷ/tạo lại channel gây trùng lặp.
- Lưu trạng thái `picks` (món đang chọn) của Guest vào `localStorage` theo `menuId` và khôi phục khi trang tải lại.
- Bắn sự kiện `cart_updated` qua Supabase Broadcast Websocket khi người dùng click chọn món để đồng bộ avatar tức thời và hiển thị Toast thông báo.

**Tech Stack:** Vue 3 (Vite), Supabase Client JS (Presence & Broadcast), localStorage.

## Global Constraints

- Không tạo thêm hoặc chỉnh sửa bất kỳ bảng nào trong cơ sở dữ liệu Supabase hay RLS.
- Bắt buộc bắt người dùng đăng nhập mới được thực hiện hành động đặt món chính thức (giữ nguyên logic `!isGuest` hiện tại).
- Mọi thay đổi code Vue/JS phải viết bằng Tiếng Việt cho các phần hiển thị người dùng (như Toast thông báo).

---

### Task 1: Cấu hình `deviceId` cố định và Hỗ trợ Broadcast trong `usePresence.js`

**Files:**
- Modify: [usePresence.js](file:///Users/nhatminh/Desktop/MEVN/mevn-restaurant/src/composables/usePresence.js)

**Interfaces:**
- Consumes: Supabase client, Clerk `useUser`
- Produces: 
  - `viewers`: Danh sách người xem đã cập nhật (từ cả sync Presence lẫn optimistic Broadcast)
  - `setMyPicks(names, lastAction)`: Cập nhật món chọn của tôi và phát Broadcast
  - `onCartUpdated(callback)`: Đăng ký hàm callback nhận sự kiện từ Broadcast để hiển thị Toast

- [ ] **Step 1: Định nghĩa `deviceId` và cấu hình Presence Key**
  
  Thay đổi logic khởi tạo `myKey` trong `connect()` của [usePresence.js](file:///Users/nhatminh/Desktop/MEVN/mevn-restaurant/src/composables/usePresence.js):
  ```javascript
  // Lấy hoặc tạo deviceId cố định
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

  Cập nhật hàm `connect()` để dùng `getDeviceId()` làm key cố định, và cập nhật payload Presence chứa đầy đủ thông tin:
  ```javascript
  const myKey = getDeviceId()
  myPresenceKey.value = myKey
  // channelName giữ nguyên là `menu-presence:${menuId}`
  ```

- [ ] **Step 2: Cập nhật Watcher `user` để tránh reconnect**
  
  Thay đổi watcher `user` trong [usePresence.js](file:///Users/nhatminh/Desktop/MEVN/mevn-restaurant/src/composables/usePresence.js). Khi user thay đổi (đăng nhập), không xoá channel cũ nữa mà chỉ cần gọi `scheduleTrack()` để cập nhật thông tin mới trên cùng Presence key `deviceId`:
  ```javascript
  watch(user, (newUser) => {
    if (channel) {
      scheduleTrack()
    }
  })
  ```

- [ ] **Step 3: Triển khai gửi Broadcast `cart_updated`**
  
  Cập nhật hàm `setMyPicks(names)` hoặc bổ sung hàm để gửi broadcast event `cart_updated` kèm debounce:
  ```javascript
  let broadcastDebounceTimer = null
  
  function broadcastCartChange(action, itemName) {
    if (!channel) return
    channel.send({
      type: 'broadcast',
      event: 'cart_updated',
      payload: {
        presenceKey: myKey,
        name: getMyPayload().name,
        picks: [...currentPicks.value],
        action, // 'add' hoặc 'remove'
        itemName
      }
    })
  }
  
  function setMyPicks(names, lastAction = null, lastItem = null) {
    currentPicks.value = [...names]
    scheduleTrack()
    
    // Gửi Broadcast tức thì hoặc qua debounce để cập nhật avatar cho các client khác
    if (lastAction && lastItem) {
      if (broadcastDebounceTimer) clearTimeout(broadcastDebounceTimer)
      broadcastDebounceTimer = setTimeout(() => {
        broadcastCartChange(lastAction, lastItem)
      }, 300)
    }
  }
  ```

- [ ] **Step 4: Đăng ký lắng nghe sự kiện Broadcast và cập nhật Optimistic UI**
  
  Trong hàm `connect()`, đăng ký nhận sự kiện `cart_updated` để cập nhật lập tức danh sách `viewers` cục bộ:
  ```javascript
  let cartCallbacks = []
  function onCartUpdated(cb) {
    cartCallbacks.push(cb)
  }
  
  // Trong hàm connect() sau khi subscribe:
  channel.on('broadcast', { event: 'cart_updated' }, ({ payload }) => {
    // 1. Optimistic update: cập nhật lập tức avatar vị trí món của người này
    viewers.value = viewers.value.map(v => 
      v.presenceKey === payload.presenceKey ? { ...v, picks: payload.picks, name: payload.name } : v
    )
    // 2. Kích hoạt callbacks hiển thị Toast
    cartCallbacks.forEach(cb => cb(payload))
  })
  ```

- [ ] **Step 5: Chạy ứng dụng và kiểm tra không có lỗi cú pháp/import**
  
  Chạy lệnh: `npm run dev` để đảm bảo code được biên dịch bình thường.

---

### Task 2: Tích hợp `localStorage` Picks & Hiển thị Toast thông báo trên `MenuPage.vue`

**Files:**
- Modify: [MenuPage.vue](file:///Users/nhatminh/Desktop/MEVN/mevn-restaurant/src/pages/MenuPage.vue)

- [ ] **Step 1: Cài đặt Lưu & Khôi phục Picks qua `localStorage`**
  
  Bổ sung hàm lưu picks vào `localStorage` mỗi khi thay đổi:
  ```javascript
  function savePicksToLocal() {
    if (!menu.value) return
    try {
      localStorage.setItem(`picks_menu_${menu.value.id}`, JSON.stringify(Object.keys(picks)))
    } catch {}
  }
  ```

  Cập nhật hàm `toggleDish` và `applyRemotePicks` để gọi `savePicksToLocal()`.
  
  Cập nhật hàm `load()` để khôi phục các món ăn đã chọn sau khi tải thông tin menu thành công:
  ```javascript
  // Trong hàm load() sau khi menu.value = data:
  try {
    const saved = localStorage.getItem(`picks_menu_${menu.value.id}`)
    if (saved) {
      const savedNames = JSON.parse(saved)
      savedNames.forEach(name => {
        const dish = findDishByName(name, menu.value)
        if (dish) picks[name] = dish
      })
      setMyPicks(Object.keys(picks))
    }
  } catch {}
  ```

- [ ] **Step 2: Cập nhật hàm `toggleDish` để truyền thông tin Action**
  
  Sửa lại `toggleDish(dish)` để truyền thông tin `action` ('add' hoặc 'remove') và `itemName` (tên món) sang `setMyPicks`:
  ```javascript
  function toggleDish(dish) {
    let action = 'add'
    if (picks[dish.name]) {
      delete picks[dish.name]
      action = 'remove'
    } else {
      picks[dish.name] = dish
      action = 'add'
      setActiveDish(dish.name)
    }
    draft.item_text = Object.values(picks).map(d => d.name).join('\n')
    setMyPicks(Object.keys(picks), action, dish.name)
    savePicksToLocal()
  }
  ```

- [ ] **Step 3: Xoá giỏ hàng local khi gửi đơn hàng thành công**
  
  Trong hàm `submitOrder()`, sau khi thêm đơn hàng thành công, tiến hành xoá kho lưu trữ local của menu đó:
  ```javascript
  localStorage.removeItem(`picks_menu_${menu.value.id}`)
  ```

- [ ] **Step 4: Khởi tạo danh sách Toasts và Lắng nghe sự kiện Broadcast**
  
  Định nghĩa reactive state để chứa danh sách các Toast hiển thị góc màn hình:
  ```javascript
  const toasts = ref([])
  function showToast(message, type = 'info') {
    const id = Date.now() + Math.random()
    toasts.value.push({ id, message, type })
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id)
    }, 4000)
  }
  ```

  Lắng nghe từ hook `onCartUpdated`:
  ```javascript
  // Trong setup() của MenuPage.vue
  onMounted(() => {
    // ... load()
    
    // Đăng ký nhận sự kiện realtime chọn món từ người khác
    usePresence(route.params.id).onCartUpdated((payload) => {
      // Chỉ hiển thị Toast nếu hành động là của người khác
      if (payload.presenceKey !== myPresenceKey.value) {
        const actionStr = payload.action === 'add' ? 'vừa chọn' : 'vừa bỏ chọn'
        const toastType = payload.action === 'add' ? 'success' : 'warning'
        showToast(`${payload.name} ${actionStr} món "${payload.itemName}"`, toastType)
      }
    })
  })
  ```

- [ ] **Step 5: Xây dựng Giao diện Toasts (Glassmorphism CSS)**
  
  Thêm container và các dòng Toast vào template của [MenuPage.vue](file:///Users/nhatminh/Desktop/MEVN/mevn-restaurant/src/pages/MenuPage.vue):
  ```html
  <!-- Toasts Notification Container -->
  <div class="toast-container">
    <TransitionGroup name="toast">
      <div v-for="t in toasts" :key="t.id" class="toast-card" :class="`toast-card--${t.type}`">
        <span class="toast-icon">{{ t.type === 'success' ? '➕' : '➖' }}</span>
        <span class="toast-message">{{ t.message }}</span>
      </div>
    </TransitionGroup>
  </div>
  ```

  Thêm styling Glassmorphism vào `<style scoped>`:
  ```css
  .toast-container {
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    z-index: 9999;
    max-width: 320px;
  }
  .toast-card {
    background: rgba(255, 255, 255, 0.75);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.4);
    border-radius: var(--radius-sm);
    padding: 0.75rem 1rem;
    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05), 0 4px 6px -2px rgba(0,0,0,0.05);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: var(--fs-sm);
    font-weight: 500;
  }
  .toast-card--success {
    border-left: 4px solid var(--primary);
    color: var(--primary-ink);
  }
  .toast-card--warning {
    border-left: 4px solid var(--accent);
    color: var(--accent-ink, #7c2d12);
  }
  
  /* Toast Transitions */
  .toast-enter-active, .toast-leave-active {
    transition: all 0.3s ease;
  }
  .toast-enter-from {
    opacity: 0;
    transform: translateY(20px) scale(0.9);
  }
  .toast-leave-to {
    opacity: 0;
    transform: translateX(40px);
  }
  ```

- [ ] **Step 6: Kiểm tra hoạt động tổng thể**
  
  Mở browser và chạy thử nghiệm.

# Tích hợp Chuyển tiền QR (VietQR & MoMo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm tuỳ chọn Chuyển tiền QR cho người đặt cơm bằng cách hiển thị mã VietQR/MoMo điền sẵn số tiền tính được từ món đã chọn và nội dung chuyển khoản tự động.

**Architecture:** 
1. `ProfilePage.vue` cung cấp form nhập cấu trúc (Ngân hàng, STK, Tên tài khoản, MoMo) tự động gộp thành định dạng text chuẩn lưu vào `payment_info`.
2. Tạo serverless function `api/lookup.js` làm proxy bảo mật gọi API VietQR.io để tự tra cứu tên chủ tài khoản ngân hàng.
3. Tạo component `PaymentQRModal.vue` tính số tiền động từ đơn hàng và món có giá, hiển thị ảnh mã QR VietQR và MoMo.
4. Tích hợp nút kích hoạt và Modal vào `MenuPage.vue` và `TodayPage.vue`.

**Tech Stack:** Vue 3 (Composition API), Vercel Serverless, VietQR Public Image API, MoMo QR scheme.

## Global Constraints
- **Không thêm cột DB:** Mọi thông tin tài khoản ngân hàng phải được gộp và lưu trữ dưới dạng text trong cột `payment_info` của bảng `profiles`.
- **Bảo mật API Key:** Không để lộ API Key/Client ID của VietQR trên frontend client. Tất cả yêu cầu tra cứu số tài khoản bắt buộc phải đi qua `/api/lookup` serverless proxy.
- **Tương thích ngược:** Định dạng lưu trữ trong `payment_info` phải có dạng dòng chữ dễ đọc để các menu cũ hiển thị bình thường.

---

### Task 1: Serverless Function Tra cứu Tài khoản (`api/lookup.js`)

**Files:**
- Create: `api/lookup.js`

**Interfaces:**
- Consumes: `Authorization` header containing Bearer Clerk JWT, and JSON body `{ bin, accountNumber }`.
- Produces: JSON response `{ accountName: string }` or error.

- [ ] **Step 1: Create serverless function api/lookup.js**
  Write the following code to `api/lookup.js`:
  ```javascript
  export default async function handler(req, res) {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const apiKey = process.env.VIETQR_API_KEY
    const clientId = process.env.VIETQR_CLIENT_ID
    if (!apiKey || !clientId) {
      res.status(500).json({ error: 'VietQR API is not configured on server' })
      return
    }

    const { bin, accountNumber } = req.body || {}
    if (!bin || !accountNumber) {
      res.status(400).json({ error: 'Missing bin or accountNumber' })
      return
    }

    try {
      const response = await fetch('https://api.vietqr.io/v2/lookup', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'x-client-id': clientId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ bin, accountNumber })
      })

      const data = await response.json()
      if (data.code === '00' && data.data) {
        res.status(200).json({ accountName: data.data.accountName })
      } else {
        res.status(400).json({ error: data.desc || 'Tra cứu số tài khoản thất bại' })
      }
    } catch (error) {
      console.error('VietQR lookup error:', error)
      res.status(500).json({ error: 'Internal server error during lookup' })
    }
  }
  ```

- [ ] **Step 2: Commit Task 1**
  ```bash
  git add api/lookup.js
  git commit -m "feat: add api/lookup.js serverless proxy for VietQR"
  ```

---

### Task 2: Cấu hình nhập liệu & Preview QR ở Hồ sơ (`ProfilePage.vue`)

**Files:**
- Modify: `src/pages/ProfilePage.vue`

**Interfaces:**
- Consumes: `profiles` table `payment_info`.
- Produces: Serialized structured payment text inside `payment_info`.

- [ ] **Step 1: Add bank list array and parser helpers to ProfilePage.vue**
  In `<script setup>`, add:
  ```javascript
  const LIST_BANKS = [
    { code: 'VCB', name: 'Vietcombank', bin: '970436' },
    { code: 'TCB', name: 'Techcombank', bin: '970407' },
    { code: 'MB', name: 'MBBank', bin: '970422' },
    { code: 'BIDV', name: 'BIDV', bin: '970418' },
    { code: 'CTG', name: 'VietinBank', bin: '970415' },
    { code: 'ACB', name: 'ACB', bin: '970416' },
    { code: 'TPB', name: 'TPBank', bin: '970423' },
    { code: 'VPB', name: 'VPBank', bin: '970432' },
    { code: 'OCB', name: 'OCB', bin: '970448' },
    { code: 'VIB', name: 'VIB', bin: '970441' },
    { code: 'MSB', name: 'MSB', bin: '970426' },
    { code: 'STB', name: 'Sacombank', bin: '970403' }
  ]

  const useStructured = ref(true)
  const bankCode = ref('')
  const accountNumber = ref('')
  const accountName = ref('')
  const momoPhone = ref('')
  const lookingUp = ref(false)

  function removeVietnameseTones(str) {
    if (!str) return '';
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g,"a"); 
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g,"e"); 
    str = str.replace(/ì|í|ị|ỉ|ĩ/g,"i"); 
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g,"o"); 
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g,"u"); 
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g,"y"); 
    str = str.replace(/đ/g,"d");
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
    str = str.replace(/Đ/g, "D");
    return str.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, " ");
  }

  async function handleLookupAccount() {
    if (!bankCode.value || !accountNumber.value) return
    const bank = LIST_BANKS.find(b => b.code === bankCode.value)
    if (!bank) return
    lookingUp.value = true
    try {
      const token = await window.Clerk?.session?.getToken()
      const res = await fetch('/api/lookup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ bin: bank.bin, accountNumber: accountNumber.value })
      })
      const data = await res.json()
      if (data.accountName) {
        accountName.value = removeVietnameseTones(data.accountName).toUpperCase()
      }
    } catch (e) {
      console.error(e)
    } finally {
      lookingUp.value = false
    }
  }
  ```

- [ ] **Step 2: Parse incoming payment_info on load, serialize on save**
  Update loading logic:
  ```javascript
  // On profile loaded:
  if (data.payment_info) {
    const text = data.payment_info
    const matchStk = text.match(/STK:\s*([a-zA-Z0-9]+)/)
    const matchNh = text.match(/NH:\s*([a-zA-Z0-9]+)/)
    const matchCtk = text.match(/CTK:\s*(.+)/)
    const matchMomo = text.match(/Momo:\s*([0-9]+)/)

    if (matchStk && matchNh) {
      useStructured.value = true
      accountNumber.value = matchStk[1]
      bankCode.value = matchNh[1]
      accountName.value = matchCtk ? matchCtk[1] : ''
      momoPhone.value = matchMomo ? matchMomo[1] : ''
    } else {
      useStructured.value = false
      form.value.payment_info = text
    }
  }
  ```
  Update save logic:
  ```javascript
  if (useStructured.value) {
    const parts = [
      `STK: ${accountNumber.value.trim()}`,
      `NH: ${bankCode.value.trim()}`,
      accountName.value.trim() ? `CTK: ${accountName.value.trim()}` : '',
      momoPhone.value.trim() ? `Momo: ${momoPhone.value.trim()}` : ''
    ].filter(Boolean)
    form.value.payment_info = parts.join('\n')
  }
  ```

- [ ] **Step 3: Modify template of ProfilePage.vue to render QR fields and Preview**
  Replace standard payment field with structural inputs, auto-lookup button, and VietQR Preview image component:
  ```html
  <div class="field">
    <label class="label-toggle">
      <input type="checkbox" v-model="useStructured" />
      <span>Tự động tạo mã QR khi thanh toán</span>
    </label>
  </div>

  <template v-if="useStructured">
    <div class="row row-equal">
      <div class="field flex-1">
        <label class="label">Ngân hàng</label>
        <select v-model="bankCode" class="select-field">
          <option value="">Chọn ngân hàng</option>
          <option v-for="b in LIST_BANKS" :key="b.code" :value="b.code">{{ b.name }} ({{ b.code }})</option>
        </select>
      </div>
      <div class="field flex-1">
        <label class="label">Số tài khoản</label>
        <div class="row" style="gap: 0.5rem;">
          <input type="text" class="input-field flex-1" v-model="accountNumber" placeholder="Nhập STK" @blur="handleLookupAccount" />
          <AppButton type="button" size="sm" :loading="lookingUp" @click="handleLookupAccount">Check</AppButton>
        </div>
      </div>
    </div>
    <TextField v-model="accountName" label="Tên chủ tài khoản (Viết hoa không dấu)" placeholder="NGUYEN VAN A" />
    <TextField v-model="momoPhone" label="Số điện thoại MoMo (Tùy chọn)" placeholder="0907123456" />

    <!-- QR Preview -->
    <div v-if="bankCode && accountNumber" class="qr-preview-box">
      <div class="eyebrow">Xem trước mã QR của bạn:</div>
      <img :src="`https://img.vietqr.io/image/${bankCode}-${accountNumber}-compact2.png?amount=10000&addInfo=TEST%20QR&accountName=${encodeURIComponent(accountName)}`" class="qr-preview-img" />
      <div class="meta text-center">Hãy quét thử bằng app ngân hàng để kiểm tra tính chính xác.</div>
    </div>
  </template>
  <template v-else>
    <TextArea v-model="form.payment_info" label="Thông tin chuyển khoản tự do" />
  </template>
  ```

- [ ] **Step 4: Commit Task 2**
  ```bash
  git add src/pages/ProfilePage.vue
  git commit -m "feat: add structured QR fields and live preview on ProfilePage"
  ```

---

### Task 3: Tạo Component hiển thị mã QR Thanh toán (`PaymentQRModal.vue`)

**Files:**
- Create: `src/components/ui/PaymentQRModal.vue`

**Interfaces:**
- Consumes props:
  - `show: boolean`
  - `order: object` (contains items, user info)
  - `poster: object` (contains poster's `payment_info`)
  - `menuDate: string`
- Emits events:
  - `@close`: close the modal.
  - `@paid`: trigger order paid action.

- [ ] **Step 1: Create src/components/ui/PaymentQRModal.vue**
  Write the modal code with pricing calculator, VietQR and MoMo tabs, dynamic QR endpoints, and copy buttons:
  ```html
  <template>
    <div class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-content stack-sm">
        <div class="row modal-header">
          <div class="modal-title">Chuyển tiền QR</div>
          <button class="btn-close" @click="$emit('close')">✕</button>
        </div>

        <div class="modal-body stack-sm">
          <div class="field">
            <label class="label">Số tiền cần trả (đ)</label>
            <input type="number" class="input-field amount-input" v-model="amount" />
          </div>

          <div class="tabs-row">
            <button class="tab-btn" :class="{ 'tab-btn--active': activeTab === 'vietqr' }" @click="activeTab = 'vietqr'">VietQR (Ngân hàng)</button>
            <button v-if="payInfo.momoPhone" class="tab-btn" :class="{ 'tab-btn--active': activeTab === 'momo' }" @click="activeTab = 'momo'">Ví MoMo</button>
          </div>

          <!-- VietQR tab -->
          <div v-show="activeTab === 'vietqr'" class="tab-content stack-sm">
            <div class="qr-container">
              <img :src="vietQrUrl" class="qr-img" />
            </div>
            <div class="instructions stack-xs">
              <div class="row text-sm"><b>Ngân hàng:</b> {{ payInfo.bankId }}</div>
              <div class="row text-sm"><b>Số tài khoản:</b> {{ payInfo.accountNumber }}</div>
              <div class="row text-sm"><b>Chủ tài khoản:</b> {{ payInfo.accountName }}</div>
              <div class="row text-sm"><b>Nội dung CK:</b> <code>{{ memo }}</code></div>
            </div>
          </div>

          <!-- MoMo tab -->
          <div v-show="activeTab === 'momo'" class="tab-content stack-sm">
            <div class="qr-container">
              <img :src="momoQrUrl" class="qr-img" />
            </div>
            <a :href="momoDeepLink" target="_blank" class="btn-momo">Mở nhanh app MoMo</a>
            <div class="instructions text-center text-sm">
              Chuyển đến: {{ payInfo.momoPhone }} ({{ payInfo.accountName }})
            </div>
          </div>

          <AppButton class="btn-confirm" @click="confirmPaid">Tôi đã chuyển tiền xong ✓</AppButton>
        </div>
      </div>
    </div>
  </template>

  <script setup>
  import { ref, computed, onMounted } from 'vue'
  import AppButton from './AppButton.vue'

  const props = defineProps({
    order: { type: Object, required: true },
    poster: { type: Object, required: true },
    menuDate: { type: String, required: true },
    menu: { type: Object }
  })
  const emit = defineEmits(['close', 'paid'])

  const activeTab = ref('vietqr')
  const amount = ref(0)

  const payInfo = computed(() => {
    const text = props.poster?.payment_info || ''
    const matchStk = text.match(/STK:\s*([a-zA-Z0-9]+)/)
    const matchNh = text.match(/NH:\s*([a-zA-Z0-9]+)/)
    const matchCtk = text.match(/CTK:\s*(.+)/)
    const matchMomo = text.match(/Momo:\s*([0-9]+)/)
    return {
      bankId: matchNh ? matchNh[1] : '',
      accountNumber: matchStk ? matchStk[1] : '',
      accountName: matchCtk ? matchCtk[1].trim() : '',
      momoPhone: matchMomo ? matchMomo[1] : ''
    }
  })

  function removeVietnameseTones(str) {
    if (!str) return '';
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g,"a"); 
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g,"e"); 
    str = str.replace(/ì|í|ị|ỉ|ĩ/g,"i"); 
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g,"o"); 
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g,"u"); 
    str = str.replace(/ỳ|ý|ỷ|ỹ/g,"y"); 
    str = str.replace(/đ/g,"d");
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
    str = str.replace(/Đ/g, "D");
    return str.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, " ");
  }

  const memo = computed(() => {
    const name = removeVietnameseTones(props.order?.user?.full_name || 'Khach').replace(/\s+/g, ' ')
    // Extract short date e.g. 2026-06-28 -> 28/06
    let dateStr = ''
    if (props.menuDate) {
      const parts = props.menuDate.split('-')
      if (parts.length === 3) dateStr = `${parts[2]}/${parts[1]}`
    }
    const note = `${name} com ${dateStr}`
    return note.substring(0, 24)
  })

  const vietQrUrl = computed(() => {
    return `https://img.vietqr.io/image/${payInfo.value.bankId}-${payInfo.value.accountNumber}-compact2.png?amount=${amount.value}&addInfo=${encodeURIComponent(memo.value)}&accountName=${encodeURIComponent(payInfo.value.accountName)}`
  })

  const momoQrUrl = computed(() => {
    const payload = `2|99|${payInfo.value.momoPhone}|${payInfo.value.accountName}||0|0|${amount.value}|${memo.value}|transfer_mywallet`
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(payload)}`
  })

  const momoDeepLink = computed(() => {
    return `https://nhantien.momo.vn/${payInfo.value.momoPhone}/${amount.value}`
  })

  onMounted(() => {
    // Dynamic price estimation
    if (props.menu?.note) {
      try {
        const parsed = JSON.parse(props.menu.note)
        if (parsed.dishes) {
          const lines = props.order.item_text.split('\n').map(l => l.trim()).filter(Boolean)
          let total = 0
          for (const line of lines) {
            const dish = parsed.dishes.find(d => d.name === line)
            if (dish && dish.price) total += Number(dish.price)
          }
          amount.value = total
        }
      } catch (e) {}
    }
  })

  function confirmPaid() {
    emit('paid')
  }
  </script>

  <style scoped>
  .modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; z-index: 1000; animation: fadeIn 0.25s ease; }
  .modal-content { background: var(--bg); border-radius: 12px; padding: 20px; width: 90%; max-width: 400px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
  .modal-header { border-bottom: 1px solid var(--border); padding-bottom: 8px; margin-bottom: 12px; }
  .modal-title { font-weight: 700; font-size: 16px; }
  .btn-close { background: none; border: none; font-size: 18px; cursor: pointer; color: var(--muted); }
  .tabs-row { display: flex; border-bottom: 1px solid var(--border); margin-bottom: 12px; }
  .tab-btn { flex: 1; padding: 8px; background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; font-weight: 600; color: var(--muted); }
  .tab-btn--active { border-bottom-color: var(--primary); color: var(--primary); }
  .qr-container { display: flex; justify-content: center; padding: 12px; background: #fff; border-radius: 8px; border: 1px solid var(--border); }
  .qr-img { max-width: 220px; height: auto; }
  .instructions { background: var(--bg-soft); padding: 10px; border-radius: 6px; }
  .btn-momo { display: block; text-align: center; background: #a50064; color: #fff; padding: 8px; border-radius: 6px; font-weight: 700; text-decoration: none; margin-top: 8px; }
  .btn-confirm { width: 100%; margin-top: 12px; }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  </style>
  ```

- [ ] **Step 2: Register component in src/components/ui/index.js**
  Open `src/components/ui/index.js` and add `PaymentQRModal` to the exports.
  Let's see if we need to modify index.js. First let's check its content.
  (If it exists, register it).

- [ ] **Step 3: Commit Task 3**
  ```bash
  git add src/components/ui/PaymentQRModal.vue
  git commit -m "feat: create PaymentQRModal component for VietQR/MoMo payouts"
  ```

---

### Task 4: Tích hợp nút QR và Modal thanh toán vào `MenuPage.vue` & `TodayPage.vue`

**Files:**
- Modify: `src/pages/MenuPage.vue`
- Modify: `src/pages/TodayPage.vue`

**Interfaces:**
- Consumes: `PaymentQRModal.vue`
- Produces: Rendering button trigger, opening modal, and updating RLS self-tick paid state.

- [ ] **Step 1: Check if payment info is structured**
  Add helper function to parse poster's payment info and check if VietQR/MoMo is configured:
  ```javascript
  function hasQRConfig(poster) {
    if (!poster?.payment_info) return false
    return poster.payment_info.includes('STK:') || poster.payment_info.includes('Momo:')
  }
  ```

- [ ] **Step 2: Add trigger button in MenuPage.vue**
  In `<template>`, locate the order display mode and `PaidToggle` area for the current user's order.
  Modify `MenuPage.vue` to show a payment QR icon next to the toggle if they have not paid yet and the poster has QR configured:
  ```html
  <div class="row row-wrap" style="gap: 0.5rem; align-items: center;">
    <PaidToggle
      v-if="order.user_id === myId"
      :paid="order.is_paid"
      :loading="!!toggleLoading[order.id]"
      @toggle="(val) => handleToggle(order, val)"
    />
    <AppButton
      v-if="order.user_id === myId && !order.is_paid && hasQRConfig(menu?.poster)"
      variant="ghost"
      size="sm"
      style="padding: 0.25rem 0.5rem;"
      @click="openQRModal(order)"
    >
      🔗 Quét QR
    </AppButton>
  </div>
  ```
  Add state and handlers:
  ```javascript
  const showQRModal = ref(false)
  const selectedQROrder = ref(null)

  function openQRModal(order) {
    selectedQROrder.value = order
    showQRModal.value = true
  }

  function handleQRModalPaid() {
    if (selectedQROrder.value) {
      handleToggle(selectedQROrder.value, true)
    }
    showQRModal.value = false
  }
  ```
  Add `<PaymentQRModal>` tag to the bottom of the template:
  ```html
  <PaymentQRModal
    v-if="showQRModal && selectedQROrder"
    :order="selectedQROrder"
    :poster="menu.poster"
    :menu-date="menu.menu_date"
    :menu="menu"
    @close="showQRModal = false"
    @paid="handleQRModalPaid"
  />
  ```

- [ ] **Step 3: Repeat the same integration in TodayPage.vue**
  Modify `TodayPage.vue` template and script in the exact same manner.

- [ ] **Step 4: Run build check**
  Run: `npm run build`
  Expected: Success.

- [ ] **Step 5: Commit Task 4**
  ```bash
  git add src/pages/MenuPage.vue src/pages/TodayPage.vue
  git commit -m "feat: integrate PaymentQRModal into MenuPage and TodayPage templates"
  ```

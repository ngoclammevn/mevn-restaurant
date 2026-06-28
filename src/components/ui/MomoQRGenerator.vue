<template>
  <div class="momo-qr-generator">
    <!-- Input Section for Amount (Synchronized with parent using defineModel) -->
    <div class="input-group">
      <label for="amount-input" class="input-label">Nhập số tiền chuyển khoản:</label>
      <div class="input-wrapper">
        <input 
          id="amount-input" 
          type="text" 
          class="amount-input"
          :value="formattedAmount" 
          @input="handleInput"
          placeholder="Nhập số tiền..."
        />
        <span class="currency-badge">đ</span>
      </div>
    </div>

    <!-- Live Preview QR Code Section -->
    <div class="qr-display-container">
      <div class="qr-box">
        <!-- Render the QR Code using qrcode.vue -->
        <QrcodeVue 
          :value="momoPayload" 
          :size="200" 
          level="H" 
          render-as="svg"
          class="qr-code-canvas"
        />
      </div>
      <div class="payload-preview">
        <span class="preview-label">Chuỗi raw dữ liệu mã hóa:</span>
        <code class="payload-string">{{ momoPayload }}</code>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import QrcodeVue from 'qrcode.vue'

/**
 * HƯỚNG DẪN VUE 3 + TYPESCRIPT (TS):
 * 
 * 1. Định nghĩa Props dạng bắt buộc (Không có dấu ?):
 *    - Các giá trị phone và name bắt buộc phải được truyền từ component cha
 *      (được lấy từ cấu hình profiles/payment_info của người đăng menu).
 */
interface Props {
  phone: string;  // Số điện thoại MoMo lấy từ cấu hình của người đăng
  name: string;   // Tên người nhận MoMo lấy từ cấu hình của người đăng
}

const props = defineProps<Props>()

/**
 * 2. Liên kết hai chiều (Two-way binding) với Component cha:
 *    - Sử dụng `defineModel<number>()` giúp đồng bộ hóa trực tiếp biến `amount`
 *      giữa component con này và component cha (PaymentQRModal) mà không cần 
 *      phải tự định nghĩa emit sự kiện thủ công.
 */
const amount = defineModel<number>({ required: true })

/**
 * 3. Xử lý dữ liệu nhập vào:
 *    - Ép kiểu sự kiện DOM an toàn bằng `as HTMLInputElement`.
 */
function handleInput(e: Event): void {
  const target = e.target as HTMLInputElement
  const rawValue = target.value.replace(/[^0-9]/g, '')
  amount.value = Number(rawValue) || 0
}

const formattedAmount = computed<string>(() => {
  if (amount.value === 0) return ''
  return new Intl.NumberFormat('vi-VN').format(amount.value)
})

/**
 * 4. Tạo chuỗi raw dữ liệu MoMo (Reactive):
 *    - 2|99|[SĐT_NGƯỜI_ĐĂNG]|[TÊN_NGƯỜI_ĐĂNG]||0|0|[SỐ_TIỀN]|
 */
const momoPayload = computed<string>(() => {
  const sanitizedName = removeVietnameseTones(props.name).toUpperCase()
  return `2|99|${props.phone}|${sanitizedName}||0|0|${amount.value}|`
})

function removeVietnameseTones(str: string): string {
  if (!str) return ''
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a")
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e")
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i")
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o")
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u")
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y")
  str = str.replace(/đ/g, "d")
  str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A")
  str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E")
  str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I")
  str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O")
  str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U")
  str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y")
  str = str.replace(/Đ/g, "D")
  return str.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, " ")
}
</script>

<style scoped>
.momo-qr-generator {
  background: var(--bg-soft, #faf8f5);
  border: 1px solid var(--border, #e6dfd5);
  border-radius: 12px;
  padding: 16px;
  width: 100%;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
  box-sizing: border-box;
}

.input-group {
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.input-label {
  font-size: var(--fs-xs, 12px);
  font-weight: 600;
  color: var(--ink-soft, #706b60);
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.amount-input {
  width: 100%;
  padding: 10px 40px 10px 12px;
  border: 1.5px solid var(--line-strong, #ccc);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 700;
  color: var(--ink, #333);
  background: var(--bg, #fff);
  box-sizing: border-box;
  text-align: left;
}

.amount-input:focus {
  outline: none;
  border-color: var(--primary, #dcb464);
}

.currency-badge {
  position: absolute;
  right: 14px;
  font-weight: 700;
  color: var(--muted, #999);
  font-size: 14px;
}

.qr-display-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.qr-box {
  background: #fff;
  border: 1px solid var(--border, #e6dfd5);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}

.qr-code-canvas {
  display: block;
}

.payload-preview {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.preview-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--ink-soft, #706b60);
}

.payload-string {
  background: rgba(220, 180, 100, 0.08);
  border: 1px solid rgba(220, 180, 100, 0.18);
  border-radius: 6px;
  padding: 8px 10px;
  font-family: monospace;
  font-size: 11px;
  word-break: break-all;
  color: var(--primary, #dcb464);
  font-weight: 600;
}
</style>

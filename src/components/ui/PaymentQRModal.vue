<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content stack-sm">
      <div class="row modal-header">
        <div class="modal-title">Chuyển tiền QR</div>
        <button class="btn-close" @click="$emit('close')">✕</button>
      </div>

      <div class="modal-body stack-sm">
        <!-- Prominent formatted price display -->
        <div class="amount-display-container">
          <div class="amount-label">Số tiền cần thanh toán</div>
          <div class="amount-val">{{ formatVNCurrency(amount) }}</div>
        </div>

        <!-- Sleek amount adjustment field -->
        <div class="field amount-adjust-field">
          <div class="row-between">
            <label class="label-sm">Chỉnh sửa số tiền:</label>
            <div class="input-wrapper">
              <input type="text" class="amount-input-neat" :value="inputAmountStr" @input="handleAmountInput" placeholder="0" />
              <span class="currency-suffix">đ</span>
            </div>
          </div>
        </div>

        <!-- Segmented Tab selector -->
        <div class="tabs-row">
          <button class="tab-btn" :class="{ 'tab-btn--active': activeTab === 'vietqr' }" @click="activeTab = 'vietqr'">VietQR (Ngân hàng)</button>
          <button v-if="payInfo.momoPhone" class="tab-btn" :class="{ 'tab-btn--active': activeTab === 'momo' }" @click="activeTab = 'momo'">Ví MoMo</button>
        </div>

        <!-- VietQR tab -->
        <div v-show="activeTab === 'vietqr'" class="tab-content stack-sm">
          <div class="qr-container">
            <img :src="vietQrUrl" class="qr-img" />
          </div>

          <!-- Structured payment details card -->
          <div class="payment-details-card stack-xs">
            <div class="detail-row">
              <span class="detail-label">Ngân hàng</span>
              <span class="detail-value font-bold">{{ payInfo.bankId }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Số tài khoản</span>
              <span class="detail-value">
                <span class="font-mono font-bold">{{ payInfo.accountNumber }}</span>
                <button class="btn-copy" type="button" @click="copyText(payInfo.accountNumber, 'stk')">
                  {{ copiedField === 'stk' ? 'Đã chép ✓' : 'Sao chép' }}
                </button>
              </span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Chủ tài khoản</span>
              <span class="detail-value font-bold">{{ payInfo.accountName }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Nội dung CK</span>
              <span class="detail-value">
                <code class="memo-code font-bold">{{ memo }}</code>
                <button class="btn-copy" type="button" @click="copyText(memo, 'memo')">
                  {{ copiedField === 'memo' ? 'Đã chép ✓' : 'Sao chép' }}
                </button>
              </span>
            </div>
          </div>
        </div>

        <!-- MoMo tab -->
        <div v-show="activeTab === 'momo'" class="tab-content stack-sm">
          <div class="qr-container">
            <img :src="momoQrUrl" class="qr-img" />
          </div>
          <a :href="momoDeepLink" target="_blank" class="btn-momo">Mở nhanh app MoMo</a>

          <!-- Structured momo details card -->
          <div class="payment-details-card stack-xs">
            <div class="detail-row">
              <span class="detail-label">Số điện thoại</span>
              <span class="detail-value">
                <span class="font-mono font-bold">{{ payInfo.momoPhone }}</span>
                <button class="btn-copy" type="button" @click="copyText(payInfo.momoPhone, 'momo')">
                  {{ copiedField === 'momo' ? 'Đã chép ✓' : 'Sao chép' }}
                </button>
              </span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Người nhận</span>
              <span class="detail-value font-bold">{{ payInfo.accountName }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Nội dung</span>
              <span class="detail-value">
                <code class="memo-code font-bold">{{ memo }}</code>
                <button class="btn-copy" type="button" @click="copyText(memo, 'memo')">
                  {{ copiedField === 'memo' ? 'Đã chép ✓' : 'Sao chép' }}
                </button>
              </span>
            </div>
          </div>
        </div>

        <AppButton class="btn-confirm" @click="confirmPaid">Tôi đã chuyển tiền xong ✓</AppButton>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
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
const copiedField = ref('')
const inputAmountStr = ref('')

watch(amount, (newVal) => {
  const formatted = new Intl.NumberFormat('vi-VN').format(newVal || 0)
  if (inputAmountStr.value !== formatted) {
    inputAmountStr.value = formatted
  }
}, { immediate: true })

function handleAmountInput(e) {
  const cursorPosition = e.target.selectionStart
  const originalLength = e.target.value.length
  
  const rawVal = e.target.value.replace(/[^0-9]/g, '')
  const parsedNum = Number(rawVal) || 0
  amount.value = parsedNum
  
  const formatted = new Intl.NumberFormat('vi-VN').format(parsedNum)
  inputAmountStr.value = formatted
  
  nextTick(() => {
    const newLength = formatted.length
    const diff = newLength - originalLength
    let newPos = cursorPosition + diff
    if (newPos < 0) newPos = 0
    e.target.setSelectionRange(newPos, newPos)
  })
}

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

const memo = computed(() => {
  const name = removeVietnameseTones(props.order?.user?.full_name || 'Khach').replace(/\s+/g, ' ')
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

function formatVNCurrency(val) {
  if (!val) return '0 đ'
  return new Intl.NumberFormat('vi-VN').format(val) + ' đ'
}

function copyText(text, field) {
  if (!text) return
  navigator.clipboard.writeText(text)
  copiedField.value = field
  setTimeout(() => {
    if (copiedField.value === field) copiedField.value = ''
  }, 2000)
}

onMounted(() => {
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
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.25s ease;
}
.modal-content {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 24px;
  width: 95%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  box-sizing: border-box;
}
.modal-header {
  border-bottom: 1px solid var(--border);
  padding-bottom: 10px;
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.modal-title {
  font-weight: 700;
  font-size: 18px;
  color: var(--ink);
}
.btn-close {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: var(--muted);
  padding: 4px;
  line-height: 1;
}

.amount-display-container {
  text-align: center;
  background: rgba(220, 180, 100, 0.08);
  padding: 18px;
  border-radius: 12px;
  margin-bottom: 16px;
  border: 1px solid rgba(220, 180, 100, 0.18);
}
.amount-label {
  font-size: var(--fs-xs);
  color: var(--ink-soft);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}
.amount-val {
  font-size: 2rem;
  font-weight: 800;
  color: var(--primary);
}

.amount-adjust-field {
  margin-bottom: 16px;
}
.row-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.label-sm {
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--ink-soft);
}
.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}
.amount-input-neat {
  max-width: 145px;
  padding: 6px 32px 6px 12px;
  border: 1.5px solid var(--line-strong);
  border-radius: var(--radius-sm);
  font-weight: 700;
  text-align: right;
  font-size: var(--fs-sm);
  background: var(--bg);
  color: var(--ink);
}
.amount-input-neat:focus {
  outline: none;
  border-color: var(--primary);
}
.currency-suffix {
  position: absolute;
  right: 12px;
  font-weight: 700;
  font-size: var(--fs-sm);
  color: var(--muted);
}

.tabs-row {
  display: flex;
  background: var(--bg-soft);
  padding: 4px;
  border-radius: 8px;
  margin-bottom: 16px;
  border: 1px solid var(--line);
}
.tab-btn {
  flex: 1;
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  color: var(--ink-soft);
  transition: all 0.2s ease;
  font-size: var(--fs-sm);
}
.tab-btn--active {
  background: var(--bg);
  color: var(--primary);
  box-shadow: 0 2px 6px rgba(0,0,0,0.06);
}

.qr-container {
  display: flex;
  justify-content: center;
  padding: 16px;
  background: #fff;
  border-radius: 12px;
  border: 1px solid var(--border);
  margin-bottom: 16px;
}
.qr-img {
  max-width: 240px;
  height: auto;
}

.payment-details-card {
  background: var(--bg-soft);
  border-radius: 10px;
  padding: 12px 16px;
  border: 1px solid var(--line);
  margin-bottom: 8px;
}
.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(0,0,0,0.03);
}
.detail-row:last-child {
  border-bottom: none;
}
.detail-label {
  font-size: var(--fs-sm);
  color: var(--ink-soft);
}
.detail-value {
  font-size: var(--fs-sm);
  color: var(--ink);
  display: flex;
  align-items: center;
  gap: 4px;
}
.font-bold {
  font-weight: 700;
}
.font-mono {
  font-family: monospace;
  letter-spacing: 0.02em;
}
.memo-code {
  background: rgba(220, 180, 100, 0.12);
  color: var(--primary);
  padding: 2px 6px;
  border-radius: 4px;
}
.btn-copy {
  background: rgba(220, 180, 100, 0.12);
  color: var(--primary);
  border: none;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}
.btn-copy:hover {
  background: var(--primary);
  color: #fff;
}

.btn-momo {
  display: block;
  text-align: center;
  background: #a50064;
  color: #fff;
  padding: 10px;
  border-radius: 8px;
  font-weight: 700;
  text-decoration: none;
  margin-bottom: 12px;
  transition: opacity 0.2s;
  font-size: var(--fs-sm);
}
.btn-momo:hover {
  opacity: 0.9;
}

.btn-confirm {
  width: 100%;
  margin-top: 8px;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
</style>

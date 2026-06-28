<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content stack-sm">
      <div class="row modal-header">
        <div class="modal-title">Thanh toán QR Động</div>
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
.amount-input { font-size: 1.1rem; font-weight: 700; text-align: center; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
</style>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useUser } from '@clerk/vue'
import AppButton from './AppButton.vue'
import AppDialog from './AppDialog.vue'
import { LIST_BANKS } from '../../lib/banks'
import { menuDishes } from '../../lib/menu'
import { managedOrderAmount } from '../../lib/manage-summary'
const props = defineProps({
  order: { type: Object, required: true }, poster: { type: Object, required: true },
  menuDate: { type: String, required: true }, menu: { type: Object },
  loading: Boolean, error: { type: String, default: '' },
})
const emit = defineEmits(['close', 'paid'])
const { user } = useUser()
const own = computed(() => !!user.value?.id && props.order.user_id === user.value.id)
const activeTab = ref('bank'), amount = ref(null), copiedField = ref(''), copyError = ref(''), downloadError = ref(''), downloading = ref(false)
const qrError = ref(false), qrKey = ref(0)
let copyTimer, generation = 0
const payInfo = computed(() => {
  const text = props.poster?.payment_info || ''
  const field = key => text.match(new RegExp(`^${key}:\\s*(.*)$`, 'mi'))?.[1]?.trim() ?? ''
  return { bankId: field('NH'), accountNumber: field('STK'), accountName: field('CTK'), momoPhone: field('Momo') }
})
const hasBank = computed(() => !!(payInfo.value.bankId && payInfo.value.accountNumber))
const hasMomo = computed(() => !!payInfo.value.momoPhone)
const fullBankName = computed(() => {
  const bank = LIST_BANKS.find(entry => entry.code === payInfo.value.bankId)
  return bank ? `${bank.name} (${bank.code})` : payInfo.value.bankId
})
const breakdown = computed(() => {
  const dishes = menuDishes(props.menu)
  const price = dish => typeof dish?.price === 'number' && Number.isFinite(dish.price) && dish.price >= 0 ? dish.price : null
  const exactLine = name => { const matches = dishes.filter(dish => dish.name === name); return { name, price: matches.length === 1 ? price(matches[0]) : null } }
  const lines = value => String(value || '').split('\n').map(name => name.trim()).filter(Boolean).map(exactLine)
  const items = props.order.order_items?.length ? props.order.order_items.flatMap(item => {
    if (!item.menu_item_id) return lines(item.name_snapshot || props.order.item_text)
    const dish = dishes.find(entry => entry.id === item.menu_item_id)
    return [{ name: dish?.name || item.name_snapshot || 'Món đã đặt', price: price(dish) }]
  }) : lines(props.order.item_text)
  return { items, total: managedOrderAmount(props.menu, props.order) }
})
const amountText = computed(() => amount.value == null ? '' : new Intl.NumberFormat('vi-VN').format(amount.value))
const money = value => value == null ? 'Chưa có giá' : `${new Intl.NumberFormat('vi-VN').format(value)} đ`
function inputAmount(event) {
  const digits = event.target.value.replace(/[^0-9]/g, '')
  amount.value = digits ? Math.min(Number(digits), 100000000) : null
  event.target.value = amountText.value
}
const memo = computed(() => {
  const name = String(props.order.user?.full_name || 'Khach').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
  const parts = props.menuDate?.split('-') ?? []
  return `${name} com ${parts.length === 3 ? `${parts[2]}/${parts[1]}` : ''}`.trim().slice(0, 24)
})
const qrUrl = computed(() => {
  const bank = activeTab.value === 'momo' ? '971025' : payInfo.value.bankId
  const account = activeTab.value === 'momo' ? payInfo.value.momoPhone : payInfo.value.accountNumber
  const query = new URLSearchParams({ amount: String(amount.value ?? ''), addInfo: memo.value, accountName: payInfo.value.accountName })
  return `https://img.vietqr.io/image/${encodeURIComponent(bank)}-${encodeURIComponent(account)}-compact2.png?${query}`
})
const momoDeepLink = computed(() => `https://nhantien.momo.vn/${encodeURIComponent(payInfo.value.momoPhone)}/${amount.value ?? ''}`)
watch(() => props.order.id, () => {
  generation++; amount.value = breakdown.value.total
  activeTab.value = hasBank.value ? 'bank' : 'momo'
  copyError.value = ''; copiedField.value = ''; downloadError.value = ''; downloading.value = false
}, { immediate: true })
watch([hasBank, hasMomo], ([bank, momo]) => {
  if (activeTab.value === 'bank' && !bank && momo) activeTab.value = 'momo'
  else if (activeTab.value === 'momo' && !momo && bank) activeTab.value = 'bank'
})
watch([activeTab, amount, payInfo], () => { qrError.value = false; downloadError.value = '' })
watch(() => user.value?.id, () => { generation++; emit('close') })
onUnmounted(() => { generation++; clearTimeout(copyTimer) })
function close() { if (!props.loading) emit('close') }
function confirmPaid() { if (own.value && !props.loading && !props.order.is_paid) emit('paid') }
function retryQR() { qrError.value = false; qrKey.value++ }
async function copyText(text, field) {
  const current = generation
  copyError.value = ''
  try {
    await navigator.clipboard.writeText(text)
    if (current !== generation) return
    copiedField.value = field; clearTimeout(copyTimer)
    copyTimer = setTimeout(() => { copiedField.value = '' }, 2000)
  } catch { if (current === generation) copyError.value = 'Chưa sao chép được. Bạn có thể chọn và chép thông tin bên dưới.' }
}
async function downloadQr() {
  if (amount.value == null || downloading.value) return
  const current = generation, url = qrUrl.value
  downloading.value = true; downloadError.value = ''
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error('QR image unavailable')
    const blob = await response.blob()
    if (current !== generation) return
    const objectUrl = URL.createObjectURL(blob), link = document.createElement('a')
    link.href = objectUrl; link.download = `QR-${memo.value.replace(/\s+/g, '-') || 'thanh-toan'}.png`
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(objectUrl)
  } catch {
    if (current !== generation) return
    window.open(url, '_blank', 'noopener,noreferrer')
    downloadError.value = 'Nếu chưa tải được, bạn có thể lưu ảnh QR từ tab vừa mở.'
  } finally { if (current === generation) downloading.value = false }
}
</script>
<template>
  <AppDialog open :title="`Chuyển khoản cho ${poster?.full_name || 'người đăng menu'}`" @close="close">
    <div class="stack payment-dialog">
      <div class="payment-context"><span class="eyebrow">Đơn của bạn · {{ menuDate.split('-').reverse().join('/') }}</span><p class="meta">{{ order.item_text }}{{ menu?.restaurant?.name ? ` · ${menu.restaurant.name}` : '' }}</p></div>
      <details><summary>Món đã đặt</summary><div v-for="(item,index) in breakdown.items" :key="index" class="row-wrap payment-line"><span>{{ item.name }}</span><span>{{ money(item.price) }}</span></div><div v-if="breakdown.total != null" class="row-wrap payment-line payment-total"><strong>Tổng từ menu</strong><strong>{{ money(breakdown.total) }}</strong></div></details>
      <div v-if="hasBank || hasMomo" class="payment-tabs" role="group" aria-label="Phương thức chuyển tiền"><button v-if="hasBank" type="button" :class="{ active: activeTab === 'bank' }" :aria-pressed="activeTab === 'bank'" @click="activeTab = 'bank'">Ngân hàng</button><button v-if="hasMomo" type="button" :class="{ active: activeTab === 'momo' }" :aria-pressed="activeTab === 'momo'" @click="activeTab = 'momo'">MoMo</button></div>
      <div v-if="hasBank || hasMomo" class="payment-grid">
        <div class="stack-sm payment-qr-area">
          <template v-if="amount != null"><img v-if="!qrError" :key="`${activeTab}-${qrKey}`" :src="qrUrl" alt="Mã QR chuyển tiền cho người đăng menu" class="payment-qr" width="240" height="240" @error="qrError = true" /><p v-if="qrError" class="alert">Chưa tải được mã QR. <button type="button" @click="retryQR">Thử lại</button></p><AppButton variant="ghost" :loading="downloading" @click="downloadQr">Tải mã QR</AppButton></template><p v-else class="meta">Nhập số tiền để hiện mã QR.</p>
          <p v-if="activeTab === 'momo'" class="meta">Mã này dùng ứng dụng ngân hàng để quét. <a v-if="amount != null" :href="momoDeepLink" target="_blank" rel="noopener noreferrer">Mở MoMo</a></p>
        </div>
        <section class="payment-account">      <div class="payment-amount"><span class="meta">Số tiền</span><strong>{{ amount == null ? 'Chưa có số tiền' : money(amount) }}</strong></div>
      <label class="field">{{ breakdown.total == null ? 'Nhập số tiền đã thống nhất (đ)' : 'Điều chỉnh số tiền (đ)' }}<input class="input" inputmode="numeric" :value="amountText" :disabled="loading" placeholder="Nhập số tiền" @input="inputAmount" /></label>
<dl class="payment-details"><template v-if="activeTab === 'bank'"><dt>Ngân hàng</dt><dd>{{ fullBankName }}</dd><dt>Số tài khoản</dt><dd><span>{{ payInfo.accountNumber }}</span><AppButton variant="ghost" @click="copyText(payInfo.accountNumber, 'bank')">{{ copiedField === 'bank' ? 'Đã chép' : 'Sao chép' }}</AppButton></dd></template><template v-else><dt>Số điện thoại MoMo</dt><dd><span>{{ payInfo.momoPhone }}</span><AppButton variant="ghost" @click="copyText(payInfo.momoPhone, 'momo')">{{ copiedField === 'momo' ? 'Đã chép' : 'Sao chép' }}</AppButton></dd></template><dt>Tên người nhận</dt><dd>{{ payInfo.accountName || poster?.full_name }}</dd><dt>Nội dung chuyển tiền</dt><dd><span>{{ memo }}</span><AppButton variant="ghost" @click="copyText(memo, 'memo')">{{ copiedField === 'memo' ? 'Đã chép' : 'Sao chép' }}</AppButton></dd></dl></section>
      </div>
      <div v-else class="stack-sm"><label class="field">Số tiền đã thống nhất (đ)<input class="input" inputmode="numeric" :value="amountText" :disabled="loading" placeholder="Nhập số tiền" @input="inputAmount" /></label><p class="order-lines meta">{{ poster?.payment_info || 'Người đăng chưa thêm thông tin nhận tiền. Liên hệ người đăng để chuyển tiền.' }}</p></div>
      <p v-if="copyError" class="alert" role="alert">{{ copyError }}</p><p v-if="downloadError" class="meta" role="status">{{ downloadError }}</p><p v-if="error" class="alert" role="alert">{{ error }}</p>
      <p v-if="own" class="payment-notice">Bạn tự xác nhận sau khi chuyển tiền. Người thu tiền chỉ xem trạng thái, không đánh dấu hộ.</p>
    </div>
    <template #footer><AppButton v-if="own && !order.is_paid" block :loading="loading" @click="confirmPaid">Tôi đã chuyển tiền</AppButton></template>
  </AppDialog>
</template>
<style scoped>
.payment-dialog { gap:18px; }.payment-context { margin-top:-10px; }.payment-context .eyebrow { font-size:12px; }.payment-context p { font-size:12px; margin-top:6px; white-space:pre-line; }.payment-amount { margin:0 0 8px; }.payment-amount strong { display:block; font-size:30px; line-height:1.2; margin:8px 0; }.payment-amount > .meta { font-size:14px; }.payment-account > .field { font-size:13px; margin:14px 0; }.payment-account .input { font-size:15px; }.payment-tabs { display:flex; gap:8px; margin:0; }.payment-tabs button { min-height:44px; padding:9px 13px; border:1px solid var(--line-strong); border-radius:11px; background:var(--card); font-size:13px; cursor:pointer; }.payment-tabs button.active { background:#f2f3ef; color:#35412e; border-color:#d8dcd1; }.payment-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; align-items:start; }.payment-qr-area { align-items:center; padding:16px; background:var(--bg-tint); border:1px dashed #829e80; border-radius:12px; }.payment-qr { width:100%; max-width:240px; height:auto; background:white; }.payment-qr-area > .meta { font-size:12px; text-align:center; }.payment-details { margin:0; min-width:0; }.payment-details dt { font-size:14px; color:var(--ink-soft); padding-top:14px; }.payment-details dd { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; padding:4px 0 14px; border-bottom:1px solid var(--line); margin:0; font-size:14px; overflow-wrap:anywhere; }.payment-details dd > .btn { padding:8px 11px; font-size:13px; }.payment-line { padding:8px 0; justify-content:space-between; font-size:14px; }.payment-total { border-top:1px solid var(--line); }.payment-notice { border:1px solid #d9decf; border-radius:12px; background:#f4f5f0; padding:14px 16px; font-size:14px; color:#48523e; }@media(max-width:640px) { .payment-grid { grid-template-columns:1fr; }.payment-qr-area { padding:20px; }.payment-qr { max-width:220px; } }
</style>

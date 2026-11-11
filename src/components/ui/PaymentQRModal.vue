<script setup>
import { ref, computed, watch, onUnmounted, h } from 'vue'
import { useUser } from '@clerk/vue'
import AppButton from './AppButton.vue'
import AppDialog from './AppDialog.vue'
import GlassInput from './liquid/GlassInput.vue'
import { LIST_BANKS } from '../../lib/banks'
import { orderPriceItems } from '../../lib/settlement-items'
import { managedOrderAmount } from '../../lib/manage-summary'
import { paymentImage } from '../../lib/payment-image'
const props = defineProps({
  order: { type: Object, required: true }, poster: { type: Object, required: true },
  menuDate: { type: String, required: true }, menu: { type: Object },
  loading: Boolean, error: { type: String, default: '' }, inline: Boolean,
})
// inline: hiện thẳng trong trang/popup khác, khỏi mở thêm một hộp thoại chồng lên.
const InlineShell = (_, { slots }) => h('div', { class: 'payment-inline' }, [slots.default?.(), slots.footer?.()])
InlineShell.props = ['open', 'title']
const emit = defineEmits(['close', 'paid'])
const { user } = useUser()
const own = computed(() => !!user.value?.id && props.order.user_id === user.value.id)
const activeTab = ref('bank'), amount = ref(null), copiedField = ref(''), copyError = ref(''), downloadError = ref(''), downloading = ref(false)
const qrError = ref(false), qrKey = ref(0), editingAmount = ref(false)
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
const breakdown = computed(()=>({items:orderPriceItems(props.menu || {},props.order).map(item=>({name:item.name,price:item.unitPrice})),total:managedOrderAmount(props.menu || {},props.order)}))
const amountText = computed(() => amount.value == null ? '' : new Intl.NumberFormat('vi-VN').format(amount.value))
const money = value => value == null ? 'Chưa có giá' : `${new Intl.NumberFormat('vi-VN').format(value)} đ`
function setAmountText(text) {
  const digits = String(text ?? '').replace(/[^0-9]/g, '')
  amount.value = digits ? Math.min(Number(digits), 100000000) : null
}
const memo = computed(() => {
  const name = String(user.value?.fullName || [user.value?.firstName, user.value?.lastName].filter(Boolean).join(' ')).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, value => value === 'Đ' ? 'D' : 'd').replace(/\s+/g, ' ').trim()
  const [, month, day] = props.menuDate.split('-')
  return `${name} chuyen tien com ${day}/${month}`.trim()
})
const qrUrl = computed(() => {
  const bank = activeTab.value === 'momo' ? '971025' : payInfo.value.bankId
  const account = activeTab.value === 'momo' ? payInfo.value.momoPhone : payInfo.value.accountNumber
  const query = new URLSearchParams({ amount: String(amount.value ?? ''), addInfo: memo.value, accountName: payInfo.value.accountName })
  return `https://img.vietqr.io/image/${encodeURIComponent(bank)}-${encodeURIComponent(account)}-compact2.png?${query}`
})
const momoDeepLink = computed(() => `https://nhantien.momo.vn/${encodeURIComponent(payInfo.value.momoPhone)}/${amount.value ?? ''}`)
watch(() => props.order.id, () => {
  generation++; amount.value = breakdown.value.total; editingAmount.value = false
  activeTab.value = hasBank.value ? 'bank' : 'momo'
  copyError.value = ''; copiedField.value = ''; downloadError.value = ''; downloading.value = false
}, { immediate: true })
watch([hasBank, hasMomo], ([bank, momo]) => {
  if (activeTab.value === 'bank' && !bank && momo) activeTab.value = 'momo'
  else if (activeTab.value === 'momo' && !momo && bank) activeTab.value = 'bank'
})
watch([activeTab, amount, payInfo], () => { qrError.value = false; downloadError.value = '' })
// iOS: tải file chỉ vào app Tệp. Share sheet có mục "Lưu hình ảnh" để vào Ảnh.
// Dựng ảnh sẵn vì Safari/Chrome iOS chặn navigator.share nếu gọi sau một await dài trong lúc bấm.
const isIOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
const imageName = () => `Chuyen-tien-${memo.value.replace(/[\\/:*?"<>|\s]+/g, '-') || 'com'}.png`
async function buildImage(url) {
  // Mẫu "compact" chỉ có QR; thông tin chuyển khoản tự vẽ bên dưới để khỏi lặp.
  const response = await fetch(url.replace('-compact2.png', '-compact.png'))
  if (!response.ok) throw new Error('qr_unavailable')
  const blob = await paymentImage(await response.blob(), {
    title: `Tiền cơm ngày ${props.menuDate.split('-').reverse().join('/')}`,
    amount: money(amount.value),
    rows: [
      { label: 'Người nhận', value: payInfo.value.accountName || props.poster?.full_name || '' },
      { label: activeTab.value === 'bank' ? fullBankName.value : 'MoMo', value: activeTab.value === 'bank' ? payInfo.value.accountNumber : payInfo.value.momoPhone },
      { label: 'Nội dung chuyển khoản', value: memo.value },
    ],
  })
  return new File([blob], imageName(), { type: 'image/png' })
}
let preparedImage = null
watch(qrUrl, async url => {
  preparedImage = null
  if (!isIOS || amount.value == null || !navigator.canShare) return
  try { const file = await buildImage(url); if (qrUrl.value === url) preparedImage = file } catch { preparedImage = null }
}, { immediate: true })
watch(() => user.value?.id, () => { generation++; emit('close') })
onUnmounted(() => { generation++; clearTimeout(copyTimer) })
function close() { if (!props.loading) emit('close') }
function confirmPaid() { if (own.value && props.menu?.payment_mode!=='sponsored' && !props.loading && !props.order.is_paid) emit('paid') }
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
  if (preparedImage && navigator.canShare?.({ files: [preparedImage] })) {
    try { await navigator.share({ files: [preparedImage] }); return }
    catch (error) { if (error?.name === 'AbortError') return }
  }
  const current = generation, url = qrUrl.value
  downloading.value = true; downloadError.value = ''
  try {
    const file = await buildImage(url)
    if (current !== generation) return
    const objectUrl = URL.createObjectURL(file), link = document.createElement('a')
    link.href = objectUrl; link.download = file.name
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(objectUrl)
  } catch {
    if (current !== generation) return
    window.open(url, '_blank', 'noopener,noreferrer')
    downloadError.value = 'Nếu chưa tải được, bạn có thể lưu ảnh QR từ tab vừa mở.'
  } finally { if (current === generation) downloading.value = false }
}
</script>
<template>
  <component :is="inline ? InlineShell : AppDialog" :open="menu?.payment_mode!=='sponsored'" title="Chuyển tiền" @close="close">
    <div class="payment-dialog">
      <div class="payment-heading"><span v-if="!inline" class="meta">Bữa ăn ngày {{ menuDate.split('-').reverse().join('/') }}</span><strong class="payment-amount">{{ amount == null ? 'Chưa có số tiền' : money(amount) }}</strong><button v-if="breakdown.total != null" type="button" class="payment-text-action" :disabled="loading" @click="editingAmount=!editingAmount">{{ editingAmount ? 'Xong' : 'Sửa số tiền' }}</button></div>
      <div v-if="breakdown.total == null || editingAmount" class="field"><GlassInput :label="breakdown.total == null ? 'Số tiền đã thống nhất (đ)' : 'Số tiền chuyển (đ)'" inputmode="numeric" :model-value="amountText" :disabled="loading" placeholder="Nhập số tiền" @update:model-value="setAmountText" /></div>
      <nav v-if="hasBank && hasMomo" class="payment-tabs" aria-label="Cách chuyển tiền"><button type="button" :class="{active:activeTab==='bank'}" :aria-pressed="activeTab==='bank'" @click="activeTab='bank'">Ngân hàng</button><button type="button" :class="{active:activeTab==='momo'}" :aria-pressed="activeTab==='momo'" @click="activeTab='momo'">MoMo</button></nav>
      <template v-if="hasBank || hasMomo">
        <div class="payment-qr-area">
          <template v-if="amount != null"><img v-if="!qrError" :key="`${activeTab}-${qrKey}`" :src="qrUrl" :alt="`Mã QR chuyển ${money(amount)} cho ${poster?.full_name || 'người đăng menu'}`" class="payment-qr" width="240" height="240" @error="qrError=true" /><p v-if="qrError" class="alert">Chưa tải được mã QR. <button type="button" class="payment-text-action" @click="retryQR">Thử lại</button></p><button type="button" class="payment-text-action" :disabled="downloading" @click="downloadQr">{{ downloading ? 'Đang tải…' : 'Tải QR chuyển khoản' }}</button></template><p v-else class="meta">Nhập số tiền để hiện mã QR.</p>
          <p v-if="activeTab==='momo'" class="meta">Quét bằng ứng dụng ngân hàng. <a v-if="amount != null" :href="momoDeepLink" target="_blank" rel="noopener noreferrer">Mở MoMo</a></p>
        </div>
        <section class="payment-recipient"><span class="meta">Người nhận</span><strong>{{ payInfo.accountName || poster?.full_name || 'Người đăng menu' }}</strong><span v-if="activeTab==='bank'" class="meta">{{ fullBankName }}</span><div class="payment-copy-row"><span>{{ activeTab==='bank' ? payInfo.accountNumber : payInfo.momoPhone }}</span><button type="button" class="payment-text-action" @click="copyText(activeTab==='bank' ? payInfo.accountNumber : payInfo.momoPhone,'account')">{{ copiedField==='account' ? 'Đã chép' : 'Sao chép' }}</button></div></section>
        <div class="payment-memo"><span class="meta">Nội dung chuyển tiền</span><div class="payment-copy-row"><strong>{{ memo }}</strong><button type="button" class="payment-text-action" @click="copyText(memo,'memo')">{{ copiedField==='memo' ? 'Đã chép' : 'Sao chép' }}</button></div></div>
      </template>
      <p v-else class="order-lines meta">{{ poster?.payment_info || 'Người đăng chưa thêm thông tin nhận tiền. Liên hệ người đăng để chuyển tiền.' }}</p>
      <p v-if="copyError" class="alert" role="alert">{{ copyError }}</p><p v-if="downloadError" class="meta" role="status">{{ downloadError }}</p><p v-if="error" class="alert" role="alert">{{ error }}</p>
      <p v-if="own" class="payment-notice">Chuyển tiền xong, bạn bấm xác nhận bên dưới nhé.</p>
    </div>
    <template #footer><div v-if="own && !order.is_paid" class="payment-confirm"><AppButton block :loading="loading" @click="confirmPaid">Tôi đã chuyển tiền</AppButton></div></template>
  </component>
</template>
<style scoped>
.payment-inline{display:grid;gap:16px;padding-bottom:20px;margin-bottom:16px;border-bottom:1px solid var(--line)}
/* Popup dài trên điện thoại: nút xác nhận dính đáy vùng cuộn, khỏi phải cuộn xuống mới bấm được.
   bottom:-12px bù phần đệm đáy 12px của khung cuộn sheet (AppDialog) để nút sát đáy. */
.payment-inline>.payment-confirm{position:sticky;bottom:-12px;z-index:1;padding-top:12px;background:var(--card);box-shadow:0 -1px 0 var(--line)}
.payment-dialog{display:grid;gap:16px;min-width:0;font-size:16px;line-height:1.5}.payment-dialog .meta{font-size:14px;color:var(--ink-soft);line-height:1.5;margin:0}.payment-heading{display:grid;justify-items:center;gap:4px;text-align:center}.payment-amount{font-size:32px;line-height:1.2;font-weight:700;letter-spacing:-.025em;font-variant-numeric:tabular-nums}.payment-text-action{display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:8px;background:none;color:var(--primary-ink);font:inherit;font-size:14px;min-height:44px;padding:8px;cursor:pointer}.payment-text-action:disabled{opacity:.45;cursor:default}.payment-text-action:focus-visible,.payment-tabs button:focus-visible{outline:3px solid var(--primary);outline-offset:2px}.payment-tabs{display:flex;justify-content:center;gap:4px}.payment-tabs button{font:inherit;font-size:16px;min-height:44px;padding:10px 16px;border:0;border-radius:10px;background:transparent;color:var(--ink-soft);cursor:pointer}.payment-tabs button.active{background:var(--bg-tint);color:var(--ink);font-weight:600}.payment-qr-area{display:grid;justify-items:center;gap:4px}.payment-qr{width:min(240px,100%);height:auto;background:#fff}.payment-qr-area>.meta{text-align:center}.payment-recipient{display:grid;gap:2px;border-top:1px solid var(--line);padding-top:16px;min-width:0}.payment-recipient>strong{font-size:17px;font-weight:650;overflow-wrap:anywhere}.payment-copy-row{display:flex;justify-content:space-between;align-items:center;gap:12px;min-width:0}.payment-copy-row>span,.payment-copy-row>strong{overflow-wrap:anywhere;min-width:0;font-size:16px;font-variant-numeric:tabular-nums}.payment-copy-row button{flex:none}.payment-memo{border-top:1px solid var(--line);padding-top:12px}.payment-notice{font-size:14px;color:var(--ink-soft);margin:0;line-height:1.5}.order-lines{white-space:pre-line;overflow-wrap:anywhere}@media(max-width:380px){.payment-qr{width:200px}.payment-amount{font-size:28px}}
</style>

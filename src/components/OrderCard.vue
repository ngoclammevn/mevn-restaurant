<script setup>
import { ref, computed } from 'vue'
import { useUser } from '@clerk/vue'
import { useOrders } from '../composables/useOrders'
import { useAppPresence } from '../composables/useAppPresence'
import { todayInVN } from '../lib/date'
import { managedOrderAmount } from '../lib/manage-summary'
import { reviewForItem } from '../lib/menu'
import { AppButton, PaidToggle, PaidStamp, PaymentQRModal } from './ui'
import ReviewDialog from './ReviewDialog.vue'
const props = defineProps({ order: { type: Object, required: true }, menu: { type: Object, required: true }, compact: Boolean, inlineQr: Boolean })
const emit = defineEmits(['changed'])
const { user } = useUser()
const { togglePaid } = useOrders()
const { notifyOrderChanged } = useAppPresence()
const own = computed(() => props.order.user_id === user.value?.id)
const sponsored = computed(()=>props.menu.payment_mode==='sponsored')
const hasQR = computed(() => /STK:|Momo:/.test(props.menu.poster?.payment_info ?? ''))
const paymentOrder = computed(() => ({ ...props.order, user: props.order.user || { full_name: user.value?.fullName || '' } }))
const loading = ref(false), error = ref(''), qr = ref(false), review = ref(false)
const eligible = computed(() => own.value && props.menu.menu_date <= todayInVN() && props.order.order_items?.length)
const reviewCount = computed(() => (props.order.order_items ?? []).filter(reviewForItem).length)
const amount = computed(() => managedOrderAmount(props.menu, props.order))
const showInlineQr = computed(() => props.inlineQr && own.value && !sponsored.value && !props.order.is_paid)
const reviewLabel = computed(() => reviewCount.value ? `Đánh giá (${reviewCount.value}/${props.order.order_items?.length ?? 0})` : 'Đánh giá bữa ăn')
async function paid(value) {
  if (!own.value || loading.value || sponsored.value) return
  const uid = user.value?.id, id = props.order.id, menuId = props.menu.id
  loading.value = true; error.value = ''
  try {
    const result = await togglePaid(props.order.id, value)
    if (uid !== user.value?.id || id !== props.order.id || !own.value) return
    if (result.error) throw result.error
    props.order.is_paid = result.data?.is_paid ?? value; props.order.paid_at = result.data?.paid_at ?? null
    qr.value = false; emit('changed'); notifyOrderChanged(menuId)
  } catch { if (uid === user.value?.id && id === props.order.id) error.value = 'Chưa cập nhật được thanh toán. Thử lại.' }
  finally { loading.value = false }
}
</script>
<template>
  <article :class="['order-card', compact ? 'order-card--compact' : 'card stack-sm', { 'order-card--own': own }]">
    <div class="order-heading"><router-link :to="`/menu/${menu.id}`" class="order-title">{{ menu.restaurant?.name || menu.title }}</router-link><span v-if="sponsored" class="badge">Được mời</span><PaidStamp v-else :paid="order.is_paid" /></div>
    <p class="order-items order-lines">{{ compact ? order.item_text.split('\n').filter(Boolean).join(' · ') : order.item_text }}</p>
    <p v-if="order.note" class="meta order-lines">{{ order.note }}</p>
    <p v-if="amount != null" class="order-amount">{{ Number(amount).toLocaleString('vi-VN') }}đ</p><p v-else class="meta">—</p>
    <div v-if="own" class="order-actions">
      <AppButton v-if="!sponsored && !order.is_paid && !showInlineQr" variant="ghost" @click="qr = true">Chuyển khoản</AppButton>
      <PaidToggle class="order-pay-action" v-if="!sponsored && !showInlineQr && (!compact || order.is_paid)" :paid="order.is_paid" :loading="loading" @toggle="paid" />
      <router-link v-if="!menu.is_closed && !menu.archived_at" class="order-text-action" :to="{ path: `/menu/${menu.id}`, query: { edit: order.id } }">Sửa món</router-link>
      <button v-if="eligible" type="button" class="order-text-action" @click="review = true">{{ reviewLabel }}</button>
    </div>
    <p v-if="!compact && own && !sponsored && !order.is_paid && !showInlineQr" class="meta">Chuyển khoản{{ menu.poster?.full_name ? ` cho ${menu.poster.full_name}` : '' }} rồi bấm “Tôi đã chuyển tiền”.</p>
    <p v-if="!compact && own && !sponsored && menu.poster?.payment_info && !hasQR && !showInlineQr" class="meta order-lines">{{ menu.poster.payment_info }}</p>
    <p v-if="error && !showInlineQr" class="alert" role="alert">{{ error }}</p>
    <PaymentQRModal v-if="showInlineQr" inline :order="paymentOrder" :poster="menu.poster" :menu="menu" :menu-date="menu.menu_date" :loading="loading" :error="error" @paid="paid(true)" />
    <PaymentQRModal v-else-if="qr && own && !sponsored" :order="paymentOrder" :poster="menu.poster" :menu="menu" :menu-date="menu.menu_date" :loading="loading" :error="error" @close="!loading && (qr = false)" @paid="paid(true)" />
    <ReviewDialog v-if="review && own" :order="order" :menu="menu" @close="review = false" @saved="emit('changed')" />
  </article>
</template>
<style scoped>
.order-card{min-width:0}.order-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.order-title{font-size:17px;font-weight:650;line-height:1.4;text-decoration:none;overflow-wrap:anywhere}.order-items{font-size:16px;line-height:1.6;margin:8px 0}.order-amount{font-size:20px;font-weight:700;font-variant-numeric:tabular-nums;margin:4px 0}.order-actions{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.order-card .meta{font-size:14px;line-height:1.6;margin:6px 0}.order-lines{white-space:pre-line;overflow-wrap:anywhere}.order-card--compact{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:16px;padding:8px 0;border:0;background:transparent;border-radius:0}.order-card--compact+.order-card--compact{border-top:1px solid var(--line)}
.order-card--compact .order-heading{grid-column:1/-1}.order-card--compact .order-items{margin:6px 0;white-space:normal}.order-card--compact .order-amount{grid-column:2;grid-row:2;font-size:18px}.order-card--compact .order-actions,.order-card--compact>.meta,.order-card--compact>.alert{grid-column:1/-1}.order-card--compact .order-actions{margin:6px 0 0}.order-card--compact .order-actions :deep(button){min-height:44px}
@media(max-width:600px){.order-actions{display:flex;gap:8px}.order-actions>:deep(.order-pay-action){flex-basis:100%;width:100%}.order-actions>:deep(.order-pay-action button){width:100%}.order-actions>.btn,.order-actions>:deep(.glass-button-host){flex-grow:1}.order-actions>:deep(.glass-button-host button){width:100%}}
@media(max-width:600px){.order-actions :deep(.order-pay-action .glass-button-mount),.order-actions :deep(.order-pay-action button){width:100%}}
.order-text-action { display:inline-flex; align-items:center; min-height:44px; padding:8px 10px; background:transparent; border:0; border-radius:8px; color:var(--primary-ink); font:inherit; font-size:15px; font-weight:600; text-decoration:none; cursor:pointer; }.order-text-action:hover { background:var(--primary-soft); }
</style>

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
const props = defineProps({ order: { type: Object, required: true }, menu: { type: Object, required: true }, compact: Boolean })
const emit = defineEmits(['changed'])
const { user } = useUser()
const { togglePaid } = useOrders()
const { notifyOrderChanged } = useAppPresence()
const own = computed(() => props.order.user_id === user.value?.id)
const hasQR = computed(() => /STK:|Momo:/.test(props.menu.poster?.payment_info ?? ''))
const paymentOrder = computed(() => ({ ...props.order, user: props.order.user || { full_name: user.value?.fullName || '' } }))
const loading = ref(false), error = ref(''), qr = ref(false), review = ref(false)
const eligible = computed(() => own.value && props.menu.menu_date <= todayInVN() && props.order.order_items?.length)
const reviewCount = computed(() => (props.order.order_items ?? []).filter(reviewForItem).length)
const amount = computed(() => managedOrderAmount(props.menu, props.order))
const reviewLabel = computed(() => reviewCount.value ? `Đánh giá (${reviewCount.value}/${props.order.order_items?.length ?? 0})` : 'Đánh giá bữa ăn')
async function paid(value) {
  if (!own.value || loading.value) return
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
    <template v-if="compact">
      <div class="compact-order-content"><p class="compact-order-items">{{ order.item_text.split('\n').join(' · ') }}</p><p class="compact-order-meta">{{ menu.restaurant?.name || menu.title }}<span v-if="amount != null"> · {{ Number(amount).toLocaleString('vi-VN') }}đ</span> · {{ order.is_paid ? 'Đã thanh toán' : 'Chưa thanh toán' }}</p></div>
      <div v-if="own" class="compact-order-actions"><AppButton v-if="!order.is_paid && hasQR" variant="ghost" @click="qr = true">Chuyển khoản</AppButton><AppButton v-if="eligible" variant="ghost" @click="review = true">{{ reviewCount ? 'Xem đánh giá' : 'Đánh giá bữa ăn' }} <span aria-hidden="true">→</span></AppButton></div>
      <details class="compact-order-details"><summary>{{ !order.is_paid && !hasQR ? 'Thanh toán & chi tiết' : 'Chi tiết đơn' }}</summary><div class="stack-sm"><p v-if="order.note" class="meta order-lines">{{ order.note }}</p><p v-if="amount == null" class="meta">Xác nhận số tiền với người đăng menu.</p><p v-if="own && menu.poster?.payment_info && !hasQR" class="meta order-lines">{{ menu.poster.payment_info }}</p><div class="row-wrap"><AppButton variant="ghost" size="sm" :to="`/menu/${menu.id}`">Xem menu</AppButton><AppButton v-if="own && !menu.is_closed" variant="ghost" size="sm" :to="{ path: `/menu/${menu.id}`, query: { edit: order.id } }">Sửa món</AppButton><PaidToggle v-if="own" :paid="order.is_paid" :loading="loading" @toggle="paid" /></div></div></details>
    </template>
    <template v-else>
      <div class="row-wrap"><router-link :to="`/menu/${menu.id}`" class="section-title">{{ menu.restaurant?.name || menu.title }}</router-link><PaidStamp class="spacer" :paid="order.is_paid" /></div>
      <p class="order-lines">{{ order.item_text }}</p><p v-if="order.note" class="meta order-lines">{{ order.note }}</p>
      <div v-if="own" class="stack-sm order-payment"><p v-if="!order.is_paid" class="meta">Chuyển khoản{{ menu.poster?.full_name ? ` cho ${menu.poster.full_name}` : '' }} rồi tự đánh dấu đã trả.</p><div class="row-wrap"><AppButton v-if="!order.is_paid && hasQR" variant="ghost" @click="qr = true">Mở mã chuyển khoản</AppButton><PaidToggle :paid="order.is_paid" :loading="loading" @toggle="paid" /></div></div>
      <div v-if="own && (!menu.is_closed || eligible)" class="row-wrap order-secondary-actions"><AppButton v-if="!menu.is_closed" variant="ghost" size="sm" :to="{ path: `/menu/${menu.id}`, query: { edit: order.id } }">Sửa món</AppButton><AppButton v-if="eligible" variant="ghost" size="sm" @click="review = true">{{ reviewLabel }}</AppButton></div>
      <details v-if="own && menu.poster?.payment_info && !hasQR"><summary>Thông tin chuyển khoản</summary><p class="meta order-lines">{{ menu.poster.payment_info }}</p></details>
    </template>
    <p v-if="error" class="alert" role="alert">{{ error }}</p>
    <PaymentQRModal v-if="qr && own" :order="paymentOrder" :poster="menu.poster" :menu="menu" :menu-date="menu.menu_date" :loading="loading" :error="error" @close="!loading && (qr = false)" @paid="paid(true)" />
    <ReviewDialog v-if="review && own" :order="order" :menu="menu" @close="review = false" @saved="emit('changed')" />
  </article>
</template>
<style scoped>
.order-card--compact { display:grid; grid-template-columns:minmax(0,1fr) auto; column-gap:20px; align-items:center; padding:0; border:0; background:transparent; border-radius:0; box-shadow:none; }
.compact-order-items { font-size:19px; line-height:1.5; font-weight:650; margin:4px 0; overflow-wrap:anywhere; }
.compact-order-meta { color:var(--ink-soft); font-size:13px; margin:4px 0; }
.compact-order-actions { display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }
.compact-order-details { grid-column:1/-1; }
.compact-order-details summary { font-size:12px; color:var(--ink-soft); min-height:44px; padding:10px 0; cursor:pointer; }
.compact-order-details[open] { padding-bottom:12px; }
.compact-order-details .stack-sm { padding:8px 0; }
.order-card--compact + .order-card--compact { border-top:1px solid var(--line); padding-top:16px; margin-top:8px; }
@media(max-width:640px){ .order-card--compact{grid-template-columns:1fr; row-gap:8px}.compact-order-actions{justify-content:flex-start}.compact-order-items{font-size:18px}.compact-order-details{grid-column:auto} }
</style>

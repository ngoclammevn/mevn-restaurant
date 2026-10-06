<script setup>
import { ref, computed } from 'vue'
import { useUser } from '@clerk/vue'
import { useOrders } from '../composables/useOrders'
import { useAppPresence } from '../composables/useAppPresence'
import { todayInVN } from '../lib/date'
import { reviewForItem } from '../lib/menu'
import { AppButton, PaidToggle, PaidStamp, PaymentQRModal } from './ui'
import ReviewDialog from './ReviewDialog.vue'
const props = defineProps({ order: { type: Object, required: true }, menu: { type: Object, required: true } })
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
  <article class="card stack-sm order-card" :class="{ 'order-card--own': own }">
    <div class="row-wrap"><router-link :to="`/menu/${menu.id}`" class="section-title">{{ menu.restaurant?.name || menu.title }}</router-link><PaidStamp class="spacer" :paid="order.is_paid" /></div>
    <p class="order-lines">{{ order.item_text }}</p><p v-if="order.note" class="meta order-lines">{{ order.note }}</p>
    <div v-if="own" class="stack-sm order-payment"><p v-if="!order.is_paid" class="meta">Chuyển khoản{{ menu.poster?.full_name ? ` cho ${menu.poster.full_name}` : '' }} rồi tự đánh dấu đã trả.</p><div class="row-wrap"><AppButton v-if="!order.is_paid && hasQR" variant="ghost" @click="qr = true">Mở mã chuyển khoản</AppButton><PaidToggle :paid="order.is_paid" :loading="loading" @toggle="paid" /></div></div>
    <div v-if="own && (!menu.is_closed || eligible)" class="row-wrap order-secondary-actions"><AppButton v-if="!menu.is_closed" variant="ghost" size="sm" :to="{ path: `/menu/${menu.id}`, query: { edit: order.id } }">Sửa món</AppButton><AppButton v-if="eligible" variant="ghost" size="sm" @click="review = true">{{ reviewLabel }}</AppButton></div>
    <details v-if="own && menu.poster?.payment_info && !hasQR"><summary>Thông tin chuyển khoản</summary><p class="meta order-lines">{{ menu.poster.payment_info }}</p></details>
    <p v-if="error" class="alert" role="alert">{{ error }}</p>
    <PaymentQRModal v-if="qr && own" :order="paymentOrder" :poster="menu.poster" :menu="menu" :menu-date="menu.menu_date" @close="!loading && (qr = false)" @paid="paid(true)" />
    <ReviewDialog v-if="review && own" :order="order" :menu="menu" @close="review = false" @saved="emit('changed')" />
  </article>
</template>

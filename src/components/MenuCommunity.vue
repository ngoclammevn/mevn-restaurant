<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useUser } from '@clerk/vue'
import { usePickup } from '../composables/usePickup'
import { useOrders } from '../composables/useOrders'
import { useSlackNotifications } from '../composables/useSlackNotifications'
import { managedOrderAmount } from '../lib/manage-summary'
import { AppButton, PaidStamp, PaymentQRModal } from './ui'
import Avatar from './ui/Avatar.vue'
const props = defineProps({ menu: { type: Object, required: true } })
const emit = defineEmits(['changed'])
const { user } = useUser(), api = usePickup(), notifications = useSlackNotifications()
const { togglePaid } = useOrders()
const pickup = ref(null), busy = ref(false), error = ref('')
// Đơn của chính mình đang mở popup chuyển khoản; cùng điều kiện nút "Chuyển khoản" ở Đơn của tôi.
const payOrder = ref(null), paying = ref(false), payError = ref('')
const canPay = order => order.user_id === user.value?.id && !order.is_paid && props.menu.payment_mode !== 'sponsored'
const orders = computed(() => props.menu.orders ?? [])
const people = computed(() => new Set(orders.value.map(o => o.user_id)).size)
// Dòng tổng thanh toán: đơn chưa có giá không cộng vào số tiền còn thiếu, đếm riêng.
const payStatus = computed(() => {
  if (props.menu.payment_mode === 'sponsored' || !orders.value.length) return ''
  const unpaid = orders.value.filter(o => !o.is_paid), amounts = unpaid.map(o => managedOrderAmount(props.menu, o))
  const owed = amounts.reduce((sum, value) => sum + (value ?? 0), 0), unpriced = amounts.filter(value => value === null).length
  const paid = `Đã trả ${orders.value.length - unpaid.length}/${orders.value.length} đơn`
  if (!unpaid.length) return paid
  return [paid, owed && `còn thiếu ${owed.toLocaleString('vi-VN')}đ`, unpriced && `${unpriced} đơn chưa có giá`].filter(Boolean).join(' · ')
})
const assigned = computed(() => pickup.value && pickup.value.status !== 'unassigned' ? pickup.value : null)
// Nhãn chỉ gắn vào đơn đầu tiên của mỗi người, tránh lặp khi một người đặt nhiều đơn.
const firstOrderIds = computed(() => { const seen = new Set(); return new Set(orders.value.filter(o => !seen.has(o.user_id) && seen.add(o.user_id)).map(o => o.id)) })
const canReceive = computed(() => assigned.value?.status === 'assigned' && (props.menu.poster_id === user.value?.id || assigned.value.primary_user_id === user.value?.id))
const pickerHasOrder = computed(() => orders.value.some(o => o.user_id === assigned.value?.primary_user_id))
function pickupLabel(order) {
  if (!assigned.value || !firstOrderIds.value.has(order.id)) return ''
  if (order.user_id === assigned.value.primary_user_id) return assigned.value.status === 'received' ? 'Đã lấy cơm' : 'Lấy cơm'
  return order.user_id === assigned.value.backup_user_id ? 'Dự phòng lấy cơm' : ''
}
let generation = 0
async function load() {
  const current = ++generation
  pickup.value = null; error.value = ''
  if (!user.value?.id || props.menu.archived_at) return
  try {
    const result = await api.getPickup(props.menu.id)
    if (current !== generation) return
    if (result.error) throw result.error
    pickup.value = result.data
  } catch { if (current === generation) error.value = 'Chưa tải được người lấy cơm.' }
}
watch([() => props.menu.id, () => props.menu.current_closure_id, () => user.value?.id], load, { immediate: true })
onUnmounted(() => generation++)
async function markReceived() {
  if (busy.value || !canReceive.value) return
  const current = generation, id = props.menu.id
  busy.value = true; error.value = ''
  try {
    const result = await api.markReceived(assigned.value.id)
    if (current !== generation) return
    if (result.error) throw result.error
    await load(); emit('changed'); void notifications.notifyReceived({ menu_id: id })
  } catch { if (current === generation) error.value = 'Chưa cập nhật được lượt lấy cơm. Tải lại rồi thử lại.' }
  finally { busy.value = false }
}
async function paid() {
  if (paying.value || !payOrder.value) return
  paying.value = true; payError.value = ''
  const result = await togglePaid(payOrder.value.id, true).catch(error => ({ error }))
  paying.value = false
  if (result.error) { payError.value = 'Chưa cập nhật được thanh toán. Thử lại.'; return }
  payOrder.value = null; emit('changed')
}
</script>
<template>
  <section class="card menu-community">
    <slot />
    <div class="menu-community-heading"><h2>Mọi người đã đặt</h2><span class="badge">{{ people }} người</span></div>
    <p v-if="payStatus" class="meta">{{ payStatus }}</p>
    <p v-if="assigned && !pickerHasOrder" class="meta">Người lấy cơm: <strong>{{ assigned.primary?.full_name || 'Thành viên' }}</strong> · {{ assigned.status === 'received' ? 'Đã lấy cơm' : 'Chưa lấy' }}</p>
    <article v-for="order in orders" :key="order.id" class="menu-community-person">
      <Avatar :profile="order.user" :name="order.user?.full_name" :size="34" />
      <div>
        <strong>{{ order.user?.full_name || 'Thành viên' }}</strong><span v-if="pickupLabel(order)" class="pickup-tag" :class="{ 'pickup-tag--done': assigned.status === 'received' && order.user_id === assigned.primary_user_id }">{{ pickupLabel(order) }}</span>
        <p>{{ order.item_text.split('\n').join(' · ') }}<span v-if="managedOrderAmount(menu, order) !== null"> · {{ Number(managedOrderAmount(menu, order)).toLocaleString('vi-VN') }}đ</span></p>
        <p v-if="order.note" class="meta">{{ order.note }}</p>
        <AppButton v-if="canPay(order)" size="sm" @click="payOrder = order; payError = ''">Chuyển khoản</AppButton>
        <AppButton v-if="canReceive && order.user_id === assigned.primary_user_id && firstOrderIds.has(order.id)" size="sm" :loading="busy" @click="markReceived">Đã lấy cơm</AppButton>
      </div>
      <span v-if="menu.payment_mode === 'sponsored'" class="badge">Được mời</span><PaidStamp v-else :paid="order.is_paid" />
    </article>
    <AppButton v-if="canReceive && !pickerHasOrder" size="sm" :loading="busy" @click="markReceived">Đã lấy cơm</AppButton>
    <p v-if="!orders.length" class="meta">Chưa có ai đặt.</p>
    <PaymentQRModal v-if="payOrder" :order="payOrder" :poster="menu.poster" :menu="menu" :menu-date="menu.menu_date" :loading="paying" :error="payError" @close="!paying && (payOrder = null)" @paid="paid" />
    <p v-if="error" class="alert" role="alert">{{ error }} <button type="button" @click="load">Thử lại</button></p>
  </section>
</template>
<style scoped>
.menu-community { margin:20px 0 16px; }
.menu-community h2 { font-size:20px; font-weight:700; line-height:1.4; margin:0; }
.menu-community-heading { display:flex; align-items:center; justify-content:space-between; gap:16px; }
.menu-community>.meta { margin:8px 0; }
.menu-community-person { display:flex; align-items:flex-start; gap:12px; padding:16px 0; border-bottom:1px solid var(--line); }
.menu-community-person>div { flex:1; min-width:0; }
.menu-community-person strong { font-size:16px; }
.menu-community-person p { font-size:14px; color:var(--ink-soft); margin:4px 0; overflow-wrap:anywhere; }
.menu-community-person:last-of-type { border-bottom:0; }
.pickup-tag { display:inline-block; margin-left:8px; padding:2px 8px; border-radius:999px; font-size:13px; font-weight:700; vertical-align:middle; color:#7a4b00; background:#fff3d6; }
.pickup-tag--done { color:var(--primary-ink); background:var(--primary-soft); }
@media(max-width:640px) { .menu-community-person { flex-wrap:wrap; }.menu-community-person :deep(.paid-stamp) { margin-left:46px; } }
</style>

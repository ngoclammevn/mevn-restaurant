<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useUser } from '@clerk/vue'
import { useOrders } from '../composables/useOrders'
import { useAppPresence } from '../composables/useAppPresence'
import { monthDays, shiftMonth } from '../lib/calendar'
import { todayInVN, formatVNDate } from '../lib/date'
import { AppButton, PageHeader, Spinner, EmptyState, SignInModal } from '../components/ui'
import OrderCard from '../components/OrderCard.vue'
const { user, isSignedIn } = useUser()
const { listMyOrders } = useOrders()
const { onOrderChanged } = useAppPresence()
const today = todayInVN(), month = ref(today.slice(0, 7)), selected = ref(today)
const days = computed(() => monthDays(month.value))
const orders = ref([]), loading = ref(false), error = ref(''), showSignIn = ref(false)
const unpaidOrders = ref([]), unpaidLoading = ref(false), unpaidError = ref('')
const grouped = computed(() => {
  const result = {}
  for (const order of orders.value) {
    const date = order.menu?.menu_date
    if (date) (result[date] ??= []).push(order)
  }
  return result
})
const selectedOrders = computed(() => grouped.value[selected.value] ?? [])
const unpaid = computed(() => orders.value.filter(o => !o.is_paid).length)
const monthTitle = computed(() => new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month.value}-01T12:00:00Z`)))
let generation = 0, unpaidGeneration = 0
watch([month, () => user.value?.id], () => load(), { immediate: true })
watch(() => user.value?.id, () => loadUnpaid(), { immediate: true })
const unsubscribe = onOrderChanged(() => { load(false); loadUnpaid(false) })
onUnmounted(() => { generation++; unpaidGeneration++; unsubscribe() })
async function readAll(range, current, isCurrent) {
  const result = []
  for (let offset = 0; ; offset += 100) {
    const page = await listMyOrders({ ...range, offset, limit: 100 })
    if (!isCurrent(current)) return null
    if (page.error) throw page.error
    result.push(...(page.data ?? []))
    if ((page.data ?? []).length < 100 || (page.count != null && offset + page.data.length >= page.count)) return result
  }
}
async function loadUnpaid(clear = true) {
  const current = ++unpaidGeneration; if (clear) unpaidOrders.value = []; unpaidError.value = ''
  if (!isSignedIn.value) { unpaidLoading.value = false; return }
  unpaidLoading.value = true
  try {
    const result = await readAll({ unpaidOnly: true }, current, value => value === unpaidGeneration)
    if (current !== unpaidGeneration) return
    unpaidOrders.value = result ?? []
  } catch { if (current === unpaidGeneration) unpaidError.value = 'Chưa tải được các đơn chưa trả.' }
  finally { if (current === unpaidGeneration) unpaidLoading.value = false }
}
function orderChanged(order) {
  for (const entry of [...orders.value, ...unpaidOrders.value]) {
    if (entry.id === order.id) { entry.is_paid = order.is_paid; entry.order_items = order.order_items }
  }
  unpaidOrders.value = unpaidOrders.value.filter(entry => !entry.is_paid)
  if (!order.is_paid && !unpaidOrders.value.some(entry => entry.id === order.id)) unpaidOrders.value.push(order)
}
async function load(clear = true) {
  const current = ++generation; if (clear) orders.value = []; error.value = ''
  if (!isSignedIn.value) { loading.value = false; return }
  loading.value = true
  const range = days.value
  try {
    const result = await readAll({ from: range[0], to: range[range.length - 1] }, current, value => value === generation)
    if (current !== generation) return
    orders.value = result ?? []
  } catch { if (current === generation) error.value = 'Chưa tải được lịch cơm. Thử lại.' }
  finally { if (current === generation) loading.value = false }
}
function move(offset) { month.value = shiftMonth(month.value, offset); selected.value = `${month.value}-01` }
function goToday() { month.value = today.slice(0, 7); selected.value = today }
</script>
<template><div class="stack history-page">
  <div class="history-heading"><PageHeader eyebrow="Lịch cơm" title="Lịch cơm" sub="Chọn ngày để xem bữa trưa, quán và đánh giá." /><AppButton variant="ghost" to="/taste">Khẩu vị của tôi</AppButton></div>
  <EmptyState v-if="!isSignedIn" title="Đăng nhập để xem lịch cơm"><AppButton @click="showSignIn = true">Đăng nhập</AppButton></EmptyState>
  <template v-else>
    <p v-if="error" class="alert" role="alert">{{ error }} <button type="button" @click="load">Thử lại</button></p>
    <section class="card history-calendar" :aria-busy="loading">
      <div class="history-month"><AppButton variant="ghost" aria-label="Tháng trước" @click="move(-1)">←</AppButton><h2>{{ monthTitle }}</h2><AppButton variant="ghost" aria-label="Tháng sau" @click="move(1)">→</AppButton><AppButton variant="ghost" class="history-today" @click="goToday">Hôm nay</AppButton></div>
      <div class="calendar-grid"><span v-for="label in ['T2','T3','T4','T5','T6','T7','CN']" :key="label" class="calendar-weekday">{{ label }}</span>
        <button v-for="date in days" :key="date" type="button" class="calendar-cell" :class="{ outside: !date.startsWith(month), active: selected === date, today: date === today, meal: grouped[date]?.length }" :aria-label="`${formatVNDate(date)}, ${(grouped[date] ?? []).length} đơn`" :aria-pressed="selected === date" @click="selected = date"><b>{{ Number(date.slice(-2)) }}</b><span v-if="grouped[date]?.length" class="calendar-dishes">{{ grouped[date].map(order => order.item_text).join(', ') }}</span><span v-if="grouped[date]?.length" class="calendar-count">{{ grouped[date].length }} đơn</span><i v-if="grouped[date]?.length" class="meal-dot" aria-hidden="true" /><i v-if="grouped[date]?.some(o => !o.is_paid)" class="unpaid-dot" aria-label="Có đơn chưa trả" /></button>
      </div>
      <p class="meta calendar-legend">Có bữa trưa: ngày có món · Chọn ngày để xem chi tiết</p>
    </section>
    <div class="history-detail-grid">
      <section class="card stack history-day"><span class="eyebrow">Ngày {{ formatVNDate(selected) }}</span><Spinner v-if="loading && !orders.length" label="Đang tải đơn…" /><p v-else-if="loading" class="meta" role="status">Đang cập nhật…</p><div class="stack"><OrderCard v-for="order in selectedOrders" :key="order.id" :order="order" :menu="order.menu" @changed="orderChanged(order)" /><EmptyState v-if="!loading && !error && !selectedOrders.length" title="Chưa có đơn" description="Ngày này chưa có bữa trưa. Đơn đặt hộ bạn cũng xuất hiện ở đây." /></div></section>
      <section class="card stack history-unpaid"><div><h2>Đơn chưa thanh toán</h2><p class="meta">Các đơn chưa trả được giữ riêng khỏi lịch.</p></div><Spinner v-if="unpaidLoading" label="Đang tải đơn chưa trả…" /><p v-if="unpaidError" class="alert" role="alert">{{ unpaidError }} <button type="button" @click="loadUnpaid">Thử lại</button></p><div v-for="order in unpaidOrders" :key="order.id" class="stack-sm history-unpaid-entry"><p class="meta">{{ formatVNDate(order.menu.menu_date) }}</p><OrderCard :order="order" :menu="order.menu" @changed="orderChanged(order)" /></div><p v-if="!unpaidLoading && !unpaidError && !unpaidOrders.length" class="meta">Bạn đã thanh toán tất cả đơn cơm.</p></section>
    </div>
  </template><SignInModal v-if="showSignIn" @close="showSignIn = false" />
</div></template>
<style scoped>
.history-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }.history-heading > .btn { margin-top:8px; flex:none; }
.history-calendar { padding:16px; }.history-month { display:flex; align-items:center; gap:12px; margin-bottom:18px; }.history-month h2 { margin:0; text-transform:capitalize; font-size:21px; }.history-today { margin-left:auto; }
.calendar-grid { gap:6px; }.calendar-cell { min-height:84px; border:1px solid var(--line); border-radius:10px; padding:8px 6px; gap:4px; text-align:left; }.calendar-cell b { font-size:14px; }.calendar-cell.meal { background:var(--primary-soft); }.calendar-cell.outside { opacity:.4; background:var(--card); }.calendar-cell.active { border:2px solid var(--primary); padding:7px 5px; }.calendar-cell.today b { color:var(--primary-ink); }.calendar-dishes { width:100%; white-space:nowrap; text-overflow:ellipsis; overflow:hidden; font-size:12px; }.calendar-count { font-size:12px; color:var(--ink-soft); }.meal-dot { display:none; }.calendar-legend { margin:14px 0 0; font-size:12px; }
.history-detail-grid { display:grid; grid-template-columns:1fr 1fr; gap:22px; margin-top:4px; align-items:start; }.history-detail-grid h2 { font-size:21px; margin:0 0 8px; }.history-detail-grid :deep(.order-card) { padding:0; border:0; border-radius:0; box-shadow:none; }.history-detail-grid :deep(.order-card + .order-card) { padding-top:18px; border-top:1px solid var(--line); }.history-unpaid-entry { padding:16px 0 0; border-top:1px solid var(--line); }
@media(max-width:640px) { .history-heading { display:block; }.history-heading > .btn { margin:0 0 4px; }.history-detail-grid { grid-template-columns:1fr; gap:18px; }.history-calendar { padding:10px; }.history-month { gap:8px; margin-bottom:12px; flex-wrap:wrap; }.history-month h2 { font-size:18px; }.history-today { margin-left:auto; }.calendar-grid { gap:2px; }.calendar-cell { min-height:49px; align-items:center; padding:7px 3px; }.calendar-cell.active { padding:6px 2px; }.calendar-dishes,.calendar-count { display:none; }.meal-dot { display:block; width:5px; height:5px; background:var(--primary); border-radius:50%; }.calendar-cell > .unpaid-dot { width:4px; height:4px; right:3px; bottom:3px; }.calendar-weekday { padding:6px 0; font-size:12px; } }
</style>

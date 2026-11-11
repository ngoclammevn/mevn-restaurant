<script setup>
import { isOutstanding, orderSettlement } from '../../shared/lunch-finance.js'
import AsciiSkeleton from '../components/ui/AsciiSkeleton.vue'
import { ref, computed, watch, onUnmounted } from 'vue'
import { useUser } from '@clerk/vue'
import { useOrders } from '../composables/useOrders'
import { useAppPresence } from '../composables/useAppPresence'
import { monthDays, shiftMonth } from '../lib/calendar'
import { todayInVN, formatVNDate } from '../lib/date'
import { AppButton, AppDialog, PageHeader, Spinner, EmptyState, SignInModal } from '../components/ui'
import OrderCard from '../components/OrderCard.vue'
const { user, isSignedIn } = useUser()
const { listMyOrders } = useOrders()
const { onOrderChanged } = useAppPresence()
const today = todayInVN(), month = ref(today.slice(0, 7)), selected = ref(today)
const days = computed(() => monthDays(month.value))
const orders = ref([]), loading = ref(false), error = ref(''), showSignIn = ref(false), dayOpen = ref(false)
const unpaidOrders = ref([]), unpaidLoading = ref(false), unpaidError = ref('')
const grouped = computed(() => {
  const result = {}
  for (const order of orders.value) {
    const date = order.menu?.menu_date
    if (date) (result[date] ??= []).push(order)
  }
  return result
})
const dayPayments = computed(() => Object.fromEntries(Object.entries(grouped.value).map(([date, entries]) => {
  const outstanding = entries.some(order => isOutstanding(order.menu, order))
  const sponsored = entries.filter(order => orderSettlement(order.menu, order).paymentState === 'sponsored').length
  const label = outstanding ? 'Có đơn chưa trả' : sponsored === entries.length ? 'Được mời' : sponsored ? 'Đã trả / Được mời' : 'Đã trả'
  return [date, { state: outstanding ? 'unpaid' : 'paid', label, symbol: outstanding ? '!' : '✓' }]
})))
const selectedOrders = computed(() => grouped.value[selected.value] ?? [])
const unpaid = computed(() => orders.value.filter(o => isOutstanding(o.menu,o)).length)
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
    unpaidOrders.value = (result ?? []).filter(order=>isOutstanding(order.menu,order))
  } catch { if (current === unpaidGeneration) unpaidError.value = 'Chưa tải được các đơn chưa trả.' }
  finally { if (current === unpaidGeneration) unpaidLoading.value = false }
}
function orderChanged(order) {
  for (const entry of [...orders.value, ...unpaidOrders.value]) {
    if (entry.id === order.id) { entry.is_paid = order.is_paid; entry.order_items = order.order_items }
  }
  unpaidOrders.value = unpaidOrders.value.filter(entry => isOutstanding(entry.menu,entry))
  if (isOutstanding(order.menu,order) && !unpaidOrders.value.some(entry => entry.id === order.id)) unpaidOrders.value.push(order)
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
  <div class="history-heading"><PageHeader eyebrow="Lịch cơm" title="Đơn của tôi" sub="Chọn ngày để xem bữa trưa, quán và đánh giá." /></div>
  <EmptyState v-if="!isSignedIn" title="Đăng nhập để xem lịch cơm"><AppButton @click="showSignIn = true">Đăng nhập</AppButton></EmptyState>
  <template v-else>
    <p v-if="error" class="alert" role="alert">{{ error }} <button type="button" @click="load">Thử lại</button></p>
    <section class="card history-calendar" :aria-busy="loading">
      <div class="history-month"><AppButton variant="ghost" aria-label="Tháng trước" @click="move(-1)">←</AppButton><h2>{{ monthTitle }}</h2><AppButton variant="ghost" aria-label="Tháng sau" @click="move(1)">→</AppButton><AppButton variant="ghost" class="history-today" @click="goToday">Hôm nay</AppButton></div>
      <p v-if="loading" class="meta" role="status">Đang tải trạng thái thanh toán…</p>
      <div class="calendar-grid"><span v-for="label in ['T2','T3','T4','T5','T6','T7','CN']" :key="label" class="calendar-weekday">{{ label }}</span>
        <button v-for="date in days" :key="date" type="button" class="calendar-cell" :class="[{ outside: !date.startsWith(month), active: selected === date, today: date === today }, dayPayments[date] ? `calendar-${dayPayments[date].state}` : 'calendar-empty']" :aria-label="`${formatVNDate(date)}, ${(grouped[date] ?? []).length} đơn, ${dayPayments[date]?.label || (loading ? 'Đang tải' : error ? 'Chưa tải được' : 'Chưa có đơn')}${date === today ? ', hôm nay' : ''}`" :aria-pressed="selected === date" :aria-current="date === today ? 'date' : undefined" @click="selected = date; dayOpen = true">
          <b>{{ Number(date.slice(-2)) }}</b>
          <span v-if="grouped[date]?.length" class="calendar-dishes">{{ grouped[date].map(order => order.item_text).join(', ') }}</span>
          <span v-if="grouped[date]?.length" class="calendar-count">{{ grouped[date].length }} đơn</span>
          <span v-if="dayPayments[date]" class="calendar-payment"><span class="calendar-status-symbol" aria-hidden="true">{{ dayPayments[date].symbol }}</span><span class="calendar-state-label">{{ dayPayments[date].label }}</span></span>
        </button>
      </div>
      <div class="calendar-legend" aria-label="Chú thích trạng thái thanh toán"><span><i class="legend-swatch legend-paid" aria-hidden="true">✓</i> Đã trả / Được mời</span><span><i class="legend-swatch legend-unpaid" aria-hidden="true">!</i> Có đơn chưa trả</span><span><i class="legend-swatch legend-empty" aria-hidden="true">–</i> Chưa có đơn</span></div><p class="meta calendar-hint">Viền đậm: ngày đang chọn · Chọn ngày để xem chi tiết.</p>
    </section>
    <AppDialog :open="dayOpen" :title="`Ngày ${formatVNDate(selected)}`" @close="dayOpen = false"><div class="stack history-day"><AsciiSkeleton v-if="loading && !orders.length" kind="calendar" label="Đang tải lịch cơm…" /><p v-else-if="loading" class="meta" role="status">Đang cập nhật…</p><div class="stack"><OrderCard v-for="order in selectedOrders" :key="order.id" inline-qr :order="order" :menu="order.menu" @changed="orderChanged(order)" /><EmptyState v-if="!loading && !error && !selectedOrders.length" title="Chưa có đơn" description="Ngày này chưa có bữa trưa. Đơn đặt hộ bạn cũng xuất hiện ở đây." /></div></div></AppDialog>
    <div class="history-detail-grid">
      <section class="card stack history-unpaid"><div><h2>Đơn chưa thanh toán</h2><p class="meta">Xem các đơn còn thiếu tiền ở đây.</p></div><Spinner v-if="unpaidLoading" label="Đang tải đơn chưa trả…" /><p v-if="unpaidError" class="alert" role="alert">{{ unpaidError }} <button type="button" @click="loadUnpaid">Thử lại</button></p><div v-for="order in unpaidOrders" :key="order.id" class="stack-sm history-unpaid-entry"><p class="meta">{{ formatVNDate(order.menu.menu_date) }}</p><OrderCard :order="order" :menu="order.menu" @changed="orderChanged(order)" /></div><p v-if="!unpaidLoading && !unpaidError && !unpaidOrders.length" class="meta">Bạn đã thanh toán tất cả đơn cơm.</p></section>
    </div>
  </template><SignInModal v-if="showSignIn" @close="showSignIn = false" />
</div></template>
<style scoped>
.history-page { min-width:0; }
.history-page .meta { font-size:14px; color:var(--ink-soft); }
.history-page :deep(.btn), .history-page .alert button { min-height:48px; font-size:16px; }
.history-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
.history-heading > .btn { margin-top:8px; flex:none; }
.history-calendar { padding:24px; box-shadow:none; --calendar-paid-bg:#e8f5ec; --calendar-paid-ink:#145c35; --calendar-paid-border:#9dc9aa; --calendar-unpaid-bg:#fff0ee; --calendar-unpaid-ink:#9c281f; --calendar-unpaid-border:#e3b0aa; }
.history-month { display:flex; align-items:center; gap:12px; margin-bottom:20px; }
.history-month h2 { margin:0; text-transform:capitalize; font-size:24px; font-weight:750; }
.history-month :deep(.btn) { min-width:44px; }
.history-today { margin-left:auto; }
.calendar-grid { gap:8px; }
.calendar-weekday { padding:8px 0; font-size:14px; font-weight:700; color:var(--ink-soft); }
.calendar-cell { min-width:0; min-height:132px; border:1px solid var(--line); border-radius:10px; padding:10px; gap:6px; text-align:left; color:var(--ink); }
.calendar-cell b { font-size:18px; font-weight:750; line-height:1.4; }
.calendar-cell.calendar-empty { background:var(--bg-tint); }
.calendar-cell.calendar-paid { background:var(--calendar-paid-bg); border-color:var(--calendar-paid-border); color:var(--calendar-paid-ink); }
.calendar-cell.calendar-unpaid { background:var(--calendar-unpaid-bg); border-color:var(--calendar-unpaid-border); color:var(--calendar-unpaid-ink); }
.calendar-cell.outside { opacity:1; }
.calendar-cell.outside b { text-decoration:underline dotted; text-underline-offset:4px; }
.calendar-cell.active { outline:2px solid var(--ink); outline-offset:2px; }
.calendar-cell.today b { text-decoration:underline; text-decoration-thickness:2px; text-underline-offset:4px; }
.calendar-dishes { width:100%; white-space:nowrap; text-overflow:ellipsis; overflow:hidden; font-size:14px; color:var(--ink); }
.calendar-count { font-size:14px; color:inherit; }
.calendar-payment { display:flex; align-items:flex-start; gap:5px; font-size:14px; font-weight:700; line-height:1.4; margin-top:auto; }
.calendar-status-symbol { flex:none; font-size:16px; line-height:1.2; }
.calendar-state-label { overflow-wrap:anywhere; }
.calendar-legend { display:flex; align-items:center; flex-wrap:wrap; gap:12px 20px; margin:20px 0 0; font-size:14px; color:var(--ink-soft); }
.calendar-legend > span { display:inline-flex; align-items:center; gap:7px; }
.legend-swatch { display:inline-grid; place-items:center; width:24px; height:24px; border:1px solid; border-radius:6px; font-style:normal; font-weight:750; }
.legend-paid { background:var(--calendar-paid-bg); border-color:var(--calendar-paid-border); color:var(--calendar-paid-ink); }
.legend-unpaid { background:var(--calendar-unpaid-bg); border-color:var(--calendar-unpaid-border); color:var(--calendar-unpaid-ink); }
.legend-empty { background:var(--bg-tint); border-color:var(--line); color:var(--ink-soft); }
.calendar-hint { margin-top:12px; }
.history-detail-grid { display:grid; grid-template-columns:minmax(0,1fr); gap:24px; margin-top:4px; align-items:start; }
.history-detail-grid > section { min-width:0; padding:24px; box-shadow:none; }
.history-detail-grid h2 { font-size:22px; font-weight:750; margin:0 0 8px; overflow-wrap:anywhere; }
.history-detail-grid :deep(.order-card), .history-day :deep(.order-card) { padding:0; border:0; border-radius:0; box-shadow:none; background:transparent; }
.history-detail-grid :deep(.order-card + .order-card), .history-day :deep(.order-card + .order-card) { padding-top:20px; border-top:1px solid var(--line); }
.history-unpaid-entry { padding:16px 0 0; border-top:1px solid var(--line); }
@media(max-width:900px) {
  .calendar-cell { min-height:112px; padding:8px; }
  .calendar-dishes { display:none; }
  .history-detail-grid { gap:20px; }
}
@media(max-width:640px) {
  .history-heading { display:block; }
  .history-heading > .btn { margin:0 0 4px; }
  .history-calendar { padding:14px 10px; }
  .history-month { gap:8px; margin-bottom:16px; flex-wrap:wrap; }
  .history-month h2 { font-size:20px; }
  .history-today { margin-left:auto; }
  .calendar-grid { gap:5px; }
  .calendar-cell { min-height:70px; align-items:center; padding:8px 2px; gap:6px; }
  .calendar-cell b { font-size:17px; }
  .calendar-count, .calendar-state-label { display:none; }
  .calendar-payment { margin-top:auto; }
  .calendar-status-symbol { font-size:17px; }
  .calendar-cell.active { outline-offset:1px; }
  .calendar-weekday { padding:6px 0; font-size:14px; }
  .calendar-legend { gap:10px 16px; margin-top:18px; }
  .history-detail-grid > section { padding:20px; }
}
</style>

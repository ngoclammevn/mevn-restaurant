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
<template><div class="stack">
  <PageHeader title="Lịch cơm" sub="Đơn đã đặt và những đánh giá của bạn." /><router-link class="taste-link" to="/taste">Khẩu vị của tôi →</router-link>
  <EmptyState v-if="!isSignedIn" title="Đăng nhập để xem lịch cơm"><AppButton @click="showSignIn = true">Đăng nhập</AppButton></EmptyState>
  <template v-else>
    <details class="card stack-sm"><summary>Đơn chưa trả · {{ unpaidOrders.length }}</summary><Spinner v-if="unpaidLoading" label="Đang tải đơn chưa trả…" /><p v-if="unpaidError" class="alert">{{ unpaidError }} <button type="button" @click="loadUnpaid">Thử lại</button></p><div v-for="order in unpaidOrders" :key="order.id" class="stack-sm"><p class="meta">{{ formatVNDate(order.menu.menu_date) }}</p><OrderCard :order="order" :menu="order.menu" @changed="orderChanged(order)" /></div><p v-if="!unpaidLoading && !unpaidError && !unpaidOrders.length" class="meta">Bạn đã thanh toán tất cả đơn cơm.</p></details>
    <div class="row-wrap"><AppButton variant="ghost" size="sm" aria-label="Tháng trước" @click="move(-1)">←</AppButton><h2 class="section-title">{{ monthTitle }}</h2><AppButton variant="ghost" size="sm" aria-label="Tháng sau" @click="move(1)">→</AppButton><AppButton variant="ghost" size="sm" @click="goToday">Hôm nay</AppButton><span class="badge badge--unpaid spacer">{{ unpaid }} đơn chưa trả trong khoảng đang xem</span></div>
    <p v-if="error" class="alert">{{ error }} <button type="button" @click="load">Thử lại</button></p>
    <div class="calendar-layout"><section class="card calendar" :aria-busy="loading"><div class="calendar-grid"><span v-for="label in ['T2','T3','T4','T5','T6','T7','CN']" :key="label" class="calendar-weekday">{{ label }}</span><button v-for="date in days" :key="date" type="button" class="calendar-cell" :class="{ outside: !date.startsWith(month), active: selected === date, today: date === today }" :aria-label="`${formatVNDate(date)}, ${(grouped[date] ?? []).length} đơn`" :aria-pressed="selected === date" @click="selected = date"><span>{{ Number(date.slice(-2)) }}</span><span v-if="grouped[date]?.length" class="calendar-count">{{ grouped[date].length }}<span class="calendar-desktop"> đơn</span></span><span v-if="grouped[date]?.length" class="calendar-dishes calendar-desktop">{{ grouped[date].map(order => order.item_text).join(', ') }}</span><span v-if="grouped[date]?.some(o => !o.is_paid)" class="unpaid-dot" aria-label="Có đơn chưa trả" /></button></div><p class="meta calendar-legend"><span class="unpaid-dot" /> Chưa trả · Chọn một ngày để xem tất cả đơn</p></section>
      <section class="stack-sm day-panel"><h2 class="section-title">{{ formatVNDate(selected) }}</h2><Spinner v-if="loading" label="Đang tải đơn…" /><template v-if="selectedOrders.length || (!loading && !error)"><OrderCard v-for="order in selectedOrders" :key="order.id" :order="order" :menu="order.menu" @changed="orderChanged(order)" /><EmptyState v-if="!loading && !error && !selectedOrders.length" title="Chưa có đơn vào ngày này" description="Đơn đặt hộ bạn cũng sẽ xuất hiện ở đây." /></template></section>
    </div>
  </template><SignInModal v-if="showSignIn" @close="showSignIn = false" />
</div></template>

<style scoped>
.taste-link { align-self:flex-start; display:inline-flex; align-items:center; min-height:44px; color:var(--ink); }.calendar-dishes { overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; font-size:var(--fs-xs); text-align:left; overflow-wrap:anywhere; width:100%; }.calendar-cell { min-height:100px; }.calendar-cell.active { background:var(--card); outline:2px solid var(--primary); outline-offset:-2px; }.calendar-count { color:var(--ink-soft); }@media(max-width:600px) { .calendar-dishes { display:none; }.calendar-cell { min-height:64px; } }
</style>

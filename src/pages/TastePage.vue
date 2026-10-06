<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useUser } from '@clerk/vue'
import { useOrders } from '../composables/useOrders'
import { todayInVN, formatVNDate } from '../lib/date'
import { summarizeTaste } from '../lib/taste-summary'
import { reviewForItem } from '../lib/menu'
import TasteSummaryChart from '../components/TasteSummaryChart.vue'
import { AppButton, PageHeader, Spinner, EmptyState, SignInModal } from '../components/ui'
const { user, isSignedIn } = useUser(), { listMyOrders } = useOrders()
const to = todayInVN(), start = new Date(`${to}T12:00:00Z`)
start.setUTCDate(start.getUTCDate() - 89)
const range = { from: start.toISOString().slice(0, 10), to }
const orders = ref([]), loading = ref(false), error = ref(''), complete = ref(false), total = ref(null), showSignIn = ref(false)
const chartMode = ref('liked'), labelsExpanded = ref(false)
let generation = 0
watch(() => user.value?.id, load, { immediate: true })
onUnmounted(() => { generation++ })
async function load() {
  const current = ++generation, uid = user.value?.id
  orders.value = []; error.value = ''; complete.value = false; total.value = null
  if (!uid) { loading.value = false; return }
  loading.value = true
  try {
    for (let offset = 0; ; offset += 100) {
      const result = await listMyOrders({ ...range, offset, limit: 100 })
      if (current !== generation || user.value?.id !== uid) return
      if (result.error) throw result.error
      const page = result.data ?? []
      total.value = result.count ?? total.value
      const ids = new Set(orders.value.map(order => order.id))
      orders.value.push(...page.filter(order => !ids.has(order.id)))
      if (page.length < 100 || (result.count != null && offset + page.length >= result.count)) { complete.value = true; break }
    }
  } catch { if (current === generation) error.value = 'Chưa tải đủ lịch cơm. Thử lại để xem đầy đủ.' }
  finally { if (current === generation) loading.value = false }
}
const summary = computed(() => summarizeTaste(orders.value, range))
const hasUnreviewed = computed(() => orders.value.some(order => order.order_items?.some(item => !reviewForItem(item))))
const dishBars = (dishes, liked = false) => dishes.map(dish => ({ key: dish.key, label: dish.dishName, context: dish.restaurantName || 'Chưa ghi nhận quán', value: liked ? Number(dish.averageRating.toFixed(1)) : dish.orderCount, detail: liked ? `${Number(dish.averageRating.toFixed(1)).toLocaleString('vi-VN')} / 5 · ${dish.reviewCount} đánh giá` : `${dish.orderCount} lượt chọn`, to: dish.menuId ? `/menu/${dish.menuId}` : null }))
const frequent = computed(() => dishBars(summary.value.frequentDishes))
const liked = computed(() => dishBars(summary.value.likedDishes, true))
const labels = computed(() => summary.value.commonLabels.map(item => ({ key: item.label, label: item.label, value: item.count, detail: `${item.count} đánh giá có cảm nhận này` })))
</script>
<template><div class="stack taste-page">
  <PageHeader eyebrow="Riêng cho bạn · 90 ngày gần đây" title="Khẩu vị của bạn" sub="Theo đánh giá và lịch đặt món của bạn." />
  <EmptyState v-if="!isSignedIn" title="Đăng nhập để xem khẩu vị"><AppButton @click="showSignIn = true">Đăng nhập</AppButton></EmptyState>
  <template v-else>
    <Spinner v-if="loading" label="Đang tải lịch cơm…" /><p v-if="error" class="alert" role="alert">{{ error }} <AppButton variant="ghost" @click="load">Thử lại</AppButton></p>
    <section v-if="complete || orders.length" class="card taste-summary"><span class="eyebrow">Tổng hợp</span><h2>{{ summary.orderCount }} đơn cơm{{ !complete ? ' đã tải' : '' }} · {{ summary.reviewCount }} đánh giá</h2><p>{{ summary.reviewedDayCount }} ngày có đánh giá. {{ summary.reviewedDayCount < 3 ? 'Dữ liệu còn ít.' : 'Thống kê từ những lần bạn tự chấm điểm.' }}</p><p v-if="!complete" class="meta">Thống kê tạm từ {{ orders.length }} đơn đã tải{{ total != null ? ` trên ${total}` : '' }}.</p><p class="meta">{{ formatVNDate(range.from) }} – {{ formatVNDate(range.to) }}</p></section>
    <EmptyState v-if="complete && !orders.length" title="Chưa có bữa ăn" description="Đặt món để lưu lại những bữa trưa của bạn."><AppButton to="/">Xem menu</AppButton></EmptyState>
    <template v-if="orders.length">
      <div class="taste-grid">
        <TasteSummaryChart title="Món ăn" :items="chartMode === 'liked' ? liked : frequent" :empty-text="chartMode === 'liked' ? 'Chưa có món được bạn chấm từ 4 sao.' : 'Chưa có món được ghi nhận.'">
          <div class="taste-tabs" role="group" aria-label="Loại biểu đồ"><button type="button" :aria-pressed="chartMode === 'liked'" @click="chartMode = 'liked'">Món đánh giá tốt</button><button type="button" :aria-pressed="chartMode === 'frequent'" @click="chartMode = 'frequent'">Món hay đặt</button></div>
          <p class="meta taste-description" role="status">{{ chartMode === 'liked' ? 'Điểm bạn tự đánh giá; số lần đặt không thể hiện mức yêu thích.' : 'Số lượt đã chọn món này; tách riêng khỏi điểm đánh giá.' }}</p>
          <template #footer><details class="taste-explainer"><summary>Dữ liệu này được hiểu thế nào?</summary><p class="meta">Mỗi món gắn riêng với một quán. Điểm đến từ đánh giá bạn đã lưu, lượt chọn đến từ đơn của bạn. Một vài đánh giá chưa đủ để kết luận khẩu vị lâu dài.</p></details></template>
        </TasteSummaryChart>
        <section class="card taste-feelings"><h2>Những cảm nhận thường gặp</h2><p class="meta">Các ý bạn đã tự chọn khi đánh giá.</p><div class="taste-tags"><span v-for="item in (labelsExpanded ? labels : labels.slice(0,5))" :key="item.key">{{ item.label }} · {{ item.value }} lần</span></div><p v-if="!labels.length" class="meta">Chưa có cảm nhận được lưu.</p><AppButton v-if="labels.length > 5" variant="ghost" @click="labelsExpanded = !labelsExpanded">{{ labelsExpanded ? 'Thu gọn' : `Xem tất cả (${labels.length})` }}</AppButton><div class="taste-rule"><span class="eyebrow">Đánh giá của bạn</span><h3>{{ summary.reviewCount ? `${summary.reviewCount} đánh giá đã lưu` : 'Chưa có đánh giá' }}</h3><p class="meta">{{ summary.reviewedDayCount < 3 ? 'Số mẫu còn ít. Điểm chỉ phản ánh những lần bạn đã chấm.' : `Những cảm nhận này được ghi từ ${summary.reviewedDayCount} ngày có đánh giá.` }}</p><AppButton variant="ghost" to="/history">Xem lịch cơm →</AppButton></div></section>
      </div>
      <section v-if="hasUnreviewed" class="card taste-unreviewed"><h2>Bữa chưa đánh giá</h2><p>Đánh giá món đã ăn để bổ sung cảm nhận của bạn.</p><AppButton variant="ghost" to="/history">Đánh giá một bữa gần đây</AppButton></section>
    </template>
  </template><SignInModal v-if="showSignIn" @close="showSignIn = false" />
</div></template>
<style scoped>
.taste-summary { background:#f4f5f0; border-color:#d9decf; color:#48523e; }.taste-summary h2 { font-size:21px; margin:12px 0 8px; }.taste-summary p { margin:0 0 8px; }.taste-summary .meta { font-size:12px; }
.taste-grid { display:grid; grid-template-columns:1fr 1fr; gap:22px; align-items:start; margin-top:4px; }.taste-tabs { display:flex; gap:8px; margin:18px 0 24px; }.taste-tabs button { flex:1; min-height:44px; border:1px solid var(--line-strong); border-radius:11px; padding:9px 13px; background:var(--card); font-size:14px; cursor:pointer; }.taste-tabs button[aria-pressed=true] { background:#f1f3ec; border-color:#bbc4b0; color:#303c25; }.taste-description { font-size:12px; }.taste-explainer summary { font-size:14px; padding:10px 0; }.taste-explainer p { font-size:12px; }
.taste-feelings h2,.taste-unreviewed h2 { font-size:21px; margin:0 0 8px; }.taste-feelings > .meta { font-size:12px; }.taste-tags { display:flex; flex-wrap:wrap; gap:8px; margin:18px 0; }.taste-tags span { padding:8px 12px; border-radius:20px; font-size:14px; color:#58624f; background:#f2f3ef; }.taste-rule { border-top:1px solid var(--line); padding-top:20px; margin-top:20px; }.taste-rule h3 { margin:12px 0 8px; font-size:20px; }.taste-rule p { margin-bottom:16px; }.taste-unreviewed { margin-top:4px; }.taste-unreviewed p { margin-bottom:16px; }@media(max-width:640px) { .taste-grid { grid-template-columns:1fr; gap:18px; }.taste-tabs button { padding:9px 10px; } }
</style>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useUser } from '@clerk/vue'
import { useOrders } from '../composables/useOrders'
import { todayInVN, formatVNDate } from '../lib/date'
import { summarizeTaste } from '../lib/taste-summary'
import TasteSummaryChart from '../components/TasteSummaryChart.vue'
import { AppButton, PageHeader, Spinner, EmptyState, SignInModal } from '../components/ui'
const { user, isSignedIn } = useUser(), { listMyOrders } = useOrders()
const to = todayInVN(), start = new Date(`${to}T12:00:00Z`)
start.setUTCDate(start.getUTCDate() - 89)
const range = { from: start.toISOString().slice(0, 10), to }
const orders = ref([]), loading = ref(false), error = ref(''), complete = ref(false), total = ref(null), showSignIn = ref(false)
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
const dishBars = (dishes, liked = false) => dishes.map(dish => ({ key: dish.key, label: `${dish.dishName} · ${dish.restaurantName || 'Chưa ghi nhận quán'}`, value: liked ? Number(dish.averageRating.toFixed(1)) : dish.orderCount, detail: `${dish.orderCount} lượt chọn · ${dish.reviewCount} đánh giá${liked ? ' · Điểm trung bình /5' : ''}`, to: dish.menuId ? `/menu/${dish.menuId}` : null }))
const frequent = computed(() => dishBars(summary.value.frequentDishes))
const liked = computed(() => dishBars(summary.value.likedDishes, true))
const labels = computed(() => summary.value.commonLabels.map(item => ({ key: item.label, label: item.label, value: item.count, detail: `${item.count} đánh giá có cảm nhận này` })))
</script>
<template><div class="stack">
  <PageHeader title="Khẩu vị của tôi" sub="Món đã chọn và những đánh giá bạn đã lưu." />
  <div class="row-wrap"><AppButton to="/history" variant="ghost">Lịch cơm</AppButton><p class="meta">{{ formatVNDate(range.from) }} – {{ formatVNDate(range.to) }}</p></div>
  <EmptyState v-if="!isSignedIn" title="Đăng nhập để xem khẩu vị"><AppButton @click="showSignIn = true">Đăng nhập</AppButton></EmptyState>
  <template v-else>
    <Spinner v-if="loading" label="Đang tải lịch cơm…" />
    <p v-if="error" class="alert" role="alert">{{ error }} <AppButton variant="ghost" @click="load">Thử lại</AppButton></p>
    <p v-if="!complete && orders.length" class="meta">Thống kê tạm từ {{ orders.length }} đơn đã tải{{ total != null ? ` trên ${total}` : '' }} trong khoảng ngày này.</p>
    <div v-if="complete || orders.length" class="row-wrap"><span class="badge">{{ summary.orderCount }} đơn{{ !complete ? ' đã tải' : '' }}</span><span class="badge">{{ summary.reviewCount }} đánh giá</span><span class="badge">{{ summary.reviewedDayCount }} ngày có đánh giá</span></div>
    <EmptyState v-if="complete && !orders.length" title="Chưa có bữa ăn" description="Đặt món để lưu lại những bữa trưa của bạn."><AppButton to="/">Xem menu</AppButton></EmptyState>
    <template v-if="orders.length">
      <p v-if="!summary.reviewCount" class="meta">Bạn chưa lưu đánh giá. <router-link to="/history">Mở lịch cơm để đánh giá món đã ăn.</router-link></p>
      <p v-else class="meta">{{ summary.reviewedDayCount < 3 ? 'Số đánh giá còn ít. Điểm dưới đây chỉ phản ánh những lần bạn đã chấm.' : `Thống kê từ ${summary.reviewCount} đánh giá trong ${summary.reviewedDayCount} ngày. Lượt chọn thường xuyên không đồng nghĩa với món bạn thích.` }}</p>
      <div class="taste-grid"><TasteSummaryChart title="Món thường chọn" :items="frequent" empty-text="Chưa có món được ghi nhận." /><TasteSummaryChart title="Món đánh giá tốt" :items="liked" empty-text="Chưa có món được bạn chấm từ 4 sao." /><TasteSummaryChart title="Cảm nhận thường chọn" :items="labels" empty-text="Chưa có cảm nhận được lưu." /></div>
    </template>
  </template><SignInModal v-if="showSignIn" @close="showSignIn = false" />
</div></template>
<style scoped>.taste-grid { display:grid; gap:1rem; grid-template-columns:repeat(2,minmax(0,1fr)); }.taste-grid > :last-child { grid-column:1/-1; }@media(max-width:700px) { .taste-grid { grid-template-columns:1fr; } }</style>

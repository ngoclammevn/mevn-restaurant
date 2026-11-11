<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useUser } from '@clerk/vue'
import { useAppPresence } from '../composables/useAppPresence'
import { useMenus } from '../composables/useMenus'
import { todayInVN } from '../lib/date'
import { menuDishes } from '../lib/menu'
import { getMascotEggEvent, getMascotSeasonTheme, hasUnlockedMascotEgg, MASCOT_EGG_UNLOCKED_EVENT } from '../lib/mascot-events'
import { useMascotEggUnlockPulse } from '../composables/useMascotEggUnlockPulse'
import { AppButton, Spinner, EmptyState, SignInModal } from '../components/ui'
import AsciiSkeleton from '../components/ui/AsciiSkeleton.vue'
import Avatar from '../components/ui/Avatar.vue'
import GlassSelect from '../components/ui/liquid/GlassSelect.vue'
const { user, isSignedIn } = useUser()
const { listMenusByDate } = useMenus()
const menus = ref([]), loading = ref(false), error = ref(''), showSignIn = ref(false)
const today = todayInVN()
const seasonalPreviewOptions = [
  { value:'current', label:'Theo ngày hiện tại' },
  { value:'lunch', label:'Ngày thường' },
  { value:'halloween', label:'Halloween' },
  { value:'hanoi-autumn', label:'Lá mùa thu Hà Nội' },
  { value:'teachers-day', label:'Ngày Nhà giáo Việt Nam · 20/11' },
  { value:'vietnam-culture-day', label:'Ngày Văn hóa Việt Nam' },
  { value:'christmas', label:'Noel' },
  { value:'new-year', label:'Năm mới' },
  { value:'tet', label:'Tết' },
  { value:'womens-day', label:'Ngày Quốc tế Phụ nữ · 8/3' },
  { value:'hung-kings-day', label:'Giỗ Tổ Hùng Vương' },
  { value:'reunification-and-labour-day', label:'Ngày 30/4 – 1/5' },
  { value:'mid-autumn', label:'Trung thu' },
  { value:'national-day', label:'Quốc khánh · 2/9' },
]
const isSeasonPreviewEnabled = import.meta.env.DEV
const requestedSeason = isSeasonPreviewEnabled ? new URLSearchParams(window.location.search).get('season') : null
const seasonalPreview = ref(seasonalPreviewOptions.some(option => option.value === requestedSeason) ? requestedSeason : 'current')
const seasonalPreviewDates = {
  lunch:'2026-06-15',
  halloween:'2026-11-01',
  'hanoi-autumn':'2026-11-10',
  'teachers-day':'2026-11-20',
  'vietnam-culture-day':'2026-11-24',
  christmas:'2026-12-12',
  'new-year':'2026-12-31',
  tet:'2027-02-07',
  'womens-day':'2027-03-08',
  'hung-kings-day':'2027-04-18',
  'reunification-and-labour-day':'2027-05-01',
  'mid-autumn':'2027-09-15',
  'national-day':'2026-09-02',
}
const seasonalDate = computed(() => {
  const previewDate = seasonalPreview.value === 'current' ? null : seasonalPreviewDates[seasonalPreview.value]
  return previewDate ? new Date(`${previewDate}T12:00:00+07:00`) : new Date()
})
const seasonalEvent = computed(() => getMascotEggEvent(seasonalDate.value))
const seasonalUnlocked = ref(false)
const showSeasonalTheme = computed(() => seasonalUnlocked.value || (isSeasonPreviewEnabled && seasonalPreview.value !== 'current'))
const seasonalTheme = computed(() => showSeasonalTheme.value ? getMascotSeasonTheme(seasonalDate.value) : { eventId:'lunch', accent:'#397653', surface:'#eff6f0' })
function syncSeasonalUnlock() { seasonalUnlocked.value = hasUnlockedMascotEgg(seasonalEvent.value.eventKey) }
watch(() => seasonalEvent.value.eventKey, syncSeasonalUnlock, { immediate:true })
onMounted(() => {
  window.addEventListener(MASCOT_EGG_UNLOCKED_EVENT, syncSeasonalUnlock)
  window.addEventListener('storage', syncSeasonalUnlock)
})
onUnmounted(() => {
  window.removeEventListener(MASCOT_EGG_UNLOCKED_EVENT, syncSeasonalUnlock)
  window.removeEventListener('storage', syncSeasonalUnlock)
})
const seasonalStyle = computed(() => ({ '--season-accent': seasonalTheme.value.accent, '--season-surface': seasonalTheme.value.surface }))
const seasonalUnlockPulse = useMascotEggUnlockPulse()
watch(seasonalPreview, value => {
  if (!isSeasonPreviewEnabled) return
  const url = new URL(window.location.href)
  if (value === 'current') url.searchParams.delete('season')
  else url.searchParams.set('season', value)
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
})
const presence = useAppPresence()
const weekdayLabel = new Intl.DateTimeFormat('vi-VN', { weekday:'long', timeZone:'Asia/Ho_Chi_Minh' }).format(new Date(`${today}T12:00:00+07:00`))
const dateLabel = `${weekdayLabel[0].toUpperCase()}${weekdayLabel.slice(1)} · ${Number(today.slice(8))} tháng ${Number(today.slice(5,7))}`
const orderedPeople = menu => new Set((menu.orders || []).map(o => o.user_id)).size
const firstOpenMenu = computed(() => menus.value.find(menu => !menu.is_closed && !(menu.orders || []).some(o => o.user_id === user.value?.id))?.id)
let generation = 0, refreshTimer
async function load() {
  const current = ++generation; error.value = ''
  if (!isSignedIn.value) { loading.value = false; return }
  loading.value = true
  try {
    const result = await listMenusByDate(today)
    if (current !== generation) return
    if (result.error) throw result.error
    menus.value = result.data ?? []
  } catch { if (current === generation) error.value = 'Chưa tải được menu. Kiểm tra kết nối rồi thử lại.' }
  finally { if (current === generation) loading.value = false }
}
watch(() => user.value?.id, () => { menus.value = []; clearTimeout(refreshTimer); load() }, { immediate: true })
function queueRefresh() { clearTimeout(refreshTimer); refreshTimer = setTimeout(load, 250) }
const unsubscribe = presence.onOrderChanged(queueRefresh)
onUnmounted(() => { generation++; clearTimeout(refreshTimer); unsubscribe() })
function preview(menu) {
  const dishes = menuDishes(menu)
  if (dishes.length) return dishes.slice(0, 3).map(d => d.name).join(', ') + (dishes.length > 3 ? '…' : '')
  return (menu.note ?? '').slice(0, 120) || 'Xem ảnh và chọn món trong menu'
}
function hasOwnOrder(menu) { return (menu.orders ?? []).some(order => order.user_id === user.value?.id) }
function menuMetadata(menu) {
  const dishes = menuDishes(menu), parts = [`${menu.poster?.full_name || 'Thành viên'} đăng`]
  if (dishes.length) parts.push(`${dishes.length} món`)
  if (dishes.length && dishes.every(d => d.price != null && d.price !== '' && Number.isFinite(Number(d.price)))) parts.push(`từ ${Math.min(...dishes.map(d => Number(d.price))).toLocaleString('vi-VN')}đ`)
  return parts.join(' · ')
}
function activity(menu) {
  const viewer = presence.viewers.value.find(v => v.userId !== user.value?.id && v.menuId === menu.id && v.picks?.length)
  if (viewer) return { profile:viewer.avatar, name: viewer.name, text: 'đang chọn', dish: viewer.picks[0] }
  const order = (menu.orders || []).find(o => o.user_id !== user.value?.id) || menu.orders?.[0]
  if (order) return { profile:order.user, name: order.user?.full_name || 'Thành viên', text: 'đã đặt', dish: order.item_text.split('\n')[0] }
  return null
}
</script>
<template><div class="today-page" :data-seasonal-event="seasonalTheme.eventId" :style="seasonalStyle" :class="{ 'today-page--seasonal-unlock': seasonalUnlockPulse }">
  <span class="eyebrow today-date">{{ dateLabel }}</span>
  <aside v-if="isSeasonPreviewEnabled" class="season-preview" aria-label="Xem thử giao diện theo mùa"><div class="season-preview__intro"><strong>Xem thử giao diện theo mùa</strong><span class="meta">Chỉ hiện khi chạy local</span></div><GlassSelect label="Mùa hoặc dịp lễ" v-model="seasonalPreview" :options="seasonalPreviewOptions" /></aside>
  <EmptyState v-if="!isSignedIn" title="Xem menu hôm nay" description="Đăng nhập để xem menu và đơn cơm của bạn."><AppButton @click="showSignIn = true">Đăng nhập</AppButton></EmptyState>
  <div v-else-if="loading && !menus.length" class="today-menu-grid"><AsciiSkeleton v-for="index in 2" :key="index" kind="menu-card" label="Đang tải menu hôm nay…" /></div>
  <div v-else-if="error && !menus.length" class="stack-sm"><p class="alert">{{ error }}</p><AppButton variant="ghost" @click="load">Thử lại</AppButton></div>
  <template v-else>
    <p v-if="loading" class="meta" role="status">Đang cập nhật…</p><div v-if="error" class="row-wrap"><p class="alert" role="alert">{{ error }}</p><AppButton variant="ghost" @click="load">Thử lại</AppButton></div>
    <section id="today-menus"><h1 class="today-section-heading">Menu hôm nay</h1>
      <EmptyState v-if="!menus.length" title="Chưa có menu hôm nay" description="Đăng menu đầu tiên để mọi người chọn bữa trưa."><AppButton to="/post">Đăng menu</AppButton></EmptyState>
      <div v-else class="today-menu-grid"><article v-for="menu in menus" :key="menu.id" class="card today-menu-card"><div class="today-menu-status"><span class="badge" :class="{ 'today-menu-closed': menu.is_closed }">{{ menu.is_closed ? 'Đã chốt đơn' : 'Đang nhận đơn' }}</span><span v-if="hasOwnOrder(menu)" class="today-own-order">Bạn đã đặt</span></div><RouterLink v-if="menu.image_url" :to="`/menu/${menu.id}`" class="today-menu-image"><img :src="menu.image_url" :alt="`Ảnh menu ${menu.restaurant?.name || menu.title}`" loading="lazy" /></RouterLink><div class="today-menu-title"><h3>{{ menu.restaurant?.name || menu.title }}</h3><span class="meta">{{ orderedPeople(menu) ? `${orderedPeople(menu)} người đặt` : 'Chưa có ai đặt' }}</span></div><p class="today-menu-meta">{{ menuMetadata(menu) }}</p><p class="today-menu-preview">{{ preview(menu) }}</p><div v-if="activity(menu)" class="today-menu-activity"><template v-for="entry in activity(menu) ? [activity(menu)] : []" :key="entry.name"><Avatar :profile="entry.profile" :name="entry.name" :size="34" /><p>{{ entry.name }} {{ entry.text }} <strong>{{ entry.dish }}</strong></p></template></div><AppButton block :variant="menu.id === firstOpenMenu && !hasOwnOrder(menu) ? 'primary' : 'ghost'" :to="`/menu/${menu.id}`">{{ hasOwnOrder(menu) ? 'Xem menu & đơn của bạn' : menu.is_closed ? 'Xem menu' : 'Xem menu & chọn món' }} <span aria-hidden="true">→</span></AppButton></article></div>
    </section>
  </template><SignInModal v-if="showSignIn" @close="showSignIn = false" />
</div></template>
<style scoped>
.today-page { min-width:0; }
.today-date { display:block; margin-bottom:8px; }
.today-page .meta { font-size:14px; color:var(--ink-soft); }
.season-preview { display:grid; grid-template-columns:minmax(180px,1fr) minmax(240px,320px); align-items:end; gap:12px 24px; margin:0 0 20px; padding:14px 16px; border:1px dashed var(--line-strong); border-radius:16px; background:var(--card); }
.season-preview__intro { display:grid; gap:2px; align-self:center; }
.season-preview__intro strong { font-size:15px; }
.season-preview__intro .meta { font-size:13px; }
#today-menus { scroll-margin-top:96px; }
.today-section-heading { font-size:24px; font-weight:750; margin:0 0 16px; }
.today-menu-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:20px; }
.today-menu-card { border-radius:24px; padding:24px; display:flex; flex-direction:column; min-width:0; box-shadow:none; }
.today-menu-status { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px 12px; }
.today-menu-status .badge { font-size:14px; font-weight:700; padding:5px 10px; color:var(--primary-ink); background:var(--primary-soft); }
.today-menu-status .today-menu-closed { color:var(--ink-soft); background:var(--bg-tint); }
.today-own-order { font-size:14px; font-weight:700; color:var(--primary-ink); }
.today-menu-image { display:block; margin-top:18px; border:1px solid var(--line); border-radius:12px; overflow:hidden; background:var(--bg-tint); }
.today-menu-image img { width:100%; height:200px; object-fit:contain; }
.today-menu-title { display:flex; align-items:baseline; justify-content:space-between; gap:12px; margin:18px 0 6px; }.today-menu-title .meta { flex:none; }
.today-menu-card h3 { font-size:24px; font-weight:750; line-height:1.35; margin:0; min-width:0; overflow-wrap:anywhere; }
.today-menu-meta { font-size:14px; font-weight:600; line-height:1.6; color:var(--ink-soft); margin:4px 0; overflow-wrap:anywhere; }
.today-menu-preview { font-size:16px; line-height:1.65; color:var(--ink); margin:8px 0 0; overflow-wrap:anywhere; }
.today-menu-activity { border-top:1px solid var(--line); margin:20px 0 18px; padding-top:16px; display:flex; align-items:center; gap:10px; min-height:51px; }
.today-menu-activity p { min-width:0; margin:0; font-size:14px; color:var(--ink-soft); overflow-wrap:anywhere; }
.today-menu-activity strong { font-weight:700; color:var(--ink); }
.today-menu-card :deep(.btn) { margin-top:auto; min-height:48px; font-size:16px; }
@media(max-width:700px) {
  .season-preview { grid-template-columns:1fr; gap:10px; margin-bottom:16px; padding:12px 14px; }
  .today-menu-grid { grid-template-columns:1fr; gap:16px; }
  .today-menu-card { padding:20px; }
  .today-menu-card h3 { font-size:22px; }
  .today-menu-image img { height:180px; }
}
</style>

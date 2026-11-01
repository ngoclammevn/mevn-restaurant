<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useUser } from '@clerk/vue'
import { useAppPresence } from '../composables/useAppPresence'
import { useMenus } from '../composables/useMenus'
import { todayInVN } from '../lib/date'
import { menuDishes } from '../lib/menu'
import { getMascotEggEvent, getMascotSeasonTheme } from '../lib/mascot-events'
import { useMascotEggUnlockPulse } from '../composables/useMascotEggUnlockPulse'
import { AppButton, PageHeader, Spinner, EmptyState, SignInModal } from '../components/ui'
import OrderCard from '../components/OrderCard.vue'
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
const seasonalTheme = computed(() => getMascotSeasonTheme(seasonalDate.value))
const seasonalStyle = computed(() => ({ '--season-accent': seasonalTheme.value.accent, '--season-surface': seasonalTheme.value.surface }))
const seasonalDecorations = computed(() => {
  const slots = [
    { left:7, top:13 }, { left:15, top:76 }, { left:25, top:94 }, { left:35, top:18 },
    { left:44, top:83 }, { left:55, top:9 }, { left:63, top:61 }, { left:70, top:92 },
    { left:79, top:15 }, { left:86, top:48 }, { left:94, top:81 }, { left:96, top:32 },
    { left:30, top:57 }, { left:51, top:45 }, { left:11, top:38 }, { left:69, top:28 },
  ]
  const shuffledSlots = [...slots]
  for (let index = shuffledSlots.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffledSlots[index], shuffledSlots[swapIndex]] = [shuffledSlots[swapIndex], shuffledSlots[index]]
  }
  const particles = seasonalEvent.value.particles || ['✨']
  return shuffledSlots.slice(0, 14).map((slot, index) => {
    return {
      id:`${seasonalEvent.value.eventKey}-${index}`,
      icon:particles[index % particles.length],
      left:`${slot.left + Math.round((Math.random() - .5) * 8)}%`,
      top:`${slot.top + Math.round((Math.random() - .5) * 12)}%`,
      scale:(.82 + Math.random() * .48).toFixed(2),
      rotation:`${Math.round((Math.random() - .5) * 36)}deg`,
    }
  })
})
const seasonalFrameDecorations = computed(() => ({
  halloween:['🦇','🎃','🕸️','🕷️','🦇'],
  christmas:['🔔','🎁'],
  tet:['🌸','🧧','🌼','🧧','🌸'],
}[seasonalTheme.value.eventId] || []).slice(0,3).map((icon,index) => {
  const t = seasonalTheme.value.eventId === 'christmas' ? [.16,.84][index] : [.08,.5,.92][index]
  // Cùng tọa độ với đường Bézier của dây, kể cả khi chiều rộng thay đổi.
  return { icon, left:`${t * 100}%`, top:`${(1 + 60 * t * (1 - t)) / 30 * 100}%` }
}))
const seasonalUnlockPulse = useMascotEggUnlockPulse()
watch(seasonalPreview, value => {
  if (!isSeasonPreviewEnabled) return
  const url = new URL(window.location.href)
  if (value === 'current') url.searchParams.delete('season')
  else url.searchParams.set('season', value)
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
})
const presence = useAppPresence()
const myOrders = computed(() => menus.value.flatMap(menu => (menu.orders ?? []).filter(order => order.user_id === user.value?.id).map(order => ({ menu, order }))))
const weekdayLabel = new Intl.DateTimeFormat('vi-VN', { weekday:'long', timeZone:'Asia/Ho_Chi_Minh' }).format(new Date(`${today}T12:00:00+07:00`))
const dateLabel = `${weekdayLabel[0].toUpperCase()}${weekdayLabel.slice(1)} · ${Number(today.slice(8))} tháng ${Number(today.slice(5,7))}`
const orderedPeople = computed(() => new Set(menus.value.flatMap(menu => (menu.orders || []).map(o => o.user_id))).size)
const firstOpenMenu = computed(() => menus.value.find(menu => !menu.is_closed && !(menu.orders || []).some(o => o.user_id === user.value?.id))?.id)
const openMenus = computed(() => menus.value.filter(menu => !menu.is_closed).length)
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
function showMenus() { document.getElementById('today-menus')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }) }
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
  <PageHeader :eyebrow="dateLabel" title="Trưa nay, ăn gì?" :sub="isSignedIn ? `${openMenus} menu đang nhận đặt món. Chọn bữa trưa của bạn.` : 'Đăng nhập để chọn bữa trưa của bạn.'" />
  <aside v-if="isSeasonPreviewEnabled" class="season-preview" aria-label="Xem thử giao diện theo mùa"><div class="season-preview__intro"><strong>Xem thử giao diện theo mùa</strong><span class="meta">Chỉ hiện khi chạy local</span></div><GlassSelect label="Mùa hoặc dịp lễ" v-model="seasonalPreview" :options="seasonalPreviewOptions" /></aside>
  <EmptyState v-if="!isSignedIn" title="Xem menu hôm nay" description="Đăng nhập để xem menu và đơn cơm của bạn."><AppButton @click="showSignIn = true">Đăng nhập</AppButton></EmptyState>
  <div v-else-if="loading && !menus.length" class="today-menu-grid"><AsciiSkeleton v-for="index in 2" :key="index" kind="menu-card" label="Đang tải menu hôm nay…" /></div>
  <div v-else-if="error && !menus.length" class="stack-sm"><p class="alert">{{ error }}</p><AppButton variant="ghost" @click="load">Thử lại</AppButton></div>
  <template v-else>
    <p v-if="loading" class="meta" role="status">Đang cập nhật…</p><div v-if="error" class="row-wrap"><p class="alert" role="alert">{{ error }}</p><AppButton variant="ghost" @click="load">Thử lại</AppButton></div>
    <section class="card today-personal" :class="{ 'today-personal--seasonal-unlock': seasonalUnlockPulse, 'today-personal--seasonal-frame': seasonalFrameDecorations.length }" aria-labelledby="personal-lunch-title">
      <div class="today-personal-decoration" aria-hidden="true"><span v-for="decoration in seasonalDecorations" :key="decoration.id" :style="{ left:decoration.left, top:decoration.top, transform:`translate(-50%, -50%) rotate(${decoration.rotation}) scale(${decoration.scale})` }">{{ decoration.icon }}</span></div>
      <div v-if="seasonalFrameDecorations.length" class="today-seasonal-frame" :class="`today-seasonal-frame--${seasonalTheme.eventId}`" aria-hidden="true">
        <span class="today-seasonal-frame__garland">
          <svg viewBox="0 0 100 30" preserveAspectRatio="none"><path d="M0 1 Q50 31 100 1" /></svg>
          <i v-if="seasonalTheme.eventId==='christmas'" v-for="light in 7" :key="light" :style="{ left:`${5 + (light - 1) * 15}%`, top:`${(1 + 60 * (.05 + (light - 1) * .15) * (1 - .05 - (light - 1) * .15)) / 30 * 100}%` }"></i>
          <span v-for="(decoration,index) in seasonalFrameDecorations" :key="`${seasonalTheme.eventId}-${index}`" class="today-seasonal-frame__hanger" :style="{ left:decoration.left, top:decoration.top, animationDelay:`${-.5-index*.8}s` }"><i></i><b>{{ decoration.icon }}</b></span>
        </span>
        <span v-if="seasonalTheme.eventId==='christmas'" class="today-seasonal-frame__bow"><i></i><i></i><b></b></span>
      </div>
      <div class="today-personal-content">
        <h2 id="personal-lunch-title" class="today-personal-heading">Bữa trưa của bạn</h2>
        <template v-if="myOrders.length"><OrderCard v-for="entry in myOrders" :key="entry.order.id" :order="entry.order" :menu="entry.menu" compact @changed="queueRefresh" /></template>
        <div v-else class="today-personal-empty"><div><p><strong>Bạn chưa đặt món hôm nay</strong></p><p class="meta">{{ openMenus ? 'Chọn một menu bên dưới để bắt đầu.' : 'Menu mới sẽ xuất hiện ở đây.' }}</p></div><AppButton v-if="openMenus" variant="ghost" @click="showMenus">Xem menu <span aria-hidden="true">→</span></AppButton></div>
      </div>
      <div class="today-personal-art" aria-hidden="true">
        <svg class="today-chef-illustration" viewBox="0 0 300 240" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g stroke="#536a4c" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
            <path fill="#e7b96f" stroke="none" d="M46 228c-21-36-6-79 41-92 39-12 104-3 144 32 22 20 35 41 26 60Z" />
            <path fill="#fffdf5" d="M118 78c-38 2-48-38-20-48 0-28 38-31 48-9 24-20 49 1 40 23 23 16 12 44-14 40l-6 23-47-1Z" />
            <path fill="#efceaa" d="M124 88v26c0 20 33 30 44 7l5-29" />
            <path d="m136 103 2 1m17-1 2-1m-20 15c6 4 11 3 15-1" />
            <path fill="#fffdf5" d="m111 137 24-9 13 18 14-17 24 9 18 77-108-2Z" />
            <path d="m148 146-2 59m14-42h1m-1 20h1m-47-42-26 31 44 13m55-42 20 24 26-18" />
            <path fill="#efceaa" d="m130 181 13 2-3 9-15-4m107-40 13-10 4 8-13 12" />
            <path d="M55 213h205m-94-19h71l-8 18h-55Z" />
            <path d="m236 195 31-13m-62 0c-12-11 6-16 0-29m-17 27c-8-10 7-17 1-25" />
            <path class="today-chef-steam" d="M180 170c-9-10 8-15 1-25m17 25c-9-10 8-15 1-25m17 25c-9-10 8-15 1-25" />
            <path stroke="#b9693b" d="m58 103 11-7m-8 24 11 2m162-43 7-8m4 25 10-1" />
          </g>
        </svg>
      </div>
    </section>
    <section id="today-menus"><div class="today-section-heading"><h2>Menu hôm nay</h2><span class="meta">{{ orderedPeople ? `Đã có ${orderedPeople} người đặt` : 'Chưa có ai đặt' }}</span></div>
      <EmptyState v-if="!menus.length" title="Chưa có menu hôm nay" description="Đăng menu đầu tiên để mọi người chọn bữa trưa."><AppButton to="/post">Đăng menu</AppButton></EmptyState>
      <div v-else class="today-menu-grid"><article v-for="menu in menus" :key="menu.id" class="card today-menu-card"><div class="today-menu-status"><span class="badge" :class="{ 'today-menu-closed': menu.is_closed }">{{ menu.is_closed ? 'Đã chốt đơn' : 'Đang nhận đơn' }}</span><span v-if="hasOwnOrder(menu)" class="today-own-order">Bạn đã đặt</span></div><RouterLink v-if="menu.image_url" :to="`/menu/${menu.id}`" class="today-menu-image"><img :src="menu.image_url" :alt="`Ảnh menu ${menu.restaurant?.name || menu.title}`" loading="lazy" /></RouterLink><h3>{{ menu.restaurant?.name || menu.title }}</h3><p class="today-menu-meta">{{ menuMetadata(menu) }}</p><p class="today-menu-preview">{{ preview(menu) }}</p><div class="today-menu-activity"><template v-for="entry in activity(menu) ? [activity(menu)] : []" :key="entry.name"><Avatar :profile="entry.profile" :name="entry.name" :size="34" /><p>{{ entry.name }} {{ entry.text }} <strong>{{ entry.dish }}</strong></p></template><p v-if="!activity(menu)" class="meta">Chưa có đơn · {{ menu.is_closed ? 'Menu đã chốt' : 'Bạn có thể chọn món trước' }}</p></div><AppButton block :variant="menu.id === firstOpenMenu && !hasOwnOrder(menu) ? 'primary' : 'ghost'" :to="`/menu/${menu.id}`">{{ hasOwnOrder(menu) ? 'Xem menu & đơn của bạn' : menu.is_closed ? 'Xem menu' : 'Xem menu & chọn món' }} <span aria-hidden="true">→</span></AppButton></article></div>
    </section>
  </template><SignInModal v-if="showSignIn" @close="showSignIn = false" />
</div></template>
<style scoped>
.today-page { min-width:0; }
.today-page :deep(.page-header) { margin-bottom:24px; }
.today-page .meta { font-size:14px; color:var(--ink-soft); }
.season-preview { display:grid; grid-template-columns:minmax(180px,1fr) minmax(240px,320px); align-items:end; gap:12px 24px; margin:0 0 20px; padding:14px 16px; border:1px dashed var(--line-strong); border-radius:16px; background:var(--card); }
.season-preview__intro { display:grid; gap:2px; align-self:center; }
.season-preview__intro strong { font-size:15px; }
.season-preview__intro .meta { font-size:13px; }
.today-personal { position:relative; isolation:isolate; display:grid; grid-template-columns:minmax(0,1fr) 190px; align-items:center; gap:24px; margin:24px 0 32px; padding:24px; overflow:visible; border:1px solid color-mix(in srgb,var(--season-accent) 15%,var(--line)); border-radius:var(--radius-lg,24px); background:radial-gradient(ellipse at 91% 50%,color-mix(in srgb,var(--season-accent) 10%,transparent) 0,transparent 28%),linear-gradient(112deg,color-mix(in srgb,var(--season-surface) 76%,#edf7f0) 0%,#fffdf8 68%,#fbf4e8 100%); box-shadow:none; }
.today-personal-decoration { position:absolute; z-index:0; inset:0; overflow:hidden; border-radius:inherit; pointer-events:none; }
.today-personal-decoration span { position:absolute; display:block; font-size:clamp(25px,2.5vw,36px); color:var(--season-accent); opacity:.14; line-height:1; user-select:none; filter:saturate(.9); }
.today-personal-content,.today-personal-art { position:relative; z-index:1; }
.today-seasonal-frame { --frame-primary:#b72c3a; --frame-secondary:#17643f; --frame-highlight:#fff9ed; position:absolute; z-index:3; inset:-7px; border:1px solid var(--frame-primary); border-radius:calc(var(--radius-lg,24px) + 7px); pointer-events:none; }
.today-seasonal-frame--halloween { --frame-primary:#e47a38; --frame-secondary:#54315f; --frame-highlight:#fff4e8; }
.today-seasonal-frame--tet { --frame-primary:#c73534; --frame-secondary:#d3aa50; --frame-highlight:#fff8e7; }
.today-seasonal-frame__garland { position:absolute; top:0; left:8%; right:8%; height:24px; }
.today-seasonal-frame__garland svg { display:block; width:100%; height:100%; overflow:visible; }
.today-seasonal-frame__garland path { fill:none; stroke:var(--frame-secondary); stroke-width:1.5; vector-effect:non-scaling-stroke; }
.today-seasonal-frame__garland > i { position:absolute; width:8px; height:8px; transform:translate(-50%,-50%); border:1px solid #fff7dc; border-radius:50%; background:#f4d16d; box-shadow:0 0 8px 2px rgb(244 209 109 / 48%); animation:today-season-light 2.8s ease-in-out infinite; }
.today-seasonal-frame__garland > i:nth-of-type(3n+1) { background:#e34b4e; box-shadow:0 0 8px 2px rgb(227 75 78 / 48%); animation-delay:-.8s; }
.today-seasonal-frame__garland > i:nth-of-type(3n+2) { background:#43a66a; box-shadow:0 0 8px 2px rgb(67 166 106 / 48%); animation-delay:-1.6s; }
.today-seasonal-frame__hanger { position:absolute; z-index:1; display:block; width:38px; height:48px; margin-left:-19px; transform-origin:50% 0; animation:today-season-hanger-sway 3.8s ease-in-out infinite alternate; }
.today-seasonal-frame__hanger i { position:absolute; top:0; left:50%; width:1.5px; height:17px; background:var(--frame-secondary); }
.today-seasonal-frame__hanger b { position:absolute; top:15px; left:50%; display:block; transform:translateX(-50%); font-size:30px; font-weight:400; line-height:1; filter:drop-shadow(0 2px 2px rgb(45 39 30 / 18%)); }
.today-seasonal-frame--halloween .today-seasonal-frame__hanger i { background:#54315f; }
.today-seasonal-frame--tet .today-seasonal-frame__hanger i { background:#b92f31; }
.today-seasonal-frame--christmas { inset:-8px; border:2px solid #17643f; box-shadow:0 0 0 2px #b72c3a; }
.today-seasonal-frame--christmas .today-seasonal-frame__garland path { stroke:#17643f; }
.today-seasonal-frame--christmas .today-seasonal-frame__hanger i { height:18px; }
.today-seasonal-frame--christmas .today-seasonal-frame__hanger b { top:17px; }
.today-seasonal-frame__bow { position:absolute; z-index:2; top:-7px; right:calc(50% - 23px); display:block; width:46px; height:30px; transform-origin:50% 0; animation:today-season-hanger-sway 3.8s ease-in-out infinite alternate; }
.today-seasonal-frame__bow i { position:absolute; top:3px; width:22px; height:18px; border:2px solid #fff9ed; border-radius:70% 45% 65% 45%; background:#c43743; box-shadow:0 2px 4px rgb(45 39 30 / 18%); }
.today-seasonal-frame__bow i:first-child { left:0; transform:rotate(28deg); }
.today-seasonal-frame__bow i:nth-child(2) { right:0; border-radius:45% 70% 45% 65%; background:#17643f; transform:rotate(-28deg); }
.today-seasonal-frame__bow b { position:absolute; top:9px; left:18px; width:11px; height:11px; border:1px solid #fff9ed; border-radius:50%; background:#d9b35e; }
.today-seasonal-frame--halloween .today-seasonal-frame__garland path { stroke:#54315f; stroke-dasharray:2 2; }
.today-seasonal-frame--tet .today-seasonal-frame__garland path { stroke:#c73534; }
.today-seasonal-frame--tet .today-seasonal-frame__hanger i { background:#c73534; }
@keyframes today-season-hanger-sway { from { rotate:-2deg; } to { rotate:2deg; } }
@keyframes today-season-light { 0%,100% { opacity:.6; scale:.9; } 50% { opacity:1; scale:1.18; } }
.today-personal-content { min-width:0; }
.today-personal-art { position:relative; display:grid; place-items:center; width:176px; aspect-ratio:1; justify-self:center; overflow:visible; border:1px solid color-mix(in srgb,var(--season-accent) 22%,transparent); border-radius:50%; background:radial-gradient(circle at 42% 32%,#fffdf7 0%,color-mix(in srgb,var(--season-surface) 72%,#fbf1df) 67%,#f2e8d5 100%); animation:today-chef-float 5.8s ease-in-out infinite; }
.today-personal { border-color:color-mix(in srgb,var(--season-accent) 23%,var(--line)); box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--season-accent) 6%,transparent); }
.today-personal--seasonal-frame { padding-top:68px; }
.today-personal--seasonal-frame { border-color:transparent; }
.today-personal-art::after { content:""; position:absolute; inset:-5px; border:2px solid color-mix(in srgb,var(--season-accent) 50%,transparent); border-radius:50%; opacity:0; pointer-events:none; }
.today-personal--seasonal-unlock .today-personal-art::after { animation:today-seasonal-reveal 1.5s ease-out both; }
.today-chef-illustration { display:block; width:94%; height:94%; overflow:visible; }
.today-chef-steam { transform-box:fill-box; transform-origin:center bottom; animation:today-chef-steam 2.2s ease-in-out infinite; }
@keyframes today-chef-float { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-3px); } }
@keyframes today-chef-steam { 0%,100% { opacity:.35; transform:translateY(3px); } 50% { opacity:.9; transform:translateY(-3px); } }
@keyframes today-seasonal-reveal { 0% { opacity:0; transform:scale(.9); } 25% { opacity:.75; } 100% { opacity:0; transform:scale(1.12); } }
.today-personal-heading { font-size:16px; font-weight:750; line-height:1.5; margin:0 0 12px; color:var(--primary-ink); }
.today-personal-empty { display:flex; align-items:center; justify-content:space-between; gap:20px; }
.today-personal-empty strong { font-size:20px; font-weight:750; }
.today-personal-empty p { margin:4px 0; }
#today-menus { scroll-margin-top:96px; }
.today-section-heading { display:flex; align-items:baseline; justify-content:space-between; gap:16px; margin:0 0 16px; }
.today-section-heading h2 { font-size:24px; font-weight:750; margin:0; }
.today-section-heading .meta { text-align:right; }
.today-menu-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:20px; }
.today-menu-card { border-radius:24px; padding:24px; display:flex; flex-direction:column; min-width:0; box-shadow:none; }
.today-menu-status { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px 12px; }
.today-menu-status .badge { font-size:14px; font-weight:700; padding:5px 10px; color:var(--primary-ink); background:var(--primary-soft); }
.today-menu-status .today-menu-closed { color:var(--ink-soft); background:var(--bg-tint); }
.today-own-order { font-size:14px; font-weight:700; color:var(--primary-ink); }
.today-menu-image { display:block; margin-top:18px; border:1px solid var(--line); border-radius:12px; overflow:hidden; background:var(--bg-tint); }
.today-menu-image img { width:100%; height:200px; object-fit:contain; }
.today-menu-card h3 { font-size:24px; font-weight:750; line-height:1.35; margin:18px 0 6px; overflow-wrap:anywhere; }
.today-menu-meta { font-size:14px; font-weight:600; line-height:1.6; color:var(--ink-soft); margin:4px 0; overflow-wrap:anywhere; }
.today-menu-preview { font-size:16px; line-height:1.65; color:var(--ink); margin:8px 0 0; overflow-wrap:anywhere; }
.today-menu-activity { border-top:1px solid var(--line); margin:20px 0 18px; padding-top:16px; display:flex; align-items:center; gap:10px; min-height:51px; }
.today-menu-activity p { min-width:0; margin:0; font-size:14px; color:var(--ink-soft); overflow-wrap:anywhere; }
.today-menu-activity strong { font-weight:700; color:var(--ink); }
.today-menu-card :deep(.btn) { margin-top:auto; min-height:48px; font-size:16px; }
@media(max-width:700px) {
  .season-preview { grid-template-columns:1fr; gap:10px; margin-bottom:16px; padding:12px 14px; }
  .today-personal-decoration span { font-size:clamp(22px,6vw,29px); opacity:.12; }
  .today-personal-decoration span:nth-child(n+9) { display:none; }
  .today-personal { grid-template-columns:minmax(0,1fr) clamp(88px,23vw,124px); gap:8px; padding:20px; margin:20px 0 28px; background:radial-gradient(ellipse at 92% 60%,color-mix(in srgb,var(--season-accent) 10%,transparent) 0,transparent 32%),linear-gradient(120deg,color-mix(in srgb,var(--season-surface) 76%,#edf7f0) 0%,#fffdf8 82%); }
  .today-personal-art { width:clamp(84px,22vw,118px); align-self:end; margin-bottom:2px; }
  .today-menu-grid { grid-template-columns:1fr; gap:16px; }
  .today-menu-card { padding:20px; }
  .today-personal-empty { align-items:flex-start; flex-direction:column; gap:12px; }
  .today-personal-empty :deep(.btn) { width:100%; }
  .today-section-heading { align-items:flex-start; flex-direction:column; gap:4px; }
  .today-section-heading .meta { text-align:left; }
  .today-menu-card h3 { font-size:22px; }
  .today-menu-image img { height:180px; }
}
@media(max-width:380px) { .today-personal { grid-template-columns:minmax(0,1fr) 76px; gap:4px; padding:16px; }.today-personal-art { width:72px; } }
@media(max-width:700px) {
  .today-seasonal-frame { inset:-5px; border-radius:calc(var(--radius-lg,24px) + 5px); }
  .today-seasonal-frame--christmas { inset:-6px; border-width:2px; box-shadow:0 0 0 2px #b72c3a; }
  .today-seasonal-frame__garland { top:0; left:10%; right:10%; height:20px; }
  .today-seasonal-frame__garland > i { width:6px; height:6px; }
  .today-seasonal-frame__hanger { width:32px; height:40px; margin-left:-16px; }
  .today-seasonal-frame__hanger i { height:14px; }
  .today-seasonal-frame__hanger b { top:13px; font-size:25px; }
  .today-personal--seasonal-frame { padding-top:60px; }
  .today-seasonal-frame--christmas .today-seasonal-frame__hanger i { height:16px; }
  .today-seasonal-frame--christmas .today-seasonal-frame__hanger b { top:15px; font-size:22px; }
  .today-seasonal-frame__bow { top:-5px; right:calc(50% - 18px); transform:scale(.7); }
}
@media(prefers-reduced-motion:reduce) {
  .today-personal-art,.today-chef-steam,.today-personal--seasonal-unlock .today-personal-art::after,
  .today-seasonal-frame__hanger,.today-seasonal-frame__bow,.today-seasonal-frame__garland i { animation:none !important; }
}
</style>

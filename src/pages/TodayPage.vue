<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useUser } from '@clerk/vue'
import { useAppPresence } from '../composables/useAppPresence'
import { useMenus } from '../composables/useMenus'
import { todayInVN } from '../lib/date'
import { menuDishes } from '../lib/menu'
import { AppButton, PageHeader, Spinner, EmptyState, SignInModal } from '../components/ui'
import OrderCard from '../components/OrderCard.vue'
const { user, isSignedIn } = useUser()
const { listMenusByDate } = useMenus()
const menus = ref([]), loading = ref(false), error = ref(''), showSignIn = ref(false)
const today = todayInVN()
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
  if (viewer) return { name: viewer.name, text: 'đang chọn', dish: viewer.picks[0] }
  const order = (menu.orders || []).find(o => o.user_id !== user.value?.id) || menu.orders?.[0]
  if (order) return { name: order.user?.full_name || 'Thành viên', text: 'đã đặt', dish: order.item_text.split('\n')[0] }
  return null
}
</script>
<template><div class="today-page">
  <PageHeader :eyebrow="dateLabel" title="Trưa nay, ăn gì?" :sub="isSignedIn ? `${openMenus} menu đang nhận đặt món. Chọn bữa trưa của bạn.` : 'Đăng nhập để chọn bữa trưa của bạn.'" />
  <EmptyState v-if="!isSignedIn" title="Xem menu hôm nay" description="Đăng nhập để xem menu và đơn cơm của bạn."><AppButton @click="showSignIn = true">Đăng nhập</AppButton></EmptyState>
  <Spinner v-else-if="loading && !menus.length" />
  <div v-else-if="error && !menus.length" class="stack-sm"><p class="alert">{{ error }}</p><AppButton variant="ghost" @click="load">Thử lại</AppButton></div>
  <template v-else>
    <p v-if="loading" class="meta" role="status">Đang cập nhật…</p><div v-if="error" class="row-wrap"><p class="alert" role="alert">{{ error }}</p><AppButton variant="ghost" @click="load">Thử lại</AppButton></div>
    <section class="card today-personal" aria-labelledby="personal-lunch-title">
      <span id="personal-lunch-title" class="eyebrow">Bữa trưa của bạn</span>
      <template v-if="myOrders.length"><OrderCard v-for="entry in myOrders" :key="entry.order.id" :order="entry.order" :menu="entry.menu" compact @changed="queueRefresh" /></template>
      <div v-else class="today-personal-empty"><div><p><strong>Bạn chưa đặt món hôm nay</strong></p><p class="meta">{{ openMenus ? 'Chọn một menu bên dưới để bắt đầu.' : 'Menu mới sẽ xuất hiện ở đây.' }}</p></div><AppButton v-if="openMenus" variant="ghost" @click="showMenus">Xem menu <span aria-hidden="true">→</span></AppButton></div>
    </section>
    <section id="today-menus"><div class="today-section-heading"><h2>Menu hôm nay</h2><span class="meta">{{ orderedPeople ? `Đã có ${orderedPeople} người đặt` : 'Chưa có ai đặt' }}</span></div>
      <EmptyState v-if="!menus.length" title="Chưa có menu hôm nay" description="Đăng menu đầu tiên để mọi người chọn bữa trưa."><AppButton to="/post">Đăng menu</AppButton></EmptyState>
      <div v-else class="today-menu-grid"><article v-for="menu in menus" :key="menu.id" class="card today-menu-card"><div class="today-menu-status"><span class="badge">{{ menu.is_closed ? 'Đã chốt đơn' : 'Đang nhận đơn' }}</span><span v-if="hasOwnOrder(menu)" class="meta">Bạn đã đặt</span></div><h3>{{ menu.restaurant?.name || menu.title }}</h3><p class="today-menu-meta">{{ menuMetadata(menu) }}</p><p class="today-menu-preview">{{ preview(menu) }}</p><div class="today-menu-activity"><template v-for="entry in activity(menu) ? [activity(menu)] : []" :key="entry.name"><span class="today-avatar" aria-hidden="true">{{ entry.name?.[0] }}</span><p>{{ entry.name }} {{ entry.text }} <strong>{{ entry.dish }}</strong></p></template><p v-if="!activity(menu)" class="meta">Chưa có đơn · {{ menu.is_closed ? 'Menu đã chốt' : 'Bạn có thể chọn món trước' }}</p></div><AppButton block :variant="menu.id === firstOpenMenu && !hasOwnOrder(menu) ? 'primary' : 'ghost'" :to="`/menu/${menu.id}`">{{ hasOwnOrder(menu) ? 'Xem menu & đơn của bạn' : menu.is_closed ? 'Xem menu' : 'Xem menu & chọn món' }} <span aria-hidden="true">→</span></AppButton></article></div>
    </section>
  </template><SignInModal v-if="showSignIn" @close="showSignIn = false" />
</div></template>
<style scoped>
.today-page :deep(.page-header) { margin-bottom:28px; }
.today-personal { margin:28px 0; padding:24px; border-left:3px solid var(--primary); }
.today-personal > .eyebrow { display:block; margin-bottom:4px; }
.today-personal-empty { display:flex; align-items:center; justify-content:space-between; gap:20px; }
.today-personal-empty strong { font-size:19px; font-weight:650; }.today-personal-empty p{margin:4px 0;}
.today-section-heading { display:flex; align-items:center; justify-content:space-between; gap:16px; margin:0 0 18px; }
.today-section-heading h2 { font-size:21px; margin:0; }.today-section-heading .meta { text-align:right; }
.today-menu-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:20px; }
.today-menu-card { padding:24px; display:flex; flex-direction:column; min-width:0; }
.today-menu-status { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.today-menu-card h3 { font-size:21px; line-height:1.35; margin:18px 0 8px; }
.today-menu-meta,.today-menu-preview { font-size:15px; line-height:1.55; color:var(--ink-soft); margin:4px 0; }
.today-menu-activity { border-top:1px solid var(--line); margin:22px 0 18px; padding-top:16px; display:flex; align-items:center; gap:10px; min-height:51px; }
.today-menu-activity p { min-width:0; margin:0; font-size:14px; color:var(--ink-soft); overflow-wrap:anywhere; }.today-menu-activity strong{font-weight:650;}
.today-avatar { width:34px; height:34px; flex:0 0 34px; display:grid; place-items:center; border-radius:50%; background:var(--bg-tint); color:var(--ink-soft); font-size:13px; font-weight:700; }
.today-menu-card :deep(.btn) { margin-top:auto; }
@media(max-width:640px){.today-personal{padding:20px;margin:24px 0}.today-menu-grid{grid-template-columns:1fr}.today-menu-card{padding:20px}.today-personal-empty{align-items:flex-start;flex-direction:column;gap:8px}.today-section-heading{gap:8px}.today-section-heading .meta{font-size:12px}}
</style>

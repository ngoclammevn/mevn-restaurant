<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useUser } from '@clerk/vue'
import { useAppPresence } from '../composables/useAppPresence'
import { useMenus } from '../composables/useMenus'
import { todayInVN, formatVNDate } from '../lib/date'
import { menuDishes } from '../lib/menu'
import { AppButton, PageHeader, Spinner, EmptyState, SignInModal } from '../components/ui'
import OrderCard from '../components/OrderCard.vue'
import AppIcon from '../components/ui/AppIcon.vue'
const { user, isSignedIn } = useUser()
const { listMenusByDate } = useMenus()
const menus = ref([]), loading = ref(false), error = ref(''), showSignIn = ref(false)
const today = todayInVN()
const presence = useAppPresence()
const myOrders = computed(() => menus.value.flatMap(menu => (menu.orders ?? []).filter(order => order.user_id === user.value?.id).map(order => ({ menu, order }))))
const unpaidCount = computed(() => myOrders.value.filter(entry => !entry.order.is_paid).length)
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
  if (dishes.length) return dishes.slice(0, 3).map(d => d.name).join(' · ') + (dishes.length > 3 ? ` · +${dishes.length - 3} món` : '')
  return (menu.note ?? '').slice(0, 120) || 'Xem ảnh và chọn món trong menu'
}
function hasOwnOrder(menu) { return (menu.orders ?? []).some(order => order.user_id === user.value?.id) }
function showMenus() { document.getElementById('today-menus')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }) }
</script>
<template><div class="stack">
  <PageHeader title="Hôm nay" :sub="formatVNDate(today)" />
  <EmptyState v-if="!isSignedIn" title="Xem menu hôm nay" description="Đăng nhập để xem menu và đơn cơm của bạn."><AppButton @click="showSignIn = true">Đăng nhập</AppButton></EmptyState>
  <Spinner v-else-if="loading && !menus.length" />
  <div v-else-if="error && !menus.length" class="stack-sm"><p class="alert">{{ error }}</p><AppButton variant="ghost" @click="load">Thử lại</AppButton></div>
  <template v-else>
    <p v-if="loading" class="meta" role="status">Đang cập nhật…</p><div v-if="error" class="row-wrap"><p class="alert" role="alert">{{ error }}</p><AppButton variant="ghost" @click="load">Thử lại</AppButton></div>
    <section class="card stack personal-lunch" aria-labelledby="personal-lunch-title">
      <div class="row-wrap"><h2 id="personal-lunch-title" class="section-title">Bữa cơm của tôi</h2><span v-if="myOrders.length" class="badge spacer" >{{ unpaidCount ? `${unpaidCount} đơn chưa trả` : 'Đã thanh toán đủ' }}</span></div>
      <template v-if="myOrders.length"><p class="meta">{{ myOrders.length }} đơn hôm nay. Bạn tự đánh dấu đã trả sau khi chuyển khoản.</p><OrderCard v-for="entry in myOrders" :key="entry.order.id" :order="entry.order" :menu="entry.menu" @changed="queueRefresh" /></template>
      <div v-else class="row-wrap"><div class="stack-sm"><p>Bạn chưa đặt bữa trưa hôm nay.</p><p class="meta">{{ openMenus ? `${openMenus} menu đang nhận đơn. Chọn một menu bên dưới để bắt đầu.` : 'Khi có menu nhận đơn, bạn có thể chọn món ở đây.' }}</p></div><AppButton v-if="openMenus" variant="ghost" class="spacer" @click="showMenus">Xem menu</AppButton></div>
    </section>
    <section id="today-menus" class="stack-sm"><h2 class="section-title">Menu hôm nay <span class="meta">({{ menus.length }})</span></h2>
      <EmptyState v-if="!menus.length" title="Chưa có menu hôm nay" description="Đăng menu đầu tiên để mọi người chọn bữa trưa."><AppButton to="/post">Đăng menu</AppButton></EmptyState>
      <div v-else class="menu-grid"><article v-for="menu in menus" :key="menu.id" class="card stack compact-menu"><div class="row-wrap"><span class="meta">{{ menu.title }}</span><span class="badge spacer" >{{ menu.is_closed ? 'Đã chốt' : 'Đang nhận đơn' }}</span></div><h3 class="section-title">{{ menu.restaurant?.name || menu.title }}</h3><p class="menu-preview">{{ preview(menu) }}</p><div class="row-wrap"><span v-if="menuDishes(menu).length" class="meta">{{ menuDishes(menu).length }} món</span><span class="meta">{{ menu.orders?.length ?? 0 }} đơn</span><span v-if="hasOwnOrder(menu)" class="badge"><AppIcon name="check" />Bạn đã đặt</span></div><div class="row-wrap menu-card-footer"><span class="meta">{{ menu.poster?.full_name || 'Người đăng menu' }} thu tiền</span><AppButton class="spacer" :variant="menu.is_closed || hasOwnOrder(menu) ? 'ghost' : 'primary'" :to="`/menu/${menu.id}`">{{ hasOwnOrder(menu) ? 'Xem đơn của tôi' : menu.is_closed ? 'Xem menu' : 'Chọn món' }}</AppButton></div></article></div>
    </section>
  </template><SignInModal v-if="showSignIn" @close="showSignIn = false" />
</div></template>

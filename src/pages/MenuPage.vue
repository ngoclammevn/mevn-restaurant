<script setup>
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUser } from '@clerk/vue'
import { useMenus } from '../composables/useMenus'
import { useOrders } from '../composables/useOrders'
import { useReviews } from '../composables/useReviews'
import { useAppPresence } from '../composables/useAppPresence'
import OrderConfirmDialog from '../components/OrderConfirmDialog.vue'
import DishFeedbackDialog from '../components/DishFeedbackDialog.vue'
import { useCatalog } from '../composables/useCatalog'
import { normalizeMenu, menuDishes, parseMenuNote, serializeMenu } from '../lib/menu'
import { formatVNDate, todayInVN } from '../lib/date'
import { managedOrderAmount } from '../lib/manage-summary'
import { autolink } from '../lib/autolink'
import { AppButton, PageHeader, Spinner, EmptyState, MenuBoard, OrderSummaryPanel, PaidStamp, SignInModal, AppDialog } from '../components/ui'
import OrderCard from '../components/OrderCard.vue'
import AppIcon from '../components/ui/AppIcon.vue'
const route = useRoute(), router = useRouter()
const { user } = useUser()
const { getMenu, setMenuClosed } = useMenus()
const { createOrder, updateOrder, listProfiles } = useOrders()
const { listDishes } = useCatalog()
const { listRestaurantReviews, listDishReviews } = useReviews()
const presence = useAppPresence()
const menu = ref(null), profiles = ref([]), ratings = ref([]), loading = ref(true), error = ref(''), actionError = ref(''), showSignIn = ref(false), copied = ref(false), busy = ref(false)
const selected = ref(Object.create(null)), itemText = ref(''), note = ref(''), recipient = ref(''), editing = ref(null)
const zoomImage = ref(false)
const showConfirm = ref(false), feedbackDish = ref(null), feedbackReviews = ref([]), feedbackLoading = ref(false), feedbackError = ref(''), recentReviews = ref([]), feedbackBatchError = ref('')
const orderForm = ref(null), formVisible = ref(false), savedMessage = ref('')
const myOrders = computed(() => (menu.value?.orders ?? []).filter(order => order.user_id === user.value?.id))
const ownMenu = computed(() => menu.value?.poster_id === user.value?.id)
const structured = computed(() => !!parseMenuNote(menu.value?.note))
const dishes = computed(() => menuDishes(menu.value))
const boardNote = computed(() => serializeMenu(dishes.value, parseMenuNote(menu.value?.note)?.notes || ''))
const feedback = computed(() => {
  const map = Object.create(null), restaurantId = menu.value?.restaurant_id
  for (const stat of ratings.value) {
    if (stat.restaurant_id !== restaurantId) continue
    const counts = new Map()
    for (const review of recentReviews.value) {
      if (review.restaurant_id !== restaurantId || review.restaurant_dish_id !== stat.id) continue
      for (const label of new Set(review.labels ?? [])) counts.set(label, (counts.get(label) || 0) + 1)
    }
    map[`${restaurantId}:${stat.id}`] = { ...stat, labels: [...counts].sort((a,b) => b[1] - a[1]).slice(0, 2).map(([label]) => label) }
  }
  return map
})
const boardViewers = computed(() => presence.viewers.value.filter(v => v.menuId === menu.value?.id))
const recipientName = computed(() => editing.value || !recipient.value ? (user.value?.fullName || 'Tôi') : profiles.value.find(p => p.id === recipient.value)?.full_name || 'Người nhận')
const selectedDishes = computed(() => Object.values(selected.value))
const total = computed(() => selectedDishes.value.length && selectedDishes.value.every(d => d.price != null && d.price !== '' && Number.isFinite(Number(d.price))) ? selectedDishes.value.reduce((sum, d) => sum + Number(d.price), 0) : null)
const canSave = computed(() => structured.value ? selectedDishes.value.length > 0 : itemText.value.trim().length > 0)
const draftKey = computed(() => user.value?.id && menu.value ? `lunch-order-v2:${user.value.id}:${menu.value.id}` : null)
let generation = 0, feedbackGeneration = 0, refreshGeneration = 0, restoring = false, refreshTimer
function resetForm() { selected.value = Object.create(null); itemText.value = ''; note.value = ''; recipient.value = ''; editing.value = null; actionError.value = '' }
async function load(guestDraft = null) {
  const current = ++generation; clearTimeout(refreshTimer); feedbackGeneration++; refreshGeneration++; restoring = true; resetForm(); showConfirm.value = false; feedbackDish.value = null; busy.value = false; copied.value = false; zoomImage.value = false; showSignIn.value = false; presence.clearMenuDraft(); menu.value = null; profiles.value = []; ratings.value = []; recentReviews.value = []; feedbackBatchError.value = ''; error.value = ''; loading.value = true
  try {
  const result = await getMenu(route.params.id)
  if (current !== generation) return
  if (result.error || !result.data) { error.value = 'Không tải được menu. Menu có thể đã bị xóa hoặc kết nối bị gián đoạn.'; loading.value = false; restoring = false; return }
  menu.value = normalizeMenu(result.data)
  if (user.value) {
    const profileResult = await listProfiles()
    if (current !== generation) return
    profiles.value = profileResult.data ?? []
    if (draftKey.value && !menu.value.is_closed) {
      try {
        const saved = guestDraft?.menuId === menu.value.id ? guestDraft : JSON.parse(sessionStorage.getItem(draftKey.value) || 'null')
        if (saved) { note.value = saved.note || ''; recipient.value = profiles.value.some(p => p.id === saved.recipient) ? saved.recipient : ''; itemText.value = saved.itemText || ''; for (const name of saved.names ?? []) { const dish = dishes.value.find(d => d.name === name && d.available !== false); if (dish) selected.value[name] = dish } }
      } catch {}
    }
    if (route.query.edit) startEdit(String(route.query.edit))
    if (menu.value.restaurant_id) {
      const [ratingResult, reviewResult] = await Promise.all([listDishes(menu.value.restaurant_id), listRestaurantReviews(menu.value.restaurant_id)].map(request => request.catch(error => ({ data: null, error }))))
      if (current !== generation) return
      ratings.value = ratingResult.data ?? []; recentReviews.value = reviewResult.data ?? []
      if (ratingResult.error || reviewResult.error) feedbackBatchError.value = 'Chưa tải được đánh giá món.'
    }
  }
  await nextTick()
  } catch { if (current === generation) error.value = 'Chưa tải được menu. Kiểm tra kết nối rồi thử lại.' }
  finally { if (current === generation) { restoring = false; loading.value = false } }
}
watch([() => route.params.id, () => user.value?.id], (current, previous = []) => {
  savedMessage.value = ''
  const guestDraft = !previous[1] && current[1] && current[0] === previous[0] && menu.value
    ? { menuId: menu.value.id, names: Object.keys(selected.value), itemText: itemText.value, note: note.value, recipient: '' } : null
  if (guestDraft) {
    try { sessionStorage.setItem(`lunch-order-v2:${current[1]}:${guestDraft.menuId}`, JSON.stringify(guestDraft)) } catch {}
  }
  load(guestDraft)
}, { immediate: true })
watch(() => route.query.edit, id => { if (id && menu.value) startEdit(String(id)) })
watch([selected, itemText, note, recipient], () => {
  if (restoring || editing.value || !draftKey.value) return
  try { sessionStorage.setItem(draftKey.value, JSON.stringify({names:Object.keys(selected.value), itemText:itemText.value, note:note.value, recipient:recipient.value})) } catch {}
}, { deep: true })
let formObserver
watch(orderForm, element => {
  formObserver?.disconnect(); formVisible.value = false
  if (element && typeof IntersectionObserver !== 'undefined') {
    formObserver = new IntersectionObserver(entries => { formVisible.value = entries[0]?.isIntersecting ?? false }, { threshold: 0 })
    formObserver.observe(element)
  }
}, { flush: 'post' })
const unsubscribe = presence.onOrderChanged(menuId => { if (menuId === menu.value?.id) queueRefresh() })
watch([selectedDishes, () => menu.value?.id], () => {
  if (menu.value) presence.setMenuDraft({ id: menu.value.id, restaurantName: menu.value.restaurant?.name || '' }, selectedDishes.value.map(d => d.name))
}, { deep: true })
onUnmounted(() => { generation++; feedbackGeneration++; refreshGeneration++; clearTimeout(refreshTimer); unsubscribe(); presence.clearMenuDraft(); formObserver?.disconnect() })
function queueRefresh() { clearTimeout(refreshTimer); refreshTimer = setTimeout(refreshMenu, 250) }
async function refreshMenu() {
  if (!menu.value) return
  const current = generation, request = ++refreshGeneration, menuId = menu.value.id, account = user.value?.id
  const result = await getMenu(menuId).catch(error => ({ data: null, error }))
  if (current !== generation || request !== refreshGeneration || menu.value?.id !== menuId || user.value?.id !== account) return
  if (result.error || !result.data) { actionError.value = 'Chưa cập nhật được menu. Các món đang chọn vẫn được giữ.'; return }
  menu.value = normalizeMenu(result.data)
  for (const [name, dish] of Object.entries(selected.value)) {
    const fresh = dishes.value.find(d => dish.id ? d.id === dish.id : d.name === name)
    selected.value[name] = fresh || { ...dish, available: false }
  }
}
function orderChanged() { queueRefresh(); loadFeedbackBatch() }
async function loadFeedbackBatch() {
  if (!user.value || !menu.value?.restaurant_id) return
  const current = generation, account = user.value.id, menuId = menu.value.id, restaurantId = menu.value.restaurant_id
  const [ratingResult, reviewResult] = await Promise.all([listDishes(restaurantId), listRestaurantReviews(restaurantId)].map(request => request.catch(error => ({ data: null, error }))))
  if (current !== generation || user.value?.id !== account || menu.value?.id !== menuId) return
  if (ratingResult.error || reviewResult.error) { feedbackBatchError.value = 'Chưa tải được đánh giá món.'; return }
  ratings.value = ratingResult.data ?? []; recentReviews.value = reviewResult.data ?? []; feedbackBatchError.value = ''
}
async function loadFeedback() {
  if (!user.value || !menu.value?.restaurant_id || !feedbackDish.value?.restaurant_dish_id) return
  const current = ++feedbackGeneration, account = user.value.id, menuId = menu.value.id, restaurantId = menu.value.restaurant_id, dishId = feedbackDish.value.restaurant_dish_id
  feedbackLoading.value = true; feedbackError.value = ''; feedbackReviews.value = []
  try {
    const result = await listDishReviews(restaurantId, dishId)
    if (current !== feedbackGeneration || user.value?.id !== account || menu.value?.id !== menuId || feedbackDish.value?.restaurant_dish_id !== dishId) return
    if (result.error) throw result.error
    feedbackReviews.value = result.data ?? []
  } catch { if (current === feedbackGeneration) feedbackError.value = 'Chưa tải được đánh giá. Thử lại.' }
  finally { if (current === feedbackGeneration) feedbackLoading.value = false }
}
function openFeedback(dish) { feedbackDish.value = dish; loadFeedback() }
function closeFeedback() { feedbackGeneration++; feedbackDish.value = null; feedbackReviews.value = []; feedbackLoading.value = false }
function requestConfirmation() {
  if (!user.value) { showSignIn.value = true; return }
  if (menu.value?.is_closed || busy.value || !canSave.value) return
  const originalNames = editing.value ? (myOrders.value.find(o => o.id === editing.value)?.item_text || '').split('\n').map(n => n.trim()) : []
  if (selectedDishes.value.some(d => d.available === false && !originalNames.includes(d.name))) { actionError.value = 'Có món vừa hết. Bỏ món đó trước khi đặt.'; return }
  actionError.value = ''; showConfirm.value = true
}

function reviewSelection() {
  const form = orderForm.value
  if (!form) return
  form.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  form.querySelector('h2')?.focus({ preventScroll: true })
}
function toggleDish(dish) {
  if (menu.value?.is_closed || busy.value) return
  if (selected.value[dish.name]) delete selected.value[dish.name]
  else if (dish.available !== false) selected.value[dish.name] = dish
}
function startEdit(id) {
  const order = menu.value?.orders?.find(o => o.id === id && o.user_id === user.value?.id)
  if (!order || menu.value.is_closed) return
  resetForm(); editing.value = order.id; itemText.value = order.item_text; note.value = order.note ?? ''
  for (const name of order.item_text.split('\n').map(s => s.trim())) { const dish = dishes.value.find(d => d.name === name); if (dish) selected.value[name] = dish }
  nextTick(() => document.getElementById('order-form')?.scrollIntoView({behavior:'smooth', block:'center'}))
}
function cancelEdit() { resetForm(); router.replace({ path:route.path, query:{} }) }
async function submit() {
  if (!user.value) { showSignIn.value = true; return }
  if (!menu.value || busy.value || !canSave.value) return
  if (menu.value.is_closed) { actionError.value = 'Menu đã chốt. Liên hệ người đăng nếu cần đổi món.'; return }
  const originalNames = editing.value ? (myOrders.value.find(o => o.id === editing.value)?.item_text || '').split('\n').map(n => n.trim()) : []
  if (selectedDishes.value.some(d => d.available === false && !originalNames.includes(d.name))) { actionError.value = 'Có món vừa hết. Quay lại để bỏ món đó.'; return }
  const account = user.value.id, menuId = menu.value.id, current = generation
  busy.value = true; actionError.value = ''
  try {
    const payload = { item_text:structured.value ? selectedDishes.value.map(d => d.name).join('\n') : itemText.value.trim(), note:note.value.trim() || null }
    if (structured.value && selectedDishes.value.every(d => d.id)) payload.menu_item_ids = selectedDishes.value.map(d => d.id)
    const result = editing.value ? await updateOrder({id:editing.value, ...payload}) : await createOrder({menu_id:menuId, user_id:recipient.value || null, ...payload})
    if (current !== generation || user.value?.id !== account || menu.value?.id !== menuId) return
    if (result.error) {
      const refreshed = await getMenu(menuId)
      if (current === generation && user.value?.id === account && menu.value?.id === menuId && refreshed.data) menu.value.is_closed = refreshed.data.is_closed
      throw result.error
    }
    try { sessionStorage.removeItem(draftKey.value) } catch {}
    const wasEditing = !!editing.value
    showConfirm.value = false; presence.notifyOrderChanged(menuId); resetForm(); await router.replace({path:route.path, query:{}}); if (current !== generation || user.value?.id !== account) return; await load()
    if (user.value?.id !== account || menu.value?.id !== menuId) return
    savedMessage.value = wasEditing ? 'Đã lưu thay đổi trong đơn.' : 'Đã đặt món. Bạn tự đánh dấu đã trả sau khi chuyển khoản.'
  } catch { if (user.value?.id === account && menu.value?.id === menuId) actionError.value = menu.value?.is_closed ? 'Đơn đã chốt. Liên hệ người đăng menu nếu cần thay đổi món.' : 'Chưa lưu được đơn. Các món đã chọn vẫn được giữ, hãy thử lại.' }
  finally { if (current === generation) busy.value = false }
}
async function closeOrdering() {
  if (!ownMenu.value || busy.value) return false
  if (!menu.value.is_closed && !confirm('Chốt đơn? Mọi người sẽ không thêm hoặc sửa món cho đến khi bạn mở lại.')) return false
  const account = user.value.id, menuId = menu.value.id, current = generation
  busy.value = true; actionError.value = ''
  try {
    const result = await setMenuClosed(menuId, true)
    if (result.error || !result.data) throw result.error || new Error('missing_menu')
    if (user.value?.id !== account || menu.value?.id !== menuId) return false
    menu.value = normalizeMenu(result.data)
    presence.notifyOrderChanged(menuId)
    await nextTick()
    return true
  } catch { if (current === generation) actionError.value = 'Chưa chốt được đơn. Thử lại.'; return false }
  finally { if (current === generation) busy.value = false }
}
async function reopenOrdering() {
  if (!ownMenu.value || busy.value || !confirm('Mở lại menu để mọi người thêm và sửa món?')) return
  const account = user.value.id, menuId = menu.value.id, current = generation
  busy.value = true; actionError.value = ''
  try {
    const result = await setMenuClosed(menuId, false)
    if (current !== generation || user.value?.id !== account || menu.value?.id !== menuId) return
    if (result.error) throw result.error
    menu.value.is_closed = false; presence.notifyOrderChanged(menuId)
  } catch { if (current === generation) actionError.value = 'Chưa mở lại được menu. Thử lại.' }
  finally { if (current === generation) busy.value = false }
}
async function copyLink() {
  try { await navigator.clipboard.writeText(`${location.origin}/share/${menu.value.id}`); copied.value = true }
  catch { actionError.value = 'Trình duyệt chưa cho phép sao chép đường dẫn.' }
}
</script>
<template><div class="menu-page" :class="{ 'menu-page--selection': selectedDishes.length && !menu?.is_closed }">
  <router-link to="/" class="back-link"><AppIcon name="arrow" />Menu hôm nay</router-link>
  <Spinner v-if="loading" />
  <EmptyState v-else-if="error" title="Chưa xem được menu" :description="error"><AppButton variant="ghost" @click="load()">Thử lại</AppButton></EmptyState>
  <template v-else-if="menu">
    <PageHeader :eyebrow="menu.menu_date === todayInVN() ? `Menu hôm nay · ${formatVNDate(menu.menu_date)}` : `Menu ngày ${formatVNDate(menu.menu_date)}`" :title="menu.restaurant?.name || menu.title" :sub="`${menu.poster?.full_name || 'Thành viên'} đăng · ${new Set((menu.orders || []).map(o => o.user_id)).size} người đã đặt · ${menu.is_closed ? 'Đã chốt đơn' : 'Đang nhận đơn'}`" />
    <div class="menu-heading-tools"><AppButton variant="ghost" size="sm" @click="copyLink">{{ copied ? 'Đã chép link' : 'Chia sẻ menu' }}</AppButton><AppButton v-if="ownMenu" variant="ghost" size="sm" :to="{path:'/manage',query:{menu_id:menu.id}}">Quản lý menu</AppButton></div>
    <p v-if="savedMessage" class="success-message" role="status">{{ savedMessage }}</p>
    <section v-if="myOrders.length" class="card menu-personal" aria-labelledby="my-menu-orders"><span id="my-menu-orders" class="eyebrow">Bữa trưa của bạn</span><OrderCard v-for="order in myOrders" :key="order.id" :order="order" :menu="menu" compact @changed="orderChanged" /></section>
    <p v-if="menu.is_closed" class="menu-closed-note">Menu đã chốt. Bạn vẫn có thể chuyển khoản và đánh giá đơn của mình.</p>
    <div class="menu-order-layout">
      <div class="menu-board-column">
        <MenuBoard v-if="structured" heading="Chọn món của bạn" :note="boardNote" :picks="selected" :disabled="menu.is_closed || busy" :viewers="boardViewers" :feedback="feedback" :restaurant-id="menu.restaurant_id" show-feedback :feedback-state="!menu.restaurant_id ? 'Chưa ghi nhận quán' : !user ? 'Đăng nhập để xem đánh giá' : ratings.length ? '' : feedbackBatchError" @toggle-dish="toggleDish" @feedback="openFeedback" />
        <section v-else class="card menu-plain"><h2>Chọn món của bạn</h2><p v-if="menu.note" class="order-lines" v-html="autolink(menu.note)" /><button v-if="menu.image_url" type="button" class="menu-image-button" aria-label="Xem ảnh thực đơn lớn" @click="zoomImage = true"><img :src="menu.image_url" :alt="menu.title" class="post-image" /></button></section>
        <AppButton v-if="feedbackBatchError" variant="ghost" @click="loadFeedbackBatch">Tải lại đánh giá</AppButton>
        <details v-if="menu.image_url && structured" class="menu-image-details"><summary>Ảnh thực đơn gốc</summary><button type="button" class="menu-image-button" aria-label="Xem ảnh thực đơn lớn" @click="zoomImage = true"><img :src="menu.image_url" :alt="menu.title" class="post-image" /></button></details>
      </div>
      <form v-if="!menu.is_closed" id="order-form" ref="orderForm" class="menu-cart-summary" :class="{'menu-cart-summary--structured':structured}" @submit.prevent="requestConfirmation">
        <h2 tabindex="-1">{{ editing ? 'Sửa món trong đơn' : 'Bữa trưa của bạn' }}</h2>
        <label v-if="!structured" class="field">Món muốn đặt<textarea v-model="itemText" class="textarea" required :disabled="busy" rows="3" /></label>
        <label class="field">Ghi chú cho bữa trưa<textarea v-model="note" class="textarea" :disabled="busy" maxlength="1000" rows="3" placeholder="Ví dụ: ít cơm, để riêng nước sốt…" /></label>
        <p v-if="recipient" class="meta">Người nhận đơn tự xác nhận thanh toán và đánh giá.</p><p v-if="!user" class="meta">Bạn có thể chọn món trước. Đăng nhập để lưu đơn.</p>
        <div v-if="!structured" class="cart-total"><span>Tổng cộng</span><strong>{{ total === null ? 'Chưa xác định' : `${Number(total).toLocaleString('vi-VN')}đ` }}</strong></div><p v-if="selectedDishes.length && total === null" class="meta">Có món chưa có giá. Xác nhận tiền với người đăng menu.</p>
        <p v-if="actionError" class="alert" role="alert">{{ actionError }}</p>
        <AppButton v-if="!structured" block type="submit" :disabled="!canSave" :loading="busy">{{ !user ? 'Đăng nhập để đặt món' : editing ? 'Xem lại thay đổi' : 'Tiếp tục đặt món' }} <span aria-hidden="true">→</span></AppButton><AppButton v-if="editing" block variant="ghost" :disabled="busy" @click="cancelEdit">Hủy sửa</AppButton>
        <p v-if="menu.poster?.payment_info" class="meta">Thanh toán cho {{ menu.poster?.full_name || 'người đăng menu' }} sau khi đặt món.</p>
      </form>
    </div>
    <p v-if="actionError && menu.is_closed" class="alert" role="alert">{{ actionError }}</p>
    <section class="card menu-community"><div class="menu-community-heading"><h2>Mọi người đã đặt</h2><span class="badge">{{ new Set((menu.orders || []).map(o => o.user_id)).size }} người</span></div><p class="meta">Chỉ đơn đã gửi mới được tổng hợp ở đây.</p><article v-for="order in menu.orders || []" :key="order.id" class="menu-community-person"><span class="menu-person-avatar" aria-hidden="true">{{ (order.user?.full_name || 'Thành viên')[0] }}</span><div><strong>{{ order.user?.full_name || 'Thành viên' }}</strong><p>{{ order.item_text.split('\n').join(' · ') }}<span v-if="managedOrderAmount(menu, order) !== null"> · {{ Number(managedOrderAmount(menu, order)).toLocaleString('vi-VN') }}đ</span></p><p v-if="order.note" class="meta">{{ order.note }}</p></div><PaidStamp :paid="order.is_paid" /></article><p v-if="!menu.orders?.length" class="meta">Chưa có đơn. Bạn có thể chọn món trước.</p></section>
    <details v-if="ownMenu" class="menu-poster-tools"><summary>Danh sách gửi quán</summary><OrderSummaryPanel :orders="menu.orders ?? []" :menu-note="menu.note || ''" :is-closed="!!menu.is_closed" :before-copy="closeOrdering" @reopen="reopenOrdering" /></details>
    <details v-if="menu.poster?.payment_info" class="menu-payment-info"><summary>Thông tin chuyển khoản</summary><p class="meta order-lines">{{ menu.poster.payment_info }}</p></details>
    <aside v-if="structured" class="selection-bar" aria-label="Món đang chọn"><div class="selection-bar__content"><div><p>{{ selectedDishes.length }} món đã chọn</p><strong>{{ !selectedDishes.length ? '0đ' : total === null ? 'Chưa có đủ giá' : `${Number(total).toLocaleString('vi-VN')}đ` }}</strong></div><AppButton variant="ghost" :disabled="menu.is_closed || !canSave" :loading="busy" @click="requestConfirmation">{{ menu.is_closed ? 'Menu đã chốt' : editing ? 'Xem lại thay đổi' : 'Tiếp tục đặt món' }} <span aria-hidden="true">→</span></AppButton></div></aside>
    <AppDialog :open="zoomImage" title="Ảnh thực đơn" @close="zoomImage = false"><img :src="menu.image_url" :alt="menu.title" class="post-image" /></AppDialog>
    <OrderConfirmDialog :open="showConfirm" :menu="menu" :dishes="structured ? selectedDishes : []" :item-text="itemText" :note="note" :recipient-name="recipientName" :total="total" :busy="busy" :error="actionError" :editing="!!editing" @close="!busy && (showConfirm = false)" @confirm="submit"><template #recipient><label v-if="!editing && user" class="field">Đặt cho<select v-model="recipient" class="input" :disabled="busy"><option value="">Cho tôi · {{ user.fullName || 'Tôi' }}</option><option v-for="profile in profiles.filter(p => p.id !== user.id)" :key="profile.id" :value="profile.id">{{ profile.full_name }}</option></select></label></template></OrderConfirmDialog>
    <DishFeedbackDialog :open="!!feedbackDish" :dish="feedbackDish" :restaurant="menu.restaurant" :stats="feedback[`${menu.restaurant_id}:${feedbackDish?.restaurant_dish_id}`]" :reviews="feedbackReviews" :loading="feedbackLoading" :error="feedbackError" @close="closeFeedback" @retry="loadFeedback" />
  </template><SignInModal v-if="showSignIn" @close="showSignIn = false" />
</div></template>
<style scoped>
.menu-page { min-width:0; }.menu-page>.back-link{margin-bottom:16px;}.menu-page :deep(.page-header){margin-bottom:16px;}
.menu-heading-tools { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:24px; }
.menu-personal { border-left:3px solid var(--primary); margin:24px 0; padding:24px; }.menu-personal>.eyebrow{display:block;margin-bottom:4px;}
.menu-order-layout { display:block; margin:24px 0; }
.menu-board-column { min-width:0; }.menu-cart-summary{margin:18px 0;display:grid;gap:16px;}.menu-cart-summary--structured h2{display:none;}.menu-cart-summary h2,.menu-plain h2,.menu-community h2{font-size:21px;line-height:1.35;margin:0;}
.menu-cart-summary .field{margin:0;font-size:14px;gap:7px;}.menu-cart-summary .meta{font-size:12px;margin:0;}.menu-cart-summary textarea{min-height:88px;}
.cart-selected-list{list-style:none;margin:0;padding:0;}.cart-selected-list li{display:flex;align-items:center;gap:12px;justify-content:space-between;padding:13px 0;border-bottom:1px solid var(--line);}.cart-selected-list li>div{min-width:0;display:grid;gap:3px;}.cart-selected-list strong{font-size:14px;overflow-wrap:anywhere;}.cart-selected-list button{width:44px;min-height:44px;flex:none;border:0;border-radius:10px;background:transparent;color:var(--ink-soft);font-size:22px;cursor:pointer;}
.cart-total{display:flex;justify-content:space-between;gap:12px;border-top:1px solid var(--line);padding-top:16px;font-size:15px;}
.menu-plain{padding:24px;}.menu-plain h2{margin-bottom:16px;}.menu-image-button{display:block;width:100%;padding:0;border:0;background:transparent;cursor:zoom-in;}.menu-image-details summary,.menu-poster-tools summary,.menu-payment-info summary{min-height:44px;padding:10px 0;cursor:pointer;font-size:14px;color:var(--ink-soft);}
.menu-community{margin:28px 0 16px;padding:24px;}.menu-community-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;}.menu-community>.meta{margin:8px 0;}
.menu-community-person{display:flex;align-items:flex-start;gap:12px;padding:16px 0;border-bottom:1px solid var(--line);}.menu-community-person>div{flex:1;min-width:0;}.menu-community-person strong{font-size:14px;}.menu-community-person p{font-size:14px;color:var(--ink-soft);margin:4px 0;overflow-wrap:anywhere;}.menu-person-avatar{width:34px;height:34px;flex:0 0 34px;display:grid;place-items:center;border-radius:50%;background:var(--bg-tint);font-size:13px;font-weight:700;}.menu-community-person:last-child{border-bottom:0;}
.menu-closed-note{padding:14px 16px;border:1px solid var(--line);border-radius:12px;background:var(--bg-tint);font-size:14px;margin:20px 0;}
.selection-bar{position:sticky;left:auto;right:auto;bottom:20px;margin-top:24px;z-index:30;border:0;border-radius:17px;background:var(--primary);color:white;padding:16px 20px;box-shadow:var(--shadow-lift);}.selection-bar__content{gap:12px;}.selection-bar p{margin:0;color:white;font-size:13px;}.selection-bar strong{font-size:19px;}.selection-bar :deep(.btn){background:white;color:var(--primary);border-color:white;}
.menu-page button:focus-visible{outline:3px solid var(--primary);outline-offset:3px;}
@media(max-width:700px){.selection-bar{position:fixed;left:12px;right:12px;margin:0;padding:12px 14px;bottom:calc(var(--mobile-nav-height) + 10px + env(safe-area-inset-bottom));}.selection-bar strong{font-size:16px;}.selection-bar :deep(.btn){font-size:13px;padding:10px 14px;}}

@media(max-width:900px){.menu-order-layout{grid-template-columns:1fr;gap:20px;}.menu-cart-summary{position:static;}.menu-personal,.menu-plain,.menu-community,.menu-cart-summary{padding:20px;}.menu-community-person{flex-wrap:wrap;}.menu-community-person :deep(.paid-stamp){margin-left:46px;}}
</style>

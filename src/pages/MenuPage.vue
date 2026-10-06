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
import { formatVNDate } from '../lib/date'
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
const otherOrders = computed(() => (menu.value?.orders ?? []).filter(order => order.user_id !== user.value?.id))
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
<template><div class="stack menu-page" :class="{ 'menu-page--selection': selectedDishes.length && !menu?.is_closed }"><router-link to="/" class="back-link"><AppIcon name="arrow" />Hôm nay</router-link><Spinner v-if="loading" /><EmptyState v-else-if="error" title="Chưa xem được menu" :description="error"><AppButton variant="ghost" @click="load()">Thử lại</AppButton></EmptyState>
  <template v-else-if="menu"><PageHeader :eyebrow="menu.restaurant?.name ? menu.title : 'Chọn món'" :title="menu.restaurant?.name || menu.title" :sub="`${formatVNDate(menu.menu_date)} · ${menu.poster?.full_name || 'Người đăng menu'}`" /><div class="row-wrap"><span class="badge">{{ menu.is_closed ? 'Đã chốt đơn' : 'Đang nhận đơn' }}</span><AppButton variant="ghost" size="sm" @click="copyLink">{{ copied ? 'Đã chép link' : 'Sao chép link' }}</AppButton><AppButton v-if="ownMenu" variant="ghost" size="sm" :to="{path:'/manage',query:{menu_id:menu.id}}">Quản lý menu</AppButton></div>
    <p v-if="savedMessage" class="success-message" role="status">{{ savedMessage }}</p>
    <section v-if="myOrders.length" class="stack-sm personal-lunch" aria-labelledby="my-menu-orders"><h2 id="my-menu-orders" class="section-title">Đơn của tôi <span class="meta">({{ myOrders.length }})</span></h2><OrderCard v-for="order in myOrders" :key="order.id" :order="order" :menu="menu" @changed="orderChanged" /></section>
    <section class="card stack"><details v-if="menu.image_url && structured"><summary>Ảnh thực đơn gốc</summary><button type="button" class="menu-image-button" aria-label="Xem ảnh thực đơn lớn" @click="zoomImage = true"><img :src="menu.image_url" :alt="menu.title" class="post-image" /></button></details><button v-else-if="menu.image_url" type="button" class="menu-image-button" aria-label="Xem ảnh thực đơn lớn" @click="zoomImage = true"><img :src="menu.image_url" :alt="menu.title" class="post-image" /></button><MenuBoard v-if="structured" :note="boardNote" :picks="selected" :disabled="menu.is_closed || busy" :viewers="boardViewers" :feedback="feedback" :restaurant-id="menu.restaurant_id" show-feedback :feedback-state="!menu.restaurant_id ? 'Chưa ghi nhận quán' : !user ? 'Đăng nhập để xem đánh giá' : ratings.length ? '' : feedbackBatchError" @toggle-dish="toggleDish" @feedback="openFeedback" /><p v-else-if="menu.note" class="order-lines" v-html="autolink(menu.note)" /><AppButton v-if="feedbackBatchError" variant="ghost" @click="loadFeedbackBatch">Tải lại đánh giá</AppButton>
      <p v-if="menu.poster?.payment_info" class="meta order-lines">Thông tin chuyển khoản: {{ menu.poster.payment_info }}</p>
    </section>
    <form v-if="!menu.is_closed" id="order-form" ref="orderForm" class="card stack" @submit.prevent="requestConfirmation"><h2 tabindex="-1" class="section-title">{{ editing ? 'Sửa món trong đơn' : 'Món đã chọn' }}</h2><template v-if="structured"><p class="meta">{{ selectedDishes.length ? `${selectedDishes.length} món đã chọn. Kiểm tra ghi chú và người nhận trước khi lưu.` : 'Chọn món ở thực đơn phía trên để bắt đầu.' }}</p><ul v-if="selectedDishes.length" class="selected-dish-list"><li v-for="dish in selectedDishes" :key="dish.name"><span>{{ dish.name }}</span><button type="button" class="selection-remove" :disabled="busy" :aria-label="`Bỏ món ${dish.name}`" @click="toggleDish(dish)">Bỏ</button></li></ul><p v-if="total !== null" class="rating-line">Tổng tiền: {{ Number(total).toLocaleString('vi-VN') }}đ</p><p v-else-if="selectedDishes.length" class="meta">Có món chưa có giá. Xác nhận tiền với người đăng menu.</p></template><label v-else class="field">Món muốn đặt<textarea v-model="itemText" class="textarea" required :disabled="busy" rows="3" /></label><label class="field">Ghi chú (tùy chọn)<input v-model="note" class="input" :disabled="busy" maxlength="1000" placeholder="Ít cơm, không hành…" /></label><label v-if="!editing && user" class="field">Đặt cho<select v-model="recipient" class="input" :disabled="busy"><option value="">Tôi</option><option v-for="profile in profiles.filter(p => p.id !== user.id)" :key="profile.id" :value="profile.id">{{ profile.full_name }}</option></select></label><p v-if="recipient" class="meta">Đơn thuộc về người được đặt hộ; người đó tự đánh dấu đã trả và đánh giá món.</p><p v-if="!user" class="meta">Bạn có thể chọn món trước. Đăng nhập để lưu đơn.</p><p v-if="actionError" class="alert" role="alert">{{ actionError }}</p><div class="row-wrap"><AppButton type="submit" :disabled="!canSave" :loading="busy">{{ !user ? 'Đăng nhập để đặt món' : editing ? 'Xem lại thay đổi' : 'Xem lại đơn' }}</AppButton><AppButton v-if="editing" variant="ghost" :disabled="busy" @click="cancelEdit">Hủy sửa</AppButton></div></form>
    <p v-else class="meta">Menu đã chốt. Bạn vẫn có thể chuyển khoản và đánh giá đơn của mình.</p><p v-if="actionError && menu.is_closed" class="alert" role="alert">{{ actionError }}</p>
    <aside v-if="structured && selectedDishes.length && !menu.is_closed && !formVisible" class="selection-bar" aria-label="Món đang chọn"><div class="selection-bar__content"><div class="stack-sm"><strong>{{ selectedDishes.length }} món đã chọn<span v-if="total !== null"> · {{ Number(total).toLocaleString('vi-VN') }}đ</span></strong><span class="meta">{{ editing ? 'Kiểm tra thay đổi trước khi lưu' : 'Chưa lưu đơn · Kiểm tra ghi chú và người nhận' }}</span></div><AppButton :disabled="busy" @click="reviewSelection">Tiếp tục</AppButton></div></aside>
    <OrderSummaryPanel v-if="ownMenu" :orders="menu.orders ?? []" :menu-note="menu.note || ''" :is-closed="!!menu.is_closed" :before-copy="closeOrdering" @reopen="reopenOrdering" />
    <section class="stack-sm"><h2 class="section-title">Đơn của mọi người <span class="meta">({{ otherOrders.length }})</span></h2><article v-for="order in otherOrders" :key="order.id" class="card stack-sm"><div class="row-wrap"><strong>{{ order.user?.full_name || 'Chưa đặt tên' }}</strong><PaidStamp class="spacer" :paid="order.is_paid" /></div><p class="order-lines">{{ order.item_text }}</p><p v-if="order.note" class="meta">{{ order.note }}</p></article><p v-if="!otherOrders.length" class="meta">Chưa có đơn của người khác.</p></section>
  <AppDialog :open="zoomImage" title="Ảnh thực đơn" @close="zoomImage = false"><img :src="menu.image_url" :alt="menu.title" class="post-image" /></AppDialog>
  <OrderConfirmDialog :open="showConfirm" :menu="menu" :dishes="structured ? selectedDishes : []" :item-text="itemText" :note="note" :recipient-name="recipientName" :total="total" :busy="busy" :error="actionError" :editing="!!editing" @close="!busy && (showConfirm = false)" @confirm="submit" />
    <DishFeedbackDialog :open="!!feedbackDish" :dish="feedbackDish" :restaurant="menu.restaurant" :stats="feedback[`${menu.restaurant_id}:${feedbackDish?.restaurant_dish_id}`]" :reviews="feedbackReviews" :loading="feedbackLoading" :error="feedbackError" @close="closeFeedback" @retry="loadFeedback" />
  </template><SignInModal v-if="showSignIn" @close="showSignIn = false" />
</div></template>

<style scoped>
.menu-image-button { display:block; width:100%; padding:0; border:0; background:transparent; cursor:zoom-in; }
.menu-image-button:focus-visible { outline:3px solid var(--primary); outline-offset:3px; }
.menu-page .rating-line { color:var(--ink); }
</style>

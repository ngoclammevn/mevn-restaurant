<script setup>
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import { useUser } from '@clerk/vue'
import { useRoute } from 'vue-router'
import { useMenus } from '../composables/useMenus'
import { useOrders } from '../composables/useOrders'
import { useAppPresence } from '../composables/useAppPresence'
import { exportMenuCsv, menuDishes, parseMenuNote, serializeMenu } from '../lib/menu'
import { summarizeManagedMenu } from '../lib/manage-summary'
import { todayInVN, formatVNDate } from '../lib/date'
import { PageHeader, AppButton, Spinner, EmptyState, SignInModal, OrderSummaryPanel, AppDialog, FormErrorSummary } from '../components/ui'
import MenuEditor from '../components/MenuEditor.vue'
import ManageDishTable from '../components/ManageDishTable.vue'
import ManagePayments from '../components/ManagePayments.vue'
import OutstandingLedger from '../components/OutstandingLedger.vue'
import OrderOnBehalfDialog from '../components/OrderOnBehalfDialog.vue'
const props = defineProps({ initialWorkspace:{type:String,default:'today'}, initialTab:{type:String,default:'dish'}, todayOnly:Boolean })
const { user, isSignedIn } = useUser(), route = useRoute()
const { listPostedMenus, listPostedUnpaidOrders, getMenu, setMenuClosed, deleteMenu, updateMenu } = useMenus()
const { listProfiles, createOrder } = useOrders()
const presence = useAppPresence()
const workspace = ref(props.initialWorkspace), menus = ref([]), menuCount = ref(null), loading = ref(false), error = ref(''), selectedId = ref(String(route.query.menu_id || '')), date = ref(todayInVN()), tab = ref('dish'), paidFilter = ref('all'), showSignIn = ref(false), busy = ref(''), copied = ref(''), editing = ref(null)
const archiveFrom = ref(''), archiveTo = ref(''), archiveStatus = ref('all'), archiveSearch = ref('')
const ledger = ref([]), ledgerCount = ref(null), ledgerLoading = ref(false), ledgerError = ref(''), period = ref('all'), loadedPeriod = ref('all')
const profiles = ref([]), delegateOpen = ref(false), delegateError = ref(''), delegateBusy = ref(false)
const dishDialog = ref(false), dish = ref(null), dishName = ref(''), dishPrice = ref(''), dishErrors = ref([]), dishErrorSummary = ref(null)
let generation = 0, ledgerGeneration = 0, delegateGeneration = 0
const activeMenu = computed(() => menus.value.find(menu => menu.id === selectedId.value) || menus.value[0] || null)
const summary = computed(() => summarizeManagedMenu(activeMenu.value))
const unpaidSummary = computed(() => summarizeManagedMenu({...activeMenu.value,orders:(activeMenu.value?.orders || []).filter(order=>!order.is_paid)}))
const visibleMenus = computed(() => menus.value.filter(menu => `${menu.title} ${menu.restaurant?.name || ''}`.toLocaleLowerCase('vi').includes(archiveSearch.value.toLocaleLowerCase('vi'))))
const menusMore = computed(() => menuCount.value !== null && menus.value.length < menuCount.value)
const ledgerMore = computed(() => ledgerCount.value !== null && ledger.value.length < ledgerCount.value)
const orderedDish = computed(() => dish.value && summary.value.orderedDishes.find(row => dish.value.id ? row.menuItemId === dish.value.id : row.name === dish.value.name))
const money = value => value == null ? 'Chưa có giá' : new Intl.NumberFormat('vi-VN').format(value) + 'đ'
function shiftDay(value, days) { const date = new Date(value + 'T00:00:00Z'); date.setUTCDate(date.getUTCDate()+days); return date.toISOString().slice(0,10) }
function ledgerRange() {
  const today = todayInVN(), start = shiftDay(today,-30)
  return period.value === 'today' ? {from:today,to:today} : period.value === 'recent' ? {from:start,to:shiftDay(today,-1)} : period.value === 'older' ? {to:shiftDay(start,-1)} : {}
}
async function loadMenus(more = false) {
  const current = ++generation, account = user.value?.id
  if (!account || workspace.value === 'ledger') return
  loading.value = true; error.value = ''
  try {
    const range = workspace.value === 'today' ? {from:date.value,to:date.value} : {from:archiveFrom.value || undefined,to:archiveTo.value || undefined,status:archiveStatus.value}
    if (range.from && range.to && range.from > range.to) throw new Error('invalid_range')
    const result = await listPostedMenus({...range, offset:more ? menus.value.length : 0})
    if (current !== generation || user.value?.id !== account) return
    if (result.error) throw result.error
    menus.value = more ? [...menus.value,...(result.data || [])] : result.data || []; menuCount.value = result.count ?? (menus.value.length + (result.data?.length === 50 ? 1 : 0))
    if (!menus.value.some(menu => menu.id === selectedId.value)) selectedId.value = menus.value[0]?.id || ''
  } catch { if (current === generation) error.value = 'Chưa tải được menu. Kiểm tra khoảng ngày rồi thử lại.' }
  finally { if (current === generation) loading.value = false }
}
async function loadLedger(more = false) {
  const current = ++ledgerGeneration, account = user.value?.id
  if (!account) return
  ledgerLoading.value = true; ledgerError.value = ''
  try {
    const result = await listPostedUnpaidOrders({...ledgerRange(),offset:more ? ledger.value.length : 0})
    if (current !== ledgerGeneration || user.value?.id !== account) return
    if (result.error) throw result.error
    ledger.value = more ? [...ledger.value,...(result.data || [])] : result.data || []; ledgerCount.value = result.count ?? (ledger.value.length + (result.data?.length === 100 ? 1 : 0)); loadedPeriod.value = period.value
  } catch { if (current === ledgerGeneration) ledgerError.value = 'Chưa tải được các khoản chưa trả. Phần đã tải vẫn được giữ.' }
  finally { if (current === ledgerGeneration) ledgerLoading.value = false }
}
async function openMenu(id) {
  if (busy.value) return
  const account = user.value?.id, current = ++generation
  busy.value = id; error.value = ''
  try {
    const result = await getMenu(id)
    if (current !== generation || user.value?.id !== account) return
    if (result.error || result.data?.poster_id !== account) throw result.error || new Error('ownership')
    date.value = result.data.menu_date; workspace.value = 'today'; selectedId.value = id
    await loadMenus()
  } catch { if (current === generation) error.value = 'Chưa mở được menu của bạn.' }
  finally { if (user.value?.id === account) busy.value = '' }
}
watch(() => user.value?.id, async () => {
  generation++; ledgerGeneration++; delegateGeneration++; menus.value=[]; ledger.value=[]; editing.value=null; dishDialog.value=false; delegateOpen.value=false; busy.value=''; loading.value=false; ledgerLoading.value=false; delegateBusy.value=false
  if (!user.value) return
  if (workspace.value === 'ledger') await loadLedger()
  else if (route.query.menu_id) await openMenu(String(route.query.menu_id))
  else await loadMenus()
}, {immediate:true})
watch(() => route.query.menu_id, id => { if (!user.value) return; if (workspace.value === 'ledger') loadLedger(); else if (id) openMenu(String(id)) })
watch([archiveFrom,archiveTo,archiveStatus], () => { if (workspace.value === 'archive') loadMenus() })
function switchWorkspace(value) {
  if (busy.value || delegateBusy.value || dishDialog.value || editing.value) return
  workspace.value=value; generation++; ledgerGeneration++
  if (value === 'ledger') loadLedger()
  else { if (value === 'today') { date.value=todayInVN(); menus.value=[]; menuCount.value=null } loadMenus() }
}
function changePeriod(value) { if (period.value === value) return; period.value=value; loadLedger() }
async function refreshMenu() {
  const id=activeMenu.value?.id, account=user.value?.id
  if (!id) return
  const result=await getMenu(id)
  if (result.error || user.value?.id !== account || result.data?.poster_id !== account) return
  const index=menus.value.findIndex(menu => menu.id === id)
  if (index >= 0) menus.value[index]=result.data
}
const unsubscribe=presence.onOrderChanged(id => { if (activeMenu.value?.id === id && !busy.value) refreshMenu(); if (workspace.value === 'ledger') loadLedger() })
onUnmounted(() => { generation++; ledgerGeneration++; delegateGeneration++; unsubscribe() })
async function closed(menu,value) {
  if (menu.is_closed === value) return true
  if (busy.value || !confirm(value ? 'Chốt đơn? Mọi người sẽ không thêm hoặc sửa món cho đến khi bạn mở lại.' : 'Mở lại menu để mọi người thêm và sửa món?')) return false
  const account=user.value?.id; busy.value=menu.id; error.value=''
  try {
    const result=await setMenuClosed(menu.id,value)
    if (user.value?.id !== account) return false
    if (result.error || !result.data) throw result.error || new Error('missing')
    const index=menus.value.findIndex(m => m.id === menu.id); if (index>=0) menus.value[index]=result.data
    Object.assign(menu,result.data); await nextTick(); presence.notifyOrderChanged(menu.id); return true
  } catch { if (user.value?.id === account) error.value='Chưa cập nhật được trạng thái menu.'; return false }
  finally { if (user.value?.id === account) busy.value='' }
}
async function removeMenu(menu) {
  if (busy.value) return
  const account=user.value?.id; busy.value=menu.id; error.value=''
  try {
    const fresh=await getMenu(menu.id)
    if (user.value?.id !== account) return
    if (fresh.error || fresh.data?.poster_id !== account) throw fresh.error || new Error('ownership')
    if ((fresh.data.orders || []).some(order=>!order.is_paid)) { error.value='Menu còn đơn chưa trả. Theo dõi tại Tiền chưa thu trước khi xóa.'; return }
    const reviewCount=(fresh.data.orders || []).reduce((sum,order)=>sum+(order.order_items || []).filter(item=>Array.isArray(item.review) ? item.review.length : item.review).length,0)
    if (!confirm(`Xóa menu “${fresh.data.title}”, ${fresh.data.orders?.length || 0} đơn và ${reviewCount} đánh giá đi kèm?`)) return
    const result=await deleteMenu(menu.id,fresh.data.image_url)
    if (user.value?.id !== account) return
    if (result.error) throw result.error
    menus.value=menus.value.filter(m=>m.id!==menu.id); menuCount.value=Math.max(0,(menuCount.value || 1)-1); presence.notifyOrderChanged(menu.id)
  } catch { if (user.value?.id === account) error.value='Chưa xóa được menu. Menu và các đơn vẫn được giữ.' }
  finally { if (user.value?.id === account) busy.value='' }
}
async function copyLink(menu) { try { await navigator.clipboard.writeText(`${location.origin}/share/${menu.id}`); copied.value=menu.id } catch { error.value='Chưa sao chép được đường dẫn. Mở menu để sao chép từ thanh địa chỉ.' } }
function csv(menu) { const url=URL.createObjectURL(new Blob([exportMenuCsv(menu)],{type:'text/csv;charset=utf-8'})); const anchor=document.createElement('a'); anchor.href=url; anchor.download=`don-com-${menu.menu_date}-${menu.id}.csv`; anchor.click(); setTimeout(()=>URL.revokeObjectURL(url),1000) }
function openDish(value=null) {
  if (busy.value || activeMenu.value?.is_closed) return
  dish.value=value; dishName.value=value?.name || ''; dishPrice.value=value?.price ?? ''; dishErrors.value=[]; dishDialog.value=true
}
function closeDish() { if (busy.value) return; if ((dishName.value !== (dish.value?.name || '') || String(dishPrice.value) !== String(dish.value?.price ?? '')) && !confirm('Bỏ thay đổi món chưa lưu?')) return; dishDialog.value=false }
async function saveDishes(dishes) {
  const menu=activeMenu.value, account=user.value?.id
  if (!menu || menu.is_closed || busy.value || menu.poster_id !== account) return false
  busy.value=menu.id; error.value=''
  try {
    const result=await updateMenu({id:menu.id,note:serializeMenu(dishes,parseMenuNote(menu.note)?.notes ?? menu.note ?? '')})
    if (user.value?.id !== account) return false
    if (result.error) throw result.error
    await refreshMenu(); presence.notifyOrderChanged(menu.id); return true
  } catch { if (user.value?.id === account) error.value='Chưa lưu được món. Giữ nguyên tên và liên kết của món đã có đơn, rồi thử lại.'; return false }
  finally { if (user.value?.id === account) busy.value='' }
}
async function saveDish() {
  const name=dishName.value.trim(), price=dishPrice.value === '' ? null : Number(dishPrice.value), dishes=menuDishes(activeMenu.value)
  dishErrors.value=[]
  if (!name) dishErrors.value.push({fieldId:'manage-dish-name',message:'Nhập tên món.'})
  if (price !== null && (!Number.isInteger(price) || price < 0 || price > 100000000)) dishErrors.value.push({fieldId:'manage-dish-price',message:'Giá phải là số nguyên từ 0 đến 100.000.000 đồng hoặc để trống.'})
  if (dishes.some(d => (dish.value?.id ? d.id !== dish.value.id : d.name !== dish.value?.name) && d.name.toLocaleLowerCase('vi') === name.toLocaleLowerCase('vi'))) dishErrors.value.push({fieldId:'manage-dish-name',message:'Menu đã có món tên này.'})
  if (dishErrors.value.length) { await nextTick(); dishErrorSummary.value?.focus(); return }
  if (orderedDish.value?.servings && dish.value.price !== price && !confirm(`Giá mới thay đổi tiền của ${orderedDish.value.people.length} đơn có món này, kể cả đơn đã trả. Trạng thái đã trả giữ nguyên. Cập nhật giá?`)) return
  const changed=dish.value ? dishes.map(d => (dish.value.id ? d.id === dish.value.id : d.name === dish.value.name) ? {...d,name:orderedDish.value?.servings ? d.name : name,price} : d) : [...dishes,{name,price,available:true}]
  if (await saveDishes(changed)) dishDialog.value=false
}
async function removeDish(value) {
  const dishes=menuDishes(activeMenu.value), row=summary.value.orderedDishes.find(r=>value.id ? r.menuItemId===value.id : r.name===value.name)
  if (row?.servings) { error.value='Món đã có người đặt. Bạn có thể báo hết món.'; return }
  if (dishes.length<=1) { error.value='Menu cần ít nhất một món. Thêm món mới trước khi xóa món cuối.'; return }
  if (!confirm(`Xóa món “${value.name}” chưa có người đặt?`)) return
  await saveDishes(dishes.filter(d=>value.id ? d.id!==value.id : d.name!==value.name))
}
async function availability(value,available) { await saveDishes(menuDishes(activeMenu.value).map(d=>(value.id ? d.id===value.id : d.name===value.name) ? {...d,available} : d)) }
async function openDelegate() {
  if (busy.value || activeMenu.value?.is_closed) return
  const current=++delegateGeneration, account=user.value?.id
  delegateError.value=''; busy.value=activeMenu.value.id
  try { const result=await listProfiles(); if (current!==delegateGeneration || user.value?.id!==account) return; if(result.error) throw result.error; profiles.value=result.data || []; delegateOpen.value=true }
  catch { if (current===delegateGeneration) error.value='Chưa tải được danh sách người nhận đơn.' }
  finally { if (current===delegateGeneration) busy.value='' }
}
async function delegate(payload) {
  const menu=activeMenu.value, account=user.value?.id, current=delegateGeneration
  if (!menu || menu.is_closed || delegateBusy.value) return
  if ((menu.orders || []).some(o=>o.user_id===payload.user_id)) { delegateError.value='Người này đã có đơn. Liên hệ chính họ để sửa đơn.'; return }
  delegateBusy.value=true; delegateError.value=''
  try { const result=await createOrder({menu_id:menu.id,...payload}); if(current!==delegateGeneration || user.value?.id!==account) return; if(result.error) throw result.error; delegateOpen.value=false; await refreshMenu(); presence.notifyOrderChanged(menu.id) }
  catch { if(current===delegateGeneration) delegateError.value='Chưa đặt được. Người nhận có thể vừa đặt hoặc menu vừa chốt. Nháp vẫn được giữ.' }
  finally { if(current===delegateGeneration) delegateBusy.value=false }
}
async function savedEditor() { editing.value=null; await refreshMenu(); presence.notifyOrderChanged(activeMenu.value.id) }
</script>
<template><div class="manage-page"><PageHeader eyebrow="Menu bạn đăng" title="Quản lý" sub="Số suất, đơn đặt và tiền cần thu." /><EmptyState v-if="!isSignedIn" title="Đăng nhập để quản lý menu"><AppButton @click="showSignIn=true">Đăng nhập</AppButton></EmptyState><template v-else><div class="workspace-tabs" role="group" aria-label="Khu quản lý"><button v-for="option in [{id:'today',name:'Hôm nay'},{id:'ledger',name:'Tiền chưa thu'},{id:'archive',name:'Menu đã đăng'}]" :key="option.id" type="button" :aria-pressed="workspace===option.id" :disabled="!!busy || delegateBusy || dishDialog || !!editing" @click="switchWorkspace(option.id)">{{ option.name }}</button></div><p v-if="error" class="alert" role="alert">{{ error }} <AppButton variant="ghost" @click="loadMenus()">Thử lại</AppButton></p>
<OutstandingLedger v-if="workspace==='ledger'" :orders="ledger" :period="period" :loading="ledgerLoading" :error="ledgerError" :has-more="ledgerMore" :total-count="ledgerCount" :stale="loadedPeriod !== period" :menu-id="String(route.query.menu_id || '')" @period-change="changePeriod" @load-more="loadLedger(true)" @retry="loadLedger(loadedPeriod === period && !!ledger.length)" @open-menu="openMenu" />
<template v-else-if="workspace==='today'">
  <div class="manage-toolbar"><div class="menu-selector"><label class="field">Menu đang xem<select v-model="selectedId" class="input" :disabled="loading || !!busy || delegateOpen || dishDialog || !!editing"><option v-if="!menus.length" value="">Chưa có menu</option><option v-for="menu in menus" :key="menu.id" :value="menu.id">{{ menu.restaurant?.name || menu.title }} · {{ formatVNDate(menu.menu_date) }}</option></select></label><details class="day-picker"><summary>Chọn ngày khác</summary><label class="field">Ngày ăn<input v-model="date" type="date" class="input" :disabled="!!busy || dishDialog || !!editing" @change="loadMenus()" /></label></details></div><div v-if="activeMenu" class="manage-actions"><AppButton variant="ghost" :disabled="loading || !!busy || activeMenu.is_closed || delegateOpen || dishDialog || !!editing" @click="openDelegate">Đặt hộ</AppButton><AppButton :variant="activeMenu.is_closed ? 'ghost' : 'primary'" :loading="busy===activeMenu.id" :disabled="loading || !!busy || delegateOpen || dishDialog || !!editing" @click="closed(activeMenu,!activeMenu.is_closed)">{{ activeMenu.is_closed ? 'Mở nhận đơn' : 'Chốt đơn' }}</AppButton></div></div>
  <p v-if="date!==todayInVN()" class="date-note">Bạn đang xem riêng menu ngày {{ formatVNDate(date) }}. Các khoản chưa thu nằm ở tab Tiền chưa thu.</p><p v-if="loading && menus.length" class="date-note" role="status">Đang cập nhật menu…</p><Spinner v-if="loading && !menus.length" /><EmptyState v-else-if="!activeMenu" title="Chưa đăng menu ngày này"><AppButton to="/post">Đăng menu</AppButton></EmptyState>
  <template v-else><div class="summary-grid"><div class="manage-stat"><span>Suất đã đặt</span><strong>{{ summary.servings }}</strong><small>{{ activeMenu.orders?.length || 0 }} đơn</small></div><div class="manage-stat"><span>Món được chọn</span><strong>{{ summary.orderedDishCount }}</strong></div><div class="manage-stat"><span>Tổng tiền đơn</span><strong>{{ money(summary.knownTotal) }}</strong><small v-if="summary.unknownPriceCount">đã biết · {{ summary.unknownPriceCount }} suất chưa có giá</small></div><div class="manage-stat"><span>Chưa thu</span><strong>{{ money(unpaidSummary.knownTotal) }}</strong><small>{{ summary.unpaidCount }} người / đơn<span v-if="unpaidSummary.unknownPriceCount"> · {{ unpaidSummary.unknownPriceCount }} suất chưa có giá</span></small></div></div>
    <section class="card manage-card" :aria-busy="loading"><div class="manage-toolbar"><div><h2>{{ activeMenu.restaurant?.name || activeMenu.title }}</h2><p class="meta">{{ formatVNDate(activeMenu.menu_date) }} · {{ activeMenu.is_closed ? 'Đã chốt đơn' : 'Đang nhận đơn' }}</p></div><AppButton variant="ghost" :disabled="loading || !!busy || activeMenu.is_closed || !!editing" @click="openDish()">+ Thêm món</AppButton></div><div class="manage-filters" role="group" aria-label="Cách xem đơn"><AppButton variant="ghost" :aria-pressed="tab==='dish'" @click="tab='dish'">Theo món</AppButton><AppButton variant="ghost" :aria-pressed="tab==='person'" @click="tab='person'">Theo người</AppButton><details class="menu-tools"><summary>Thao tác menu</summary><div class="manage-actions"><AppButton variant="ghost" :to="`/menu/${activeMenu.id}`">Xem menu</AppButton><AppButton variant="ghost" :disabled="loading || !!busy || activeMenu.is_closed || delegateOpen || dishDialog" @click="editing=activeMenu">Sửa nội dung menu</AppButton></div></details></div><MenuEditor v-if="editing?.id===activeMenu.id" :menu="editing" @saved="savedEditor" @cancel="editing=null" /><ManageDishTable v-if="tab==='dish'" :menu="activeMenu" :summary="summary" :busy="loading || !!busy || !!editing" @edit="openDish" @remove="removeDish" @availability="availability" /><template v-else><div class="manage-filters" role="group" aria-label="Lọc thanh toán"><AppButton v-for="option in [{id:'all',name:'Tất cả'},{id:'paid',name:'Đã trả'},{id:'unpaid',name:'Chưa trả'}]" :key="option.id" variant="ghost" :aria-pressed="paidFilter===option.id" @click="paidFilter=option.id">{{ option.name }}</AppButton></div><ManagePayments :orders="activeMenu.orders || []" :menu="activeMenu" :filter="paidFilter" /></template></section>
    <p class="manage-quiet">Số suất tự tổng hợp từ đơn đã đặt. Thêm/sửa/xóa ở đây áp dụng cho món trong menu, không sửa đơn của người khác.</p><OrderSummaryPanel v-if="tab==='dish'" class="buy-list" :orders="activeMenu.orders || []" :menu-note="activeMenu.note || ''" :is-closed="!!activeMenu.is_closed" :before-copy="() => !loading && !busy && !editing && closed(activeMenu,true)" @reopen="closed(activeMenu,false)" />
  </template><AppButton v-if="menusMore" variant="ghost" :loading="loading" @click="loadMenus(true)">Tải thêm menu</AppButton>
</template>
<template v-else><div class="manage-toolbar archive-heading"><h2>Menu đã đăng</h2><AppButton to="/post">+ Đăng menu</AppButton></div><section class="archive-controls"><div class="archive-filters"><label class="field">Từ ngày<input v-model="archiveFrom" type="date" class="input" /></label><label class="field">Đến ngày<input v-model="archiveTo" type="date" class="input" /></label><label class="field">Trạng thái<select v-model="archiveStatus" class="input"><option value="all">Tất cả</option><option value="open">Đang nhận đơn</option><option value="closed">Đã chốt</option></select></label></div><label class="field">Tìm menu<input v-model="archiveSearch" type="search" class="input" /></label><p class="meta">{{ menus.length }}{{ menuCount != null ? ' / '+menuCount : '' }} menu đã tải{{ menusMore ? ' · Tìm kiếm trong phần đã tải' : '' }}<span v-if="loading"> · Đang cập nhật…</span></p></section><Spinner v-if="loading && !menus.length" /><EmptyState v-else-if="!visibleMenus.length" title="Chưa có menu phù hợp" /><article v-for="menu in visibleMenus" :key="menu.id" class="card stack-sm"><div class="row-wrap"><div><h2 class="section-title">{{ menu.restaurant?.name || menu.title }}</h2><p class="meta">{{ formatVNDate(menu.menu_date) }} · {{ menu.orders?.length || 0 }} đơn · {{ menuDishes(menu).length }} món</p></div><span class="menu-state">{{ menu.is_closed ? 'Đã chốt' : 'Đang nhận đơn' }}</span></div><div class="archive-open-row"><p class="meta">Xem các khoản chưa trả tại Tiền chưa thu</p><AppButton variant="ghost" :disabled="loading || !!busy" @click="openMenu(menu.id)">Mở menu quản lý</AppButton></div><details class="archive-more"><summary>Thao tác khác</summary><div class="row-wrap"><AppButton variant="ghost" :disabled="loading || !!busy" @click="closed(menu,!menu.is_closed)">{{ menu.is_closed ? 'Mở lại' : 'Chốt đơn' }}</AppButton><AppButton variant="ghost" :to="{path:'/post',query:{reuse:menu.id}}">Dùng lại</AppButton><AppButton variant="ghost" @click="csv(menu)">CSV</AppButton><AppButton variant="ghost" @click="copyLink(menu)">{{ copied===menu.id ? 'Đã chép link' : 'Chia sẻ' }}</AppButton><AppButton variant="ghost" :disabled="loading || !!busy" @click="removeMenu(menu)">Xóa menu</AppButton></div></details></article><AppButton v-if="menusMore" variant="ghost" :loading="loading" @click="loadMenus(true)">Tải thêm menu</AppButton></template></template>
<AppDialog :open="dishDialog" :title="dish ? 'Sửa món' : 'Thêm món'" @close="closeDish"><form id="manage-dish-form" class="stack" novalidate @submit.prevent="saveDish"><FormErrorSummary ref="dishErrorSummary" :errors="dishErrors" /><label class="field">Tên món<input id="manage-dish-name" v-model="dishName" class="input" :aria-invalid="dishErrors.some(e=>e.fieldId==='manage-dish-name')" maxlength="240" :readonly="!!orderedDish?.servings" :disabled="!!busy" /><span v-for="entry in dishErrors.filter(e=>e.fieldId==='manage-dish-name')" :key="entry.message" class="field-error">{{ entry.message }}</span></label><p v-if="orderedDish?.servings" class="meta">Món đã có người đặt. Giữ nguyên tên và liên kết; bạn có thể sửa giá hoặc báo hết món.</p><label class="field">Giá / suất (đồng)<input id="manage-dish-price" v-model="dishPrice" class="input" :aria-invalid="dishErrors.some(e=>e.fieldId==='manage-dish-price')" type="number" min="0" step="1" :disabled="!!busy" placeholder="Có thể để trống" /><span v-for="entry in dishErrors.filter(e=>e.fieldId==='manage-dish-price')" :key="entry.message" class="field-error">{{ entry.message }}</span></label><p class="meta">Tiền các đơn được tính theo giá hiện có trong menu.</p><p v-if="error" class="alert" role="alert">{{ error }}</p></form><template #footer><AppButton variant="ghost" :disabled="!!busy" @click="closeDish">Hủy</AppButton><AppButton type="submit" form="manage-dish-form" :loading="!!busy">{{ dish ? 'Lưu thay đổi' : 'Thêm món' }}</AppButton></template></AppDialog><OrderOnBehalfDialog :open="delegateOpen" :menu="activeMenu" :profiles="profiles" :busy="delegateBusy" :error="delegateError" @close="delegateOpen=false" @submit="delegate" /><SignInModal v-if="showSignIn" @close="showSignIn=false" /></div></template>
<style scoped>.archive-heading h2{font-size:22px;margin:0}.archive-controls{display:grid;gap:14px;margin:18px 0}.archive-open-row{display:flex;align-items:center;justify-content:space-between;gap:13px;flex-wrap:wrap;margin-top:18px}.archive-more{border-top:1px solid var(--line);margin-top:12px}.archive-more summary{min-height:44px;align-content:center;font-size:12px;color:var(--muted);cursor:pointer}.archive-more .row-wrap{padding:8px 0}.menu-state{display:inline-flex;padding:4px 8px;border-radius:7px;font-size:11px;font-weight:650;background:var(--bg-tint);color:var(--muted);white-space:nowrap}
.field-error{color:var(--unpaid-ink);font-size:13px}.workspace-tabs{display:flex;gap:20px;border-bottom:1px solid var(--line);margin:20px 0 27px}.workspace-tabs button{padding:11px 0;border:0;border-radius:0;background:none;min-height:46px;color:var(--muted);font-weight:650;font-size:14px;cursor:pointer}.workspace-tabs button[aria-pressed=true]{color:var(--ink);border-bottom:2px solid var(--ink)}.manage-toolbar{display:flex;align-items:center;justify-content:space-between;gap:13px;flex-wrap:wrap}.menu-selector{min-width:230px;max-width:440px;flex:0 1 440px}.manage-actions{display:flex;gap:8px;flex-wrap:wrap}.manage-page :deep(.btn){min-height:44px;padding:10px 13px;font-size:13px;border-radius:12px}.manage-page .field{font-size:13px;font-weight:650;gap:7px}.manage-page .input{min-height:46px;font-size:14px;padding:11px 12px;border-radius:12px}.day-picker{position:relative}.day-picker summary{min-height:30px;align-content:center;cursor:pointer;font-size:12px;color:var(--muted)}.day-picker .field{max-width:260px;margin:8px 0}.summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:20px 0}.manage-stat{padding:18px;border:1px solid var(--line);border-radius:13px;background:var(--card);min-width:0}.manage-stat span{font-size:12px;color:var(--muted)}.manage-stat strong{font-size:25px;line-height:1.4;display:block;margin-top:6px;overflow-wrap:anywhere}.manage-stat small{font-size:12px;color:var(--muted);line-height:1.6;display:block}.manage-card{padding:22px}.manage-card h2{font-size:21px;line-height:1.35;margin:0}.manage-card .meta{font-size:13px;margin:7px 0;line-height:1.6}.manage-filters{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0}.manage-filters :deep([aria-pressed=true]){border-color:var(--ink);font-weight:700;background:var(--bg-tint)}.menu-tools{margin-left:auto;max-width:100%}.menu-tools summary{min-height:44px;align-content:center;cursor:pointer;font-size:12px;color:var(--muted)}.menu-tools[open]{flex-basis:100%}.date-note,.manage-quiet{font-size:12px;color:var(--muted);line-height:1.7;margin-top:16px}.buy-list{margin-top:20px}.archive-filters{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px}.manage-page>article{margin:16px 0}.manage-page>section{margin:18px 0}.manage-page>article.card{padding:22px}.manage-page>article .section-title{font-size:19px}.manage-page>article .meta{font-size:13px}.manage-page>article .row-wrap{justify-content:space-between}@media(max-width:640px){.summary-grid{grid-template-columns:1fr 1fr;gap:9px}.manage-stat{padding:14px}.manage-stat strong{font-size:23px}.workspace-tabs{gap:17px}.workspace-tabs button{font-size:13px;white-space:nowrap}.manage-card{padding:19px}.menu-selector{width:100%;min-width:0;max-width:none;flex-basis:100%}.manage-page .input{font-size:16px}.archive-filters{grid-template-columns:1fr}.manage-filters{gap:7px}.manage-filters :deep(.btn){font-size:12px;padding:9px 10px}.manage-actions :deep(.btn){flex:1}.manage-page>article.card{padding:19px}}
</style>

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
<template><div class="stack manage-page"><div class="row-wrap"><PageHeader title="Quản lý" /><AppButton class="spacer" to="/post">Đăng menu</AppButton></div><EmptyState v-if="!isSignedIn" title="Đăng nhập để quản lý menu"><AppButton @click="showSignIn=true">Đăng nhập</AppButton></EmptyState><template v-else><div class="workspace-tabs" role="group" aria-label="Khu quản lý"><button v-for="option in [{id:'today',name:'Hôm nay'},{id:'ledger',name:'Tiền chưa thu'},{id:'archive',name:'Menu đã đăng'}]" :key="option.id" type="button" :aria-pressed="workspace===option.id" :disabled="!!busy || delegateBusy || dishDialog || !!editing" @click="switchWorkspace(option.id)">{{ option.name }}</button></div><p v-if="error" class="alert" role="alert">{{ error }} <AppButton variant="ghost" @click="loadMenus()">Thử lại</AppButton></p>
<OutstandingLedger v-if="workspace==='ledger'" :orders="ledger" :period="period" :loading="ledgerLoading" :error="ledgerError" :has-more="ledgerMore" :total-count="ledgerCount" :stale="loadedPeriod !== period" :menu-id="String(route.query.menu_id || '')" @period-change="changePeriod" @load-more="loadLedger(true)" @retry="loadLedger(loadedPeriod === period && !!ledger.length)" @open-menu="openMenu" />
<template v-else-if="workspace==='today'"><section class="card stack-sm"><div class="manage-filters"><label class="field">Ngày<input v-model="date" type="date" class="input" :disabled="!!busy || dishDialog || !!editing" @change="loadMenus()" /></label><label class="field">Menu<select v-model="selectedId" class="input" :disabled="loading || !!busy || delegateOpen || dishDialog || !!editing"><option v-for="menu in menus" :key="menu.id" :value="menu.id">{{ menu.restaurant?.name || menu.title }}</option></select></label></div><p class="meta">{{ formatVNDate(date) }} · {{ menus.length }} menu của bạn<span v-if="loading"> · Đang cập nhật…</span></p></section><Spinner v-if="loading && !menus.length" /><EmptyState v-else-if="!activeMenu" title="Chưa đăng menu ngày này"><AppButton to="/post">Đăng menu</AppButton></EmptyState><article v-else class="card stack" :aria-busy="loading"><div class="row-wrap"><div><h2 class="section-title">{{ activeMenu.restaurant?.name || activeMenu.title }}</h2><p class="meta">{{ formatVNDate(activeMenu.menu_date) }} · {{ activeMenu.is_closed ? 'Đã chốt' : 'Đang nhận đơn' }}</p></div><AppButton class="spacer" variant="ghost" :loading="busy===activeMenu.id" :disabled="loading || !!busy || delegateOpen || dishDialog || !!editing" @click="closed(activeMenu,!activeMenu.is_closed)">{{ activeMenu.is_closed ? 'Mở lại' : 'Chốt đơn' }}</AppButton><AppButton variant="ghost" :to="`/menu/${activeMenu.id}`">Xem menu</AppButton></div><div class="summary-grid"><div><strong>{{ summary.servings }}</strong><span>suất</span></div><div><strong>{{ summary.orderedDishCount }}</strong><span>món đã đặt</span></div><div><strong>{{ money(summary.knownTotal) }}</strong><span>{{ summary.unknownPriceCount ? 'đã biết · ' + summary.unknownPriceCount + ' suất chưa có giá' : 'tổng tiền' }}</span></div><div><strong>{{ summary.paidCount }} / {{ activeMenu.orders?.length || 0 }}</strong><span>đã trả · {{ summary.unpaidCount }} chưa trả</span></div></div><div class="row-wrap"><AppButton variant="ghost" :aria-pressed="tab==='dish'" @click="tab='dish'">Theo món</AppButton><AppButton variant="ghost" :aria-pressed="tab==='person'" @click="tab='person'">Theo người</AppButton><AppButton variant="ghost" class="spacer" :disabled="loading || !!busy || activeMenu.is_closed || delegateOpen || dishDialog" @click="editing=activeMenu">Sửa nội dung menu</AppButton></div><MenuEditor v-if="editing?.id===activeMenu.id" :menu="editing" @saved="savedEditor" @cancel="editing=null" /><template v-if="tab==='dish'"><ManageDishTable :menu="activeMenu" :summary="summary" :busy="loading || !!busy || !!editing" @add="openDish()" @edit="openDish" @remove="removeDish" @availability="availability"><template #actions><AppButton :disabled="loading || !!busy || activeMenu.is_closed || !!editing" @click="openDelegate">Đặt hộ</AppButton></template></ManageDishTable><OrderSummaryPanel :orders="activeMenu.orders || []" :menu-note="activeMenu.note || ''" :is-closed="!!activeMenu.is_closed" :before-copy="() => !loading && !busy && !editing && closed(activeMenu,true)" @reopen="closed(activeMenu,false)" /></template><template v-else><div class="row-wrap"><AppButton v-for="option in [{id:'all',name:'Tất cả'},{id:'unpaid',name:'Chưa trả'},{id:'paid',name:'Đã trả'}]" :key="option.id" variant="ghost" :aria-pressed="paidFilter===option.id" @click="paidFilter=option.id">{{ option.name }}</AppButton><AppButton class="spacer" :disabled="loading || !!busy || activeMenu.is_closed || !!editing" @click="openDelegate">Đặt hộ</AppButton></div><ManagePayments :orders="activeMenu.orders || []" :menu="activeMenu" :filter="paidFilter" /></template></article><AppButton v-if="menusMore" variant="ghost" :loading="loading" @click="loadMenus(true)">Tải thêm menu</AppButton></template>
<template v-else><section class="card stack"><div class="archive-filters"><label class="field">Từ ngày<input v-model="archiveFrom" type="date" class="input" /></label><label class="field">Đến ngày<input v-model="archiveTo" type="date" class="input" /></label><label class="field">Trạng thái<select v-model="archiveStatus" class="input"><option value="all">Tất cả</option><option value="open">Đang nhận đơn</option><option value="closed">Đã chốt</option></select></label></div><label class="field">Tìm menu<input v-model="archiveSearch" type="search" class="input" /></label><p class="meta">{{ menus.length }}{{ menuCount != null ? ' / '+menuCount : '' }} menu đã tải{{ menusMore ? ' · Tìm kiếm trong phần đã tải' : '' }}<span v-if="loading"> · Đang cập nhật…</span></p></section><Spinner v-if="loading && !menus.length" /><EmptyState v-else-if="!visibleMenus.length" title="Chưa có menu phù hợp" /><article v-for="menu in visibleMenus" :key="menu.id" class="card stack-sm"><div class="row-wrap"><div><h2 class="section-title">{{ menu.restaurant?.name || menu.title }}</h2><p class="meta">{{ formatVNDate(menu.menu_date) }} · {{ menu.orders?.length || 0 }} đơn · {{ menu.is_closed ? 'Đã chốt' : 'Đang nhận đơn' }}</p></div><AppButton class="spacer" variant="ghost" :disabled="loading || !!busy" @click="openMenu(menu.id)">Mở quản lý</AppButton></div><div class="row-wrap"><AppButton variant="ghost" :disabled="loading || !!busy" @click="closed(menu,!menu.is_closed)">{{ menu.is_closed ? 'Mở lại' : 'Chốt đơn' }}</AppButton><AppButton variant="ghost" :to="{path:'/post',query:{reuse:menu.id}}">Dùng lại</AppButton><AppButton variant="ghost" @click="csv(menu)">CSV</AppButton><AppButton variant="ghost" @click="copyLink(menu)">{{ copied===menu.id ? 'Đã chép link' : 'Chia sẻ' }}</AppButton><AppButton variant="ghost" :disabled="loading || !!busy" @click="removeMenu(menu)">Xóa menu</AppButton></div></article><AppButton v-if="menusMore" variant="ghost" :loading="loading" @click="loadMenus(true)">Tải thêm menu</AppButton></template></template>
<AppDialog :open="dishDialog" :title="dish ? 'Sửa món' : 'Thêm món'" @close="closeDish"><form id="manage-dish-form" class="stack" novalidate @submit.prevent="saveDish"><FormErrorSummary ref="dishErrorSummary" :errors="dishErrors" /><label class="field">Tên món<input id="manage-dish-name" v-model="dishName" class="input" :aria-invalid="dishErrors.some(e=>e.fieldId==='manage-dish-name')" maxlength="240" :readonly="!!orderedDish?.servings" :disabled="!!busy" /><span v-for="entry in dishErrors.filter(e=>e.fieldId==='manage-dish-name')" :key="entry.message" class="field-error">{{ entry.message }}</span></label><p v-if="orderedDish?.servings" class="meta">Món đã có người đặt. Giữ nguyên tên và liên kết; bạn có thể sửa giá hoặc báo hết món.</p><label class="field">Giá / suất (đồng)<input id="manage-dish-price" v-model="dishPrice" class="input" :aria-invalid="dishErrors.some(e=>e.fieldId==='manage-dish-price')" type="number" min="0" step="1" :disabled="!!busy" placeholder="Có thể để trống" /><span v-for="entry in dishErrors.filter(e=>e.fieldId==='manage-dish-price')" :key="entry.message" class="field-error">{{ entry.message }}</span></label><p class="meta">Tiền các đơn được tính theo giá hiện có trong menu.</p><p v-if="error" class="alert" role="alert">{{ error }}</p></form><template #footer><AppButton variant="ghost" :disabled="!!busy" @click="closeDish">Hủy</AppButton><AppButton type="submit" form="manage-dish-form" :loading="!!busy">{{ dish ? 'Lưu thay đổi' : 'Thêm món' }}</AppButton></template></AppDialog><OrderOnBehalfDialog :open="delegateOpen" :menu="activeMenu" :profiles="profiles" :busy="delegateBusy" :error="delegateError" @close="delegateOpen=false" @submit="delegate" /><SignInModal v-if="showSignIn" @close="showSignIn=false" /></div></template>
<style scoped>.field-error{color:var(--unpaid-ink);font-size:.875rem}.workspace-tabs{display:flex;gap:1.5rem;border-bottom:1px solid var(--line)}.workspace-tabs button{background:transparent;border:0;border-bottom:2px solid transparent;min-height:48px;padding:.5rem 0;font:inherit;cursor:pointer;color:var(--muted)}.workspace-tabs button[aria-pressed=true]{border-bottom-color:var(--ink);color:var(--ink);font-weight:700}.manage-filters{display:grid;grid-template-columns:minmax(0,.6fr) minmax(0,1fr);gap:1rem}.archive-filters{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem}.summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-block:1px solid var(--line);padding:1rem 0;gap:1rem}.summary-grid>div{display:grid;align-content:start;gap:.4rem}.summary-grid strong{font-size:1.5rem;overflow-wrap:anywhere}.summary-grid span{font-size:.875rem;color:var(--muted)}[aria-pressed=true]{font-weight:700}@media(max-width:600px){.workspace-tabs{gap:1rem;justify-content:space-between}.workspace-tabs button{font-size:.875rem}.manage-filters,.archive-filters{grid-template-columns:1fr}.summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.manage-page>.row-wrap>.spacer{margin-left:0}}</style>

<script setup>
import GlassActionMenu from '../components/ui/liquid/GlassActionMenu.vue'
import AppDatePicker from '../components/ui/AppDatePicker.vue'
import GlassSegmented from '../components/ui/liquid/GlassSegmented.vue'
import GlassSelect from '../components/ui/liquid/GlassSelect.vue'
import GlassInput from '../components/ui/liquid/GlassInput.vue'
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
import MenuCoordination from '../components/MenuCoordination.vue'
import LunchExportDialog from '../components/LunchExportDialog.vue'
import AsciiSkeleton from '../components/ui/AsciiSkeleton.vue'
import { isOutstanding } from '../../shared/lunch-finance.js'
const coordination=ref(null),exportOpen=ref(false),exportMenu=ref(null)
const props = defineProps({ initialWorkspace:{type:String,default:'today'}, initialTab:{type:String,default:'dish'}, todayOnly:Boolean })
const { user, isSignedIn } = useUser(), route = useRoute()
const { listPostedMenus, listPostedUnpaidOrders, getMenu, setMenuClosed, deleteMenu, updateMenu } = useMenus()
const { listProfiles, createOrder } = useOrders()
const presence = useAppPresence()
const workspace = ref(props.initialWorkspace), menus = ref([]), menuCount = ref(null), loading = ref(false), error = ref(''), selectedId = ref(String(route.query.menu_id || '')), date = ref(todayInVN()), tab = ref('dish'), paidFilter = ref('all'), showSignIn = ref(false), busy = ref(''), copied = ref(''), editing = ref(null)
const archiveFrom = ref(''), archiveTo = ref(''), archiveStatus = ref('all'), archiveSearch = ref('')
const ledger = ref([]), ledgerCount = ref(null), ledgerLoading = ref(false), ledgerError = ref(''), period = ref('month'), selectedMonth = ref(todayInVN().slice(0,7)), loadedPeriod = ref('all'), loadedMonth = ref('')
const profiles = ref([]), delegateOpen = ref(false), delegateError = ref(''), delegateBusy = ref(false)
const dishDialog = ref(false), dish = ref(null), dishName = ref(''), dishPrice = ref(''), dishErrors = ref([]), dishErrorSummary = ref(null)
let generation = 0, ledgerGeneration = 0, delegateGeneration = 0
const activeMenu = computed(() => menus.value.find(menu => menu.id === selectedId.value) || menus.value[0] || null)
const summary = computed(() => summarizeManagedMenu(activeMenu.value))
const unpaidSummary = computed(() => summarizeManagedMenu({...activeMenu.value,orders:(activeMenu.value?.orders || []).filter(order=>isOutstanding(activeMenu.value,order))}))
const visibleMenus = computed(() => menus.value.filter(menu => `${menu.title} ${menu.restaurant?.name || ''}`.toLocaleLowerCase('vi').includes(archiveSearch.value.toLocaleLowerCase('vi'))))
const menusMore = computed(() => menuCount.value !== null && menus.value.length < menuCount.value)
const ledgerMore = computed(() => ledgerCount.value !== null && ledger.value.length < ledgerCount.value)
const ledgerStale = computed(() => loadedPeriod.value !== period.value || (period.value === 'month' && loadedMonth.value !== selectedMonth.value))
const orderedDish = computed(() => dish.value && summary.value.orderedDishes.find(row => dish.value.id ? row.menuItemId === dish.value.id : row.name === dish.value.name))
const money = value => value == null ? '—' : new Intl.NumberFormat('vi-VN').format(value) + 'đ'
function shiftDay(value, days) { const date = new Date(value + 'T00:00:00Z'); date.setUTCDate(date.getUTCDate()+days); return date.toISOString().slice(0,10) }
function ledgerRange() {
  const today = todayInVN(), start = shiftDay(today,-30)
  if (period.value === 'month') {
    const [year,month] = selectedMonth.value.split('-').map(Number)
    if (!year || !month || month < 1 || month > 12) return {}
    return {from:`${selectedMonth.value}-01`,to:new Date(Date.UTC(year,month,0)).toISOString().slice(0,10)}
  }
  return period.value === 'today' ? {from:today,to:today} : period.value === 'recent' ? {from:start,to:shiftDay(today,-1)} : period.value === 'older' ? {to:shiftDay(start,-1)} : {}
}
async function loadMenus(more = false) {
  const current = ++generation, account = user.value?.id
  if (!account || workspace.value === 'ledger') return
  loading.value = true; error.value = ''
  try {
    const range = workspace.value === 'today' ? {from:date.value,to:date.value} : {from:archiveFrom.value || undefined,to:archiveTo.value || undefined,status:archiveStatus.value,includeArchived:true}
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
    ledger.value = more ? [...ledger.value,...(result.data || [])] : result.data || []; ledgerCount.value = result.count ?? (ledger.value.length + (result.data?.length === 100 ? 1 : 0)); loadedPeriod.value = period.value; loadedMonth.value = selectedMonth.value
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
    if(result.data.archived_at && !menus.value.some(menu=>menu.id===id)){menus.value.unshift(result.data);selectedId.value=id}
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
function changeMonth(value) { if (selectedMonth.value === value) return; selectedMonth.value=value; if (period.value === 'month') loadLedger() }
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
async function closed(menu,value){
  if(menu.is_closed===value)return true
  if(busy.value)return false
  if(workspace.value!=='today' || activeMenu.value?.id!==menu.id){await openMenu(menu.id);await nextTick()}
  if(activeMenu.value?.id!==menu.id || !coordination.value)return false
  return value?await coordination.value.closeMenu():await coordination.value.reopenMenu()
}
function coordinated(value){
  const index=menus.value.findIndex(menu=>menu.id===value.id)
  if(index>=0)menus.value[index]=value
  presence.notifyOrderChanged(value.id)
}
function openExport(menu=null){exportMenu.value=menu;exportOpen.value=true}

async function removeMenu(menu) {
  if (busy.value) return
  const account=user.value?.id; busy.value=menu.id; error.value=''
  try {
    const fresh=await getMenu(menu.id)
    if (user.value?.id !== account) return
    if (fresh.error || fresh.data?.poster_id !== account) throw fresh.error || new Error('ownership')

    const reviewCount=(fresh.data.orders || []).reduce((sum,order)=>sum+(order.order_items || []).filter(item=>Array.isArray(item.review) ? item.review.length : item.review).length,0)
    if (!confirm(fresh.data.orders?.length?'Lưu trữ menu này? Bạn vẫn xem lại đơn, đánh giá và khoản chưa thu.':'Xóa menu trống này?')) return
    const result=await deleteMenu(menu.id,fresh.data.image_url)
    if (user.value?.id !== account) return
    if (result.error) throw result.error
    menus.value=menus.value.filter(m=>m.id!==menu.id); menuCount.value=Math.max(0,(menuCount.value || 1)-1); presence.notifyOrderChanged(menu.id)
  } catch { if (user.value?.id === account) error.value='Chưa lưu trữ hoặc xóa được menu. Dữ liệu vẫn còn.' }
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
  catch { if(current===delegateGeneration) delegateError.value='Chưa đặt được. Người nhận có thể vừa đặt hoặc menu vừa chốt. Bạn vẫn còn bản nháp.' }
  finally { if(current===delegateGeneration) delegateBusy.value=false }
}
async function savedEditor() { editing.value=null; await refreshMenu(); presence.notifyOrderChanged(activeMenu.value.id) }
</script>
<template><div class="manage-page"><PageHeader eyebrow="Menu bạn đăng" title="Quản lý" sub="Số suất, đơn đặt và tiền cần thu." /><EmptyState v-if="!isSignedIn" title="Đăng nhập để quản lý menu"><AppButton @click="showSignIn=true">Đăng nhập</AppButton></EmptyState><template v-else><div class="workspace-tabs" role="group" aria-label="Khu quản lý"><button v-for="option in [{id:'today',name:'Hôm nay'},{id:'ledger',name:'Tiền chưa thu'},{id:'archive',name:'Menu đã đăng'}]" :key="option.id" type="button" :aria-pressed="workspace===option.id" :disabled="!!busy || delegateBusy || dishDialog || !!editing" @click="switchWorkspace(option.id)">{{ option.name }}</button></div><p v-if="error" class="alert" role="alert">{{ error }} <AppButton variant="ghost" @click="loadMenus()">Thử lại</AppButton></p>
<div v-if="workspace==='ledger'" class="row-wrap"><AppButton variant="ghost" @click="openExport()">Xuất Excel / CSV</AppButton></div><OutstandingLedger v-if="workspace==='ledger'" :orders="ledger" :period="period" :month="selectedMonth" :loading="ledgerLoading" :error="ledgerError" :has-more="ledgerMore" :total-count="ledgerCount" :stale="ledgerStale" :menu-id="String(route.query.menu_id || '')" @period-change="changePeriod" @month-change="changeMonth" @load-more="loadLedger(true)" @retry="loadLedger(!ledgerStale && !!ledger.length)" @open-menu="openMenu" />
<template v-else-if="workspace==='today'">
  <div class="manage-toolbar"><div class="menu-selector"><GlassSelect label="Menu đang xem" v-model="selectedId" :options="menus.length ? menus.map(menu => ({ value: menu.id, label: `${menu.restaurant?.name || menu.title} · ${formatVNDate(menu.menu_date)}` })) : [{ value: '', label: 'Chưa có menu' }]" :disabled="loading || !!busy || delegateOpen || dishDialog || !!editing" /><div class="day-picker"><div class="field"><AppDatePicker label="Ngày ăn" v-model="date" :disabled="!!busy || dishDialog || !!editing" @change="loadMenus()" /></div></div></div><div v-if="activeMenu" class="manage-actions"><AppButton variant="ghost" :disabled="loading || !!busy || activeMenu.is_closed || activeMenu.archived_at || delegateOpen || dishDialog || !!editing" @click="openDelegate">Đặt hộ</AppButton></div></div>
  <p v-if="date!==todayInVN()" class="date-note">Bạn đang xem riêng menu ngày {{ formatVNDate(date) }}. Các khoản chưa thu nằm ở tab Tiền chưa thu.</p><p v-if="loading && menus.length" class="date-note" role="status">Đang cập nhật menu…</p><AsciiSkeleton v-if="loading && !menus.length" kind="order-row" label="Đang tải menu quản lý…" /><EmptyState v-else-if="!activeMenu" title="Chưa đăng menu ngày này"><AppButton to="/post">Đăng menu</AppButton></EmptyState>
  <template v-else><MenuCoordination ref="coordination" :menu="activeMenu" :disabled="!!busy || !!editing" @updated="coordinated" @busy="busy=$event?activeMenu.id:''" /><div class="row-wrap"><AppButton variant="ghost" @click="openExport(activeMenu)">Xuất Excel / CSV</AppButton><span v-if="activeMenu.archived_at" class="meta">Menu đã lưu trữ</span></div><div class="summary-grid"><div class="manage-stat"><span>Suất đã đặt</span><strong>{{ summary.servings }}</strong><small>{{ activeMenu.orders?.length || 0 }} đơn</small></div><div class="manage-stat"><span>Món đã đặt</span><strong>{{ summary.orderedDishCount }}</strong></div><div class="manage-stat"><span>Tổng tiền đơn</span><strong>{{ money(summary.knownTotal) }}</strong></div><div class="manage-stat manage-stat-outstanding"><span>Chưa thu</span><strong>{{ money(unpaidSummary.knownTotal) }}</strong><small>{{ summary.unpaidCount }} người / đơn</small></div></div>
    <section class="card manage-card" :aria-busy="loading"><div class="manage-toolbar"><div><h2>{{ activeMenu.restaurant?.name || activeMenu.title }}</h2><p class="meta">{{ formatVNDate(activeMenu.menu_date) }} · {{ activeMenu.is_closed ? 'Đã chốt đơn' : 'Đang nhận đơn' }}</p></div><AppButton variant="ghost" :disabled="loading || !!busy || activeMenu.is_closed || !!editing" @click="openDish()">+ Thêm món</AppButton></div><div class="manage-filters" role="group" aria-label="Cách xem đơn"><GlassSegmented label="Cách xem đơn" :options="['Theo món','Theo người']" :model-value="tab==='dish'?0:1" @update:model-value="tab=$event===0?'dish':'person'" /><div class="menu-tools"><div class="manage-actions"><AppButton variant="ghost" :to="`/menu/${activeMenu.id}`">Xem menu</AppButton><AppButton variant="ghost" :disabled="loading || !!busy || activeMenu.is_closed || activeMenu.archived_at || delegateOpen || dishDialog" @click="editing=activeMenu">Sửa nội dung menu</AppButton></div></div></div><MenuEditor v-if="editing?.id===activeMenu.id" :menu="editing" @saved="savedEditor" @cancel="editing=null" /><ManageDishTable v-if="tab==='dish'" :menu="activeMenu" :summary="summary" :busy="loading || !!busy || !!editing || !!activeMenu.archived_at" @edit="openDish" @remove="removeDish" @availability="availability" /><template v-else><div class="manage-filters" role="group" aria-label="Lọc thanh toán"><GlassSegmented label="Lọc thanh toán" :options="['Tất cả','Đã trả','Chưa trả']" :model-value="['all','paid','unpaid'].indexOf(paidFilter)" @update:model-value="paidFilter=['all','paid','unpaid'][$event]" /></div><ManagePayments :orders="activeMenu.orders || []" :menu="activeMenu" :filter="paidFilter" /></template></section>
    <p class="manage-quiet">Số suất tự tổng hợp từ đơn đã đặt. Thêm/sửa/xóa ở đây áp dụng cho món trong menu, không sửa đơn của người khác.</p><OrderSummaryPanel :menu="activeMenu" :read-only="!!activeMenu.archived_at" v-if="tab==='dish'" class="buy-list" :orders="activeMenu.orders || []" :menu-note="activeMenu.note || ''" :is-closed="!!activeMenu.is_closed" :before-copy="() => !loading && !busy && !editing && closed(activeMenu,true)" @reopen="closed(activeMenu,false)" />
  </template><AppButton v-if="menusMore" variant="ghost" :loading="loading" @click="loadMenus(true)">Tải thêm menu</AppButton>
</template>
<template v-else><div class="manage-toolbar archive-heading"><h2>Menu đã đăng</h2><AppButton to="/post">+ Đăng menu</AppButton></div><section class="archive-controls"><div class="archive-filters"><div class="field"><AppDatePicker label="Từ ngày" v-model="archiveFrom" clearable /></div><div class="field"><AppDatePicker label="Đến ngày" v-model="archiveTo" clearable /></div><div class="field"><span class="archive-status-heading">Trạng thái</span><GlassSegmented class="archive-status-wide" label="Trạng thái menu" :options="['Tất cả','Đang nhận đơn','Đã chốt']" :model-value="['all','open','closed'].indexOf(archiveStatus)" @update:model-value="archiveStatus=['all','open','closed'][$event]" /><GlassSelect class="archive-status-small" label="Trạng thái" v-model="archiveStatus" :options="[{value:'all',label:'Tất cả'},{value:'open',label:'Đang nhận đơn'},{value:'closed',label:'Đã chốt'}]" aria-label="Trạng thái menu" /></div></div><div class="field"><GlassInput label="Tìm menu" v-model="archiveSearch" type="search" /></div><p class="meta">{{ menus.length }}{{ menuCount != null ? ' / '+menuCount : '' }} menu đã tải{{ menusMore ? ' · Tìm kiếm trong phần đã tải' : '' }}<span v-if="loading"> · Đang cập nhật…</span></p></section><AsciiSkeleton v-if="loading && !menus.length" kind="order-row" label="Đang tải menu quản lý…" /><EmptyState v-else-if="!visibleMenus.length" title="Chưa có menu phù hợp" /><article v-for="menu in visibleMenus" :key="menu.id" class="card archive-row">
  <div class="archive-menu-name"><h2 class="section-title">{{ menu.restaurant?.name || menu.title }}</h2><p class="meta">{{ formatVNDate(menu.menu_date) }}</p></div>
  <p class="archive-counts">{{ menu.orders?.length || 0 }} đơn <span aria-hidden="true">·</span> {{ menuDishes(menu).length }} món</p>
  <span class="menu-state" :class="{ 'menu-state-open': !menu.is_closed && !menu.archived_at }">{{ menu.archived_at ? 'Đã lưu trữ' : menu.is_closed ? 'Đã chốt' : 'Đang nhận đơn' }}</span>
  <div class="archive-row-actions"><AppButton variant="ghost" :disabled="loading || !!busy" @click="openMenu(menu.id)">Quản lý</AppButton>
    <GlassActionMenu :label="`Thao tác với ${menu.restaurant?.name || menu.title}`" :disabled="loading || !!busy" :items="[
      {label:'Dùng lại',onSelect:()=> $router.push({path:'/post',query:{reuse:menu.id}})},
      {label:'Xuất Excel / CSV',onSelect:()=>openExport(menu)},
      {label:copied===menu.id?'Đã chép link':'Chép link',onSelect:()=>copyLink(menu)},
      {label:menu.orders?.length?'Lưu trữ menu':'Xóa menu trống',destructive:true,disabled:!!menu.archived_at,onSelect:()=>removeMenu(menu)}
    ]" />
  </div>
</article><AppButton v-if="menusMore" variant="ghost" :loading="loading" @click="loadMenus(true)">Tải thêm menu</AppButton></template></template>
<AppDialog :open="dishDialog" :title="dish ? 'Sửa món' : 'Thêm món'" @close="closeDish"><form id="manage-dish-form" class="stack" novalidate @submit.prevent="saveDish"><FormErrorSummary ref="dishErrorSummary" :errors="dishErrors" /><label class="field">Tên món<input id="manage-dish-name" v-model="dishName" class="input" :aria-invalid="dishErrors.some(e=>e.fieldId==='manage-dish-name')" maxlength="240" :readonly="!!orderedDish?.servings" :disabled="!!busy" /><span v-for="entry in dishErrors.filter(e=>e.fieldId==='manage-dish-name')" :key="entry.message" class="field-error">{{ entry.message }}</span></label><p v-if="orderedDish?.servings" class="meta">Món đã có người đặt. Giữ nguyên tên và liên kết; bạn có thể sửa giá hoặc báo hết món.</p><label class="field">Giá / suất (đồng)<input id="manage-dish-price" v-model="dishPrice" class="input" :aria-invalid="dishErrors.some(e=>e.fieldId==='manage-dish-price')" type="number" min="0" step="1" :disabled="!!busy" placeholder="Có thể để trống" /><span v-for="entry in dishErrors.filter(e=>e.fieldId==='manage-dish-price')" :key="entry.message" class="field-error">{{ entry.message }}</span></label><p class="meta">Trước khi chốt, app tính tiền theo giá hiện có trong menu.</p><p v-if="error" class="alert" role="alert">{{ error }}</p></form><template #footer><AppButton variant="ghost" :disabled="!!busy" @click="closeDish">Hủy</AppButton><AppButton type="submit" form="manage-dish-form" :loading="!!busy">{{ dish ? 'Lưu thay đổi' : 'Thêm món' }}</AppButton></template></AppDialog><OrderOnBehalfDialog :open="delegateOpen" :menu="activeMenu" :profiles="profiles" :busy="delegateBusy" :error="delegateError" @close="delegateOpen=false" @submit="delegate" /><LunchExportDialog :open="exportOpen" :menu="exportMenu" @close="exportOpen=false" /><SignInModal v-if="showSignIn" @close="showSignIn=false" /></div></template>
<style scoped>
.manage-page { min-width:0; }
.manage-page :deep(.page-header) { margin-bottom:24px; }
.manage-page .meta { font-size:14px; color:var(--ink-soft); }
.workspace-tabs { display:flex; gap:4px; padding:5px; border:1px solid var(--line); border-radius:16px; background:var(--bg-tint); margin:20px 0 24px; overflow-x:auto; }
.workspace-tabs button { flex:1; padding:10px 16px; border:0; border-radius:var(--radius-control); background:none; min-height:48px; color:var(--ink-soft); font-weight:700; font-size:16px; cursor:pointer; white-space:nowrap; }
.workspace-tabs button[aria-pressed=true] { color:var(--primary-ink); background:var(--card); box-shadow:0 1px 4px #0000000d; }
.workspace-tabs button:disabled { cursor:not-allowed; opacity:.55; }
.manage-toolbar { display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; }
.manage-toolbar > div { min-width:0; }
.menu-selector { display:grid; grid-template-columns:minmax(180px,1fr) minmax(150px,.65fr); gap:16px; min-width:0; max-width:680px; flex:1 1 440px; }
.manage-actions { display:flex; gap:8px; flex-wrap:wrap; }
.manage-page :deep(.btn) { min-height:48px; padding:11px 16px; font-size:16px;  }
.manage-page .field { font-size:16px; font-weight:700; gap:8px; }
.manage-page .input { min-height:46px; font-size:16px; padding:11px 12px; border-radius:var(--radius-field); }
.day-picker { position:relative; }
.day-picker summary { min-height:44px; align-content:center; cursor:pointer; font-size:14px; color:var(--ink-soft); }
.day-picker .field { margin:0; }
.summary-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; margin:24px 0; }
.manage-stat { padding:20px; border:1px solid var(--line); border-radius:20px; background:var(--card); min-width:0; }
.manage-stat > span { font-size:14px; font-weight:600; color:var(--ink-soft); }
.manage-stat strong { font-size:28px; font-weight:750; line-height:1.35; letter-spacing:-.03em; display:block; margin:8px 0 4px; overflow-wrap:anywhere; font-variant-numeric:tabular-nums; }
.manage-stat small { font-size:14px; color:var(--ink-soft); line-height:1.6; display:block; }
.manage-stat-outstanding { border-color:var(--line-strong); background:var(--bg-tint); }
.manage-stat-outstanding strong { color:var(--unpaid-ink, var(--ink)); }
.manage-card { padding:24px; box-shadow:none; }
.manage-card h2 { font-size:24px; font-weight:750; line-height:1.35; margin:0; overflow-wrap:anywhere; }
.manage-card .meta { font-size:14px; margin:7px 0; line-height:1.6; }
.manage-filters { display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin:20px 0; }
.manage-filters :deep([aria-pressed=true]) { border-color:var(--primary); color:var(--primary-ink); font-weight:750; background:var(--primary-soft); }
.menu-tools { margin-left:auto; max-width:100%; }
.menu-tools summary { min-height:44px; align-content:center; cursor:pointer; font-size:14px; color:var(--ink-soft); }
.menu-tools[open] { flex-basis:100%; }
.menu-tools .manage-actions { margin:0; }
.date-note, .manage-quiet { font-size:14px; color:var(--ink-soft); line-height:1.7; margin-top:16px; }
.buy-list { margin-top:24px; }
.archive-heading h2 { font-size:24px; font-weight:750; margin:0; }
.archive-controls { display:grid; gap:16px; margin:20px 0; padding:20px; background:var(--card); border:1px solid var(--line); border-radius:14px; }
.archive-filters { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:16px; }
.archive-status-small { display:none; }
.archive-row { display:grid; grid-template-columns:minmax(0,1fr) auto auto auto; align-items:center; gap:20px; }
.archive-menu-name { min-width:0; }.manage-page > .archive-row .section-title { margin:0; font-size:18px; }.archive-menu-name .meta { margin:4px 0 0; }
.archive-counts { font-size:14px; color:var(--ink-soft); white-space:nowrap; font-variant-numeric:tabular-nums; }
.archive-row-actions { display:flex; gap:8px; align-items:center; }
@media(min-width:641px) and (max-width:900px) { .archive-row { grid-template-columns:minmax(0,1fr) auto; gap:12px 16px; }.archive-row-actions { grid-column:2; grid-row:1 / 3; }.archive-counts { grid-column:1; }.archive-row .menu-state { grid-column:1; justify-self:start; } }
.menu-state { display:inline-flex; padding:5px 10px; border-radius:8px; font-size:14px; font-weight:700; background:var(--bg-tint); color:var(--ink-soft); white-space:nowrap; }
.menu-state-open { color:var(--primary-ink); background:var(--primary-soft); }
.field-error { color:var(--unpaid-ink); font-size:14px; }
.manage-page > article { margin:16px 0; }
.manage-page > section { margin:20px 0; }
.manage-page > article.card { padding:24px; box-shadow:none; }
.manage-page > article .section-title { font-size:22px; font-weight:750; overflow-wrap:anywhere; }
.manage-page > article .meta { font-size:14px; }
.manage-page > article .row-wrap { justify-content:space-between; }
@media(max-width:1000px) {
  .summary-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
}
@media(max-width:640px) {
  .summary-grid { gap:10px; margin:20px 0; }
  .manage-stat { padding:16px; }
  .manage-stat strong { font-size:24px; }
  .workspace-tabs { gap:3px; margin-bottom:20px; }
  .workspace-tabs button { font-size:16px; padding:10px; }
  .manage-card, .manage-page > article.card { padding:18px; }
  .manage-card h2, .archive-heading h2 { font-size:22px; }
  .menu-selector { grid-template-columns:1fr; width:100%; min-width:0; max-width:none; flex-basis:100%; }
  .archive-filters { grid-template-columns:1fr; gap:14px; }
  .archive-status-wide,.archive-status-heading { display:none; }.archive-status-small { display:block; }
  .archive-controls { padding:18px; }
  .manage-filters { gap:8px; }
  .manage-actions { width:100%; }
  .manage-actions :deep(.btn) { flex:1; }
  .archive-row { grid-template-columns:minmax(0,1fr) auto; gap:10px 12px; }
  .archive-row .archive-menu-name { grid-column:1 / -1; }
  .archive-row .archive-counts { grid-column:1; }
  .archive-row .menu-state { grid-column:1; justify-self:start; }
  .archive-row-actions { grid-column:2; grid-row:2 / 4; }
  .archive-row-actions :deep(.btn) { padding:10px 14px; }
}
@media(max-width:360px) { .archive-row { grid-template-columns:1fr; }.archive-row .archive-menu-name,.archive-row .archive-counts,.archive-row .menu-state,.archive-row-actions { grid-column:1; grid-row:auto; }.archive-row-actions { justify-content:flex-end; } }
</style>

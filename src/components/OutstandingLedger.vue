<script setup>
import GlassSelect from './ui/liquid/GlassSelect.vue'
import GlassInput from './ui/liquid/GlassInput.vue'
import AsciiSkeleton from './ui/AsciiSkeleton.vue'
import { computed, ref } from 'vue'
import { groupOutstandingOrders } from '../lib/manage-summary'
import { formatVNDate, todayInVN } from '../lib/date'
import { AppButton } from './ui'
const props = defineProps({ orders: { type:Array, default:()=>[] }, period:String, month:String, loading:Boolean, error:String, hasMore:Boolean, totalCount:Number, stale:Boolean, menuId:String })
const emit = defineEmits(['period-change','month-change','load-more','open-menu','retry'])
const scopedOrders = computed(() => props.menuId ? props.orders.filter(order=>order.menu?.id===props.menuId) : props.orders)
const allGroups = computed(() => groupOutstandingOrders(scopedOrders.value))
const countOf = groups => groups.reduce((sum,group)=>sum+group.count,0)
const monthOptions = computed(() => {
  const [year,month]=todayInVN().slice(0,7).split('-').map(Number)
  return Array.from({length:60},(_,index)=>{
    const date=new Date(Date.UTC(year,month-1-index,1)), value=date.toISOString().slice(0,7)
    return {value,label:new Intl.DateTimeFormat('vi-VN',{month:'long',year:'numeric',timeZone:'UTC'}).format(date)}
  })
})
const rangeOptions = [
  {value:'month',label:'Theo tháng'},
  {value:'today',label:'Hôm nay'},
  {value:'recent',label:'30 ngày gần đây'},
  {value:'older',label:'Cũ hơn 30 ngày'},
  {value:'all',label:'Tất cả ngày'},
]
const search = ref(''), sort = ref('oldest')
const groups = computed(() => allGroups.value
  .filter(group => group.name.toLocaleLowerCase('vi').includes(search.value.toLocaleLowerCase('vi')))
  .sort((a,b) => sort.value === 'amount' ? b.knownTotal - a.knownTotal : a.oldestDate.localeCompare(b.oldestDate)))
const totalAmount = computed(() => allGroups.value.reduce((sum,group)=>sum+group.knownTotal,0))
const money = value => value == null ? '—' : new Intl.NumberFormat('vi-VN').format(value) + 'đ'
function age(date) { return Math.floor((Date.parse(todayInVN()+'T00:00:00Z')-Date.parse(date+'T00:00:00Z'))/86400000) }
function ageLabel(date) { const days=age(date); return days<0 ? 'Chưa tới ngày' : days===0 ? 'Hôm nay' : days>=90 ? '90+ ngày' : days+' ngày' }
</script>
<template>
  <section class="ledger-workspace">
    <header class="ledger-title"><div><h2>Tiền chưa thu</h2><p class="meta">Chọn tháng để xem tổng tiền, sau đó tìm từng người còn thiếu.</p></div></header>
    <section class="ledger-overview" aria-label="Tổng tiền chưa thu">
      <div class="ledger-overview-total"><span>Còn phải thu</span><strong>{{ money(totalAmount) }}</strong></div>
      <div class="ledger-overview-count"><strong>{{ allGroups.length }} người</strong><span>{{ countOf(allGroups) }} đơn chưa thanh toán</span></div>
      <p v-if="hasMore" class="ledger-context">Đã tải {{ orders.length }} đơn. Tải tiếp để tính đủ toàn bộ khoản trong khoảng này.</p>
    </section>
    <div class="ledger-time-controls">
      <div class="field"><GlassSelect label="Khoảng thời gian" :model-value="period" :options="rangeOptions" @update:model-value="emit('period-change',$event)" /></div>
      <div v-if="period==='month'" class="field"><GlassSelect label="Tháng" :model-value="month" :options="monthOptions" @update:model-value="emit('month-change',$event)" /></div>
    </div>
    <div class="ledger-filters">
      <div class="field"><GlassInput label="Tìm người" v-model="search" type="search" /></div>
      <div class="field"><GlassSelect label="Sắp xếp" v-model="sort" :options="[{value:'oldest',label:'Bữa cũ nhất'},{value:'amount',label:'Tổng tiền cao nhất'}]" /></div>
    </div>
    <p v-if="menuId" class="meta ledger-scope">Đang xem các khoản của menu trong đường dẫn. <AppButton variant="ghost" to="/dashboard">Tất cả menu</AppButton></p>
    <p v-if="stale" class="meta" role="status">Đang cập nhật khoảng thời gian đã chọn.</p>
    <p v-if="hasMore" class="load-scope" role="status">{{ orders.length }}{{ totalCount!=null ? ' / '+totalCount : '' }} đơn đã tải{{ loading ? ' · Đang cập nhật' : '' }}.</p>
    <p v-if="error" class="alert" role="alert">{{ error }} <AppButton variant="ghost" @click="emit('retry')">Thử lại</AppButton></p>
    <AsciiSkeleton v-if="loading && !orders.length" kind="order-row" label="Đang tải các khoản chưa thu…" />
    <div v-else class="ledger-results">
      <p class="ledger-results-heading">{{ groups.length }} người · {{ countOf(groups) }} đơn chưa thanh toán</p>
      <p v-if="!groups.length" class="empty-ledger">Không có khoản chưa thanh toán trong khoảng này.</p>
      <section v-for="group in groups" :key="group.userId" class="ledger-person">
        <header class="ledger-person-heading">
          <div><h3>{{ group.name }}</h3><p class="meta">{{ group.count }} đơn · Bữa cũ nhất {{ formatVNDate(group.oldestDate) }}<span v-if="age(group.oldestDate)>=90"> · Có khoản từ 90 ngày</span></p></div>
          <div class="ledger-person-total"><span>Còn thiếu</span><strong>{{ money(group.knownTotal) }}</strong></div>
        </header>
        <article v-for="order in group.entries" :key="order.id" class="ledger-entry">
          <div class="ledger-entry-main">
            <div class="ledger-entry-heading"><strong>{{ order.menu?.restaurant?.name || order.menu?.title }}</strong><strong class="ledger-entry-amount">{{ money(order.amount) }}</strong></div>
            <p class="ledger-entry-meta"><time :datetime="order.menu?.menu_date">{{ formatVNDate(order.menu?.menu_date) }}</time><span class="age-badge" :class="{old:age(order.menu?.menu_date)>=90}">{{ ageLabel(order.menu?.menu_date) }}</span></p>
            <p class="order-lines">{{ order.item_text }}</p><p v-if="order.note" class="meta">{{ order.note }}</p>
          </div>
          <AppButton variant="ghost" class="ledger-open" @click="emit('open-menu',order.menu.id)">Mở menu</AppButton>
        </article>
      </section>
    </div>
    <AppButton v-if="hasMore && !stale" class="load-more" variant="ghost" :loading="loading" @click="emit('load-more')">Tải tiếp</AppButton>
    <p class="ledger-note">Trạng thái do mỗi người tự xác nhận trong app. Các khoản cũ vẫn được giữ.</p>
  </section>
</template>
<style scoped>
.ledger-workspace{min-width:0}.ledger-title h2{margin:0;font-size:24px;line-height:1.3}.ledger-title p{margin:6px 0 0;font-size:15px}
.ledger-overview{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px 24px;margin:18px 0;padding:18px 22px;border:1px solid #dce9df;border-left:4px solid var(--primary);border-radius:20px;background:linear-gradient(115deg,#f0f8f2 0%,var(--card) 72%)}
.ledger-overview-total span,.ledger-overview-count span{display:block;color:var(--ink-soft);font-size:14px;font-weight:600}.ledger-overview-total strong{display:block;margin-top:4px;color:var(--unpaid-ink,var(--ink));font-size:32px;line-height:1.25;font-variant-numeric:tabular-nums}
.ledger-overview-count{text-align:right}.ledger-overview-count strong{display:block;font-size:18px}.ledger-overview .ledger-context{grid-column:1/-1;margin:0;color:var(--ink-soft);font-size:14px;line-height:1.5}
.ledger-time-controls,.ledger-filters{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:14px 0}.ledger-filters{margin-bottom:18px}.ledger-filters .field{font-size:16px}.ledger-filters .input{min-height:48px;font-size:16px}
.ledger-workspace :deep(.btn){min-height:44px;font-size:15px}.ledger-scope{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.load-scope{margin:8px 0;color:var(--ink-soft);font-size:14px}
.ledger-results{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.ledger-results-heading,.empty-ledger{grid-column:1/-1}.ledger-results-heading{margin:0 0 1px;color:var(--ink-soft);font-size:14px;font-weight:650}
.ledger-person{min-width:0;padding:18px 20px;border:1px solid var(--line);border-radius:20px;background:var(--card);box-shadow:0 2px 8px rgb(25 41 30 / 3%)}
.ledger-person-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding-bottom:12px;border-bottom:1px solid var(--line)}.ledger-person-heading h3{margin:0;font-size:18px;line-height:1.4;overflow-wrap:anywhere}.ledger-person-heading .meta{margin:5px 0 0;font-size:14px;line-height:1.5}
.ledger-person-total{flex:none;text-align:right}.ledger-person-total span{display:block;color:var(--ink-soft);font-size:13px}.ledger-person-total strong{display:block;margin-top:3px;font-size:18px;font-variant-numeric:tabular-nums}
.ledger-entry{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:13px 0}.ledger-entry+.ledger-entry{border-top:1px solid var(--line)}.ledger-entry-main{min-width:0;flex:1}.ledger-entry-heading{display:flex;align-items:baseline;justify-content:space-between;gap:10px}.ledger-entry-heading>strong:first-child{font-size:15px;overflow-wrap:anywhere}.ledger-entry-amount{flex:none;font-size:15px;font-variant-numeric:tabular-nums}
.ledger-entry-meta{display:flex;align-items:center;gap:8px;margin:5px 0;color:var(--ink-soft);font-size:14px}.ledger-entry .order-lines{margin:6px 0 0;font-size:14px;line-height:1.5;color:var(--ink-soft)}.ledger-entry .meta{margin:5px 0 0;font-size:14px;line-height:1.5}
.age-badge{display:inline-flex;padding:2px 8px;border-radius:999px;background:var(--bg-tint);color:var(--ink-soft);font-size:12px;font-weight:650;white-space:nowrap}.age-badge.old{background:var(--unpaid-bg);color:var(--unpaid-ink)}
.ledger-open{flex:none;padding:7px 9px!important}.ledger-note{margin-top:14px;color:var(--ink-soft);font-size:14px;line-height:1.6}.load-more{margin-top:14px}.empty-ledger{padding:26px 12px;color:var(--ink-soft);text-align:center}
@media(max-width:800px){.ledger-results{grid-template-columns:1fr}}
@media(max-width:640px){.ledger-overview{padding:16px;grid-template-columns:minmax(0,1fr) auto}.ledger-overview-total strong{font-size:27px}.ledger-overview-count strong{font-size:16px}.ledger-time-controls,.ledger-filters{grid-template-columns:1fr;gap:10px;margin:12px 0}.ledger-person{padding:16px}.ledger-entry{gap:8px}.ledger-open{align-self:center}.ledger-entry-heading{align-items:flex-start}}
</style>

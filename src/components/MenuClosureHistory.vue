<script setup>
import { ref, watch, onUnmounted } from 'vue'
import { useUser } from '@clerk/vue'
import { useSupabaseClient } from '../lib/supabase'
import { collectPages } from '../lib/lunch-export'
const props=defineProps({menu:{type:Object,required:true}})
const {user}=useUser(),sb=useSupabaseClient(),rows=ref([]),loading=ref(false),error=ref(''),opened=ref(false)
let generation=0,controller
function reset(){generation++;controller?.abort();rows.value=[];error.value='';opened.value=false;loading.value=false}
watch([()=>props.menu.id,()=>props.menu.current_closure_id,()=>user.value?.id],reset)
onUnmounted(reset)
async function load(){
  if(loading.value || !user.value)return
  const current=++generation,uid=user.value.id;controller=new AbortController();loading.value=true;error.value=''
  try{
    const closures=await collectPages((offset,size)=>sb.from('menu_closures').select('id,revision,closed_at,payment_mode').eq('menu_id',props.menu.id).order('revision',{ascending:false}).range(offset,offset+size-1).abortSignal(controller.signal),{signal:controller.signal})
    const items=[]
    for(let start=0;start<closures.length;start+=50)items.push(...await collectPages((offset,size)=>sb.from('closure_items').select('*').in('closure_id',closures.slice(start,start+50).map(row=>row.id)).order('closure_id').order('order_item_id').range(offset,offset+size-1).abortSignal(controller.signal),{signal:controller.signal,keyOf:row=>row.closure_id+':'+row.order_item_id}))
    if(current!==generation || user.value?.id!==uid)return
    rows.value=closures.map(closure=>({...closure,items:items.filter(row=>row.closure_id===closure.id)}))
  }catch(value){if(current===generation && value.name!=='AbortError')error.value='Chưa tải được lịch sử giá chốt.'}
  finally{if(current===generation)loading.value=false}
}
function toggle(event){opened.value=event.target.open;if(opened.value && !rows.value.length)void load()}
const name=id=>props.menu.orders?.find(order=>order.user_id===id)?.user?.full_name || 'Thành viên'
const price=value=>value==null?'Chưa có giá':Number(value).toLocaleString('vi-VN')+'đ'
</script>
<template><details class="closure-history" :open="opened" @toggle="toggle"><summary>Lịch sử giá chốt</summary><p class="meta">Mỗi phiên giữ nguyên món và giá tại lúc chốt. Trạng thái đã trả được quản lý trên đơn hiện tại.</p><p v-if="loading" class="meta" role="status">Đang tải các phiên chốt…</p><p v-if="error" class="alert" role="alert">{{ error }} <button type="button" @click="load">Thử lại</button></p><article v-for="row in rows" :key="row.id" class="closure-revision"><h3>Phiên {{ row.revision }} <span v-if="row.id===menu.current_closure_id">· Mới nhất</span></h3><p class="meta">{{ new Date(row.closed_at).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}) }} · {{ row.payment_mode==='sponsored'?'Được mời · Người ăn không cần trả':'Tự thanh toán' }}</p><ul><li v-for="item in row.items" :key="item.order_item_id"><span>{{ name(item.user_id) }} · {{ item.name_snapshot }}</span><strong>{{ price(item.unit_price) }}</strong></li></ul><p v-if="!row.items.length" class="meta">Không có món trong phiên này.</p></article></details></template>
<style scoped>.closure-history{margin:16px 0}.closure-history summary{min-height:44px;align-content:center;cursor:pointer;font-size:14px}.closure-revision{padding:16px 0;border-top:1px solid var(--line)}.closure-revision h3{font-size:16px}.closure-revision ul{list-style:none;padding:0;margin:12px 0}.closure-revision li{display:flex;justify-content:space-between;gap:16px;padding:8px 0;font-size:14px;overflow-wrap:anywhere}.closure-revision li strong{white-space:nowrap}.closure-history .meta{font-size:13px}</style>

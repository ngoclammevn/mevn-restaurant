<script setup>
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import { useUser } from '@clerk/vue'
import { useMenus } from '../composables/useMenus'
import { useSupabaseClient } from '../lib/supabase'
import { useSlackNotifications } from '../composables/useSlackNotifications'
import CloseMenuDialog from './CloseMenuDialog.vue'
import MenuClosureHistory from './MenuClosureHistory.vue'
import MenuPickupPanel from './MenuPickupPanel.vue'
import MenuReminderField from './MenuReminderField.vue'
import SlackDeliveryStatus from './SlackDeliveryStatus.vue'
import SlackPublishDialog from './SlackPublishDialog.vue'
import { AppButton } from './ui'
const props=defineProps({menu:{type:Object,required:true},disabled:Boolean})
const emit=defineEmits(['updated','busy'])
const {user}=useUser(),{setMenuClosed,getMenu}=useMenus(),sb=useSupabaseClient()
const notifications=useSlackNotifications(),sharing=useSlackNotifications(),reminders=useSlackNotifications()
const owner=computed(()=>props.menu.poster_id===user.value?.id)
const showClose=ref(false),showShare=ref(false),busy=ref(false),error=ref(''),reminderAt=ref(props.menu.reminder_at || null),savingReminder=ref(false)
let generation=0,waitForClose=null,resolveClose=null
function setBusy(value){busy.value=value;emit('busy',value)}
function cancelClose(){if(busy.value)return;showClose.value=false;resolveClose?.(false);resolveClose=null;waitForClose=null}
function reset(){generation++;showClose.value=false;showShare.value=false;error.value='';savingReminder.value=false;reminderAt.value=props.menu.reminder_at || null;setBusy(false);resolveClose?.(false);resolveClose=null;waitForClose=null}
watch([()=>props.menu.id,()=>user.value?.id],()=>{reset();if(owner.value)void notifications.syncPendingForMyMenus([props.menu.id])},{immediate:true})
watch(()=>props.menu.reminder_at,value=>{reminderAt.value=value || null})
onUnmounted(()=>{generation++;resolveClose?.(false);emit('busy',false)})
function closeMenu(){
  if(!owner.value || busy.value || props.disabled || props.menu.archived_at)return Promise.resolve(false)
  if(props.menu.is_closed)return Promise.resolve(true)
  if(waitForClose)return waitForClose
  error.value='';showClose.value=true
  waitForClose=new Promise(resolve=>{resolveClose=resolve})
  return waitForClose
}
async function confirmClose(selection){
  if(!owner.value || busy.value || props.disabled || props.menu.archived_at)return
  const current=generation,uid=user.value?.id,id=props.menu.id
  setBusy(true);error.value=''
  try{
    const result=await setMenuClosed(id,true,selection)
    if(current!==generation || uid!==user.value?.id)return
    if(result.error || (!result.committed && !result.data))throw result.error || new Error('missing_menu')
    const snapshotFresh=!!result.data?.is_closed && result.data.current_closure?.id===result.data.current_closure_id && Array.isArray(result.data.current_closure?.items)
    if(result.data)emit('updated',result.data)
    await nextTick()
    if(current!==generation || uid!==user.value?.id)return
    showClose.value=false;setBusy(false);resolveClose?.(snapshotFresh);resolveClose=null;waitForClose=null
    if(!snapshotFresh)error.value='Đã chốt menu. Chưa tải được bảng đối soát mới; tải lại trước khi sao chép.'
    void notifications.notifyClosure(result.closureResult || {menu_id:id,revision:result.data?.current_closure?.revision})
    if(result.data?.reminder_at || props.menu.reminder_at)void reminders.syncReminder(id)
  }catch{if(current===generation)error.value='Chưa chốt được. Menu hoặc danh sách người nhận có thể vừa thay đổi; tải lại danh sách rồi thử lại.'}
  finally{if(current===generation)setBusy(false)}
}
async function reopenMenu(){
  if(!owner.value || busy.value || props.disabled || props.menu.archived_at)return false
  if(!props.menu.is_closed)return true
  if(!confirm('Mở lại nhận đơn? Giá đã chốt trước đó vẫn được lưu trong lịch sử.'))return false
  const current=generation,uid=user.value?.id,id=props.menu.id
  setBusy(true);error.value=''
  try{
    const result=await setMenuClosed(id,false)
    if(current!==generation || uid!==user.value?.id)return false
    if(result.error || (!result.committed && !result.data))throw result.error || new Error('missing_menu')
    if(result.data)emit('updated',result.data)
    else error.value='Đã mở lại menu. Chưa tải được dữ liệu mới; vui lòng tải lại.'
    void notifications.notifyReopened({menu_id:id});return true
  }catch{if(current===generation)error.value='Chưa mở lại được menu. Tải lại rồi thử lại.';return false}
  finally{if(current===generation)setBusy(false)}
}
async function pickupChanged(kind){
  const current=generation,id=props.menu.id,uid=user.value?.id
  let result
  try{result=await getMenu(id)}catch{result={error:true}}
  if(current!==generation || uid!==user.value?.id)return
  if(result?.data)emit('updated',result.data)
  else error.value='Đã lưu thay đổi nhận cơm. Chưa tải được dữ liệu mới; vui lòng tải lại.'
  if(kind==='received')void notifications.notifyReceived({menu_id:id})
  else void notifications.notifyPickupChanged({menu_id:id})
}
async function saveReminder(){
  if(!owner.value || savingReminder.value || props.menu.archived_at)return
  const current=generation,uid=user.value?.id,id=props.menu.id
  savingReminder.value=true;error.value=''
  try{
    const result=await sb.rpc('set_lunch_reminder',{p_menu_id:id,p_at:reminderAt.value})
    if(current!==generation || uid!==user.value?.id)return
    if(result.error)throw result.error
    let refreshed
    try{refreshed=await getMenu(id)}catch{refreshed={error:true}}
    if(current!==generation || uid!==user.value?.id)return
    if(refreshed?.data)emit('updated',refreshed.data)
    else error.value='Đã lưu giờ nhắc. Chưa tải được dữ liệu mới; vui lòng tải lại.'
    await reminders.syncReminder(id)
  }catch{if(current===generation)error.value='Chưa lưu được giờ nhắc. Menu và đơn vẫn được giữ.'}
  finally{if(current===generation)savingReminder.value=false}
}
function retry(api,kind='publish'){const id=props.menu.id;if(api.states.value[id])return api.retryPending(id);return kind==='share'?api.shareMenu(id):kind==='reminder'?api.syncReminder(id):api.publishMenu(id)}
function resolve(api,resolution){const state=api.states.value[props.menu.id];if(state?.eventId)return api.resolveEvent(state.eventId,resolution,props.menu.id)}
defineExpose({closeMenu,reopenMenu})
</script>
<template>
  <section class="menu-coordination">
    <p v-if="menu.payment_mode==='sponsored'" class="sponsored-notice"><strong>{{ menu.poster?.full_name || 'Người đăng' }} mời bữa này</strong><span v-if="menu.sponsor_reason"> · {{ menu.sponsor_reason }}</span>. Bạn không cần chuyển khoản.</p>
    <div v-if="owner && !menu.archived_at" class="card coordination-actions">
      <h2>Điều phối menu</h2><div class="row-wrap"><AppButton :loading="busy" :disabled="disabled" @click="menu.is_closed?reopenMenu():closeMenu()">{{ menu.is_closed?'Mở lại nhận đơn':'Chốt đơn & chọn người nhận' }}</AppButton><AppButton variant="ghost" :disabled="busy" @click="showShare=true">Đăng kênh chung</AppButton></div>
      <p v-if="menu.current_closure" class="meta">Phiên chốt {{ menu.current_closure.revision }} · Giá tại lúc chốt được giữ cho đối soát.</p>
      <SlackDeliveryStatus v-if="notifications.states.value[menu.id]" :state="notifications.states.value[menu.id]" @retry="retry(notifications)" @resolve="resolve(notifications,$event)" />
      <details><summary>Nhắc đặt cơm trên Slack</summary><MenuReminderField v-model="reminderAt" :menu-date="menu.menu_date" :disabled="busy || savingReminder || menu.is_closed" /><AppButton variant="ghost" :disabled="busy || menu.is_closed" :loading="savingReminder" @click="saveReminder">Lưu lịch nhắc</AppButton><SlackDeliveryStatus v-if="reminders.states.value[menu.id]" :state="reminders.states.value[menu.id]" @retry="retry(reminders,'reminder')" @resolve="resolve(reminders,$event)" /></details>
    </div>
    <MenuPickupPanel v-if="!menu.archived_at" :menu="menu" @changed="pickupChanged" /><MenuClosureHistory v-if="menu.current_closure_id" :menu="menu" />
    <p v-if="error && !showClose" class="alert" role="alert">{{ error }}</p>
    <CloseMenuDialog :open="showClose" :menu="menu" :busy="busy" :error="error" @close="cancelClose" @confirm="confirmClose" />
    <SlackPublishDialog v-if="showShare && owner" :menu="menu" :state="sharing.states.value[menu.id] || {status:'pending'}" @close="showShare=false" @publish="sharing.shareMenu(menu.id)" @retry="retry(sharing,'share')" @resolve="resolve(sharing,$event)" />
  </section>
</template>
<style scoped>.coordination-actions{display:grid;gap:14px;margin:20px 0}.coordination-actions h2{font-size:20px;margin:0}.coordination-actions details{border-top:1px solid var(--line);padding-top:8px}.coordination-actions summary{cursor:pointer;min-height:44px;align-content:center;font-size:14px}.coordination-actions details .btn{margin-top:12px}.sponsored-notice{padding:16px;background:var(--bg-tint);border:1px solid var(--line);border-radius:12px;font-size:14px}</style>

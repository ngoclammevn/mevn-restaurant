<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useUser } from '@clerk/vue'
import { usePickup } from '../composables/usePickup'
import PickupPreferenceForm from './PickupPreferenceForm.vue'
import { AppButton, Avatar } from './ui'
const props=defineProps({menu:{type:Object,required:true}})
const emit=defineEmits(['changed'])
const {user}=useUser(),api=usePickup()
const pickup=ref(null),loading=ref(false),busy=ref(false),error=ref(''),showPreferences=ref(false),form=ref(null)
const poster=computed(()=>props.menu.poster_id===user.value?.id)
const canReceive=computed(()=>pickup.value?.status==='assigned' && (poster.value || pickup.value.primary_user_id===user.value?.id))
const contact=computed(()=>pickup.value?.contacts?.find(row=>row.user_id===pickup.value.primary_user_id)?.phone_e164)
let generation=0
async function load(){
  const current=++generation,uid=user.value?.id
  pickup.value=null;error.value=''
  if(!uid)return
  loading.value=true
  try{const result=await api.getPickup(props.menu.id);if(current!==generation || user.value?.id!==uid)return;if(result.error)throw result.error;pickup.value=result.data}
  catch{if(current===generation)error.value='Chưa tải được phân công nhận cơm.'}
  finally{if(current===generation)loading.value=false}
}
watch([()=>props.menu.id,()=>props.menu.current_closure_id,()=>user.value?.id],load,{immediate:true})
onUnmounted(()=>generation++)
async function change(kind){
  if(busy.value || !pickup.value)return
  const current=generation,uid=user.value?.id
  if(kind==='backup' && !confirm('Chuyển sang người dự phòng và nhắc họ trên Slack?'))return
  busy.value=true;error.value=''
  try{
    const result=kind==='backup'?await api.activateBackup(pickup.value.id,pickup.value.version):await api.markReceived(pickup.value.id)
    if(current!==generation || user.value?.id!==uid)return
    if(result.error)throw result.error
    await load();emit('changed',kind==='backup'?'pickup_changed':'received')
  }catch{if(user.value?.id===uid)error.value='Chưa cập nhật được lượt nhận cơm. Tải lại rồi thử lại.'}
  finally{busy.value=false}
}
async function savePreferences(){if(await form.value?.save()){showPreferences.value=false;await load()}}
</script>
<template>
  <section v-if="user" class="card pickup-panel">
    <h2>Lấy cơm</h2><p v-if="loading" class="meta" role="status">Đang tải…</p>
    <div v-if="pickup && pickup.status!=='unassigned'" class="pickup-person"><Avatar :profile="pickup.primary" :size="40" /><div><strong>{{ pickup.primary?.full_name || 'Người lấy cơm' }}</strong><p class="meta">{{ pickup.status==='received'?'Đã lấy cơm':'Người lấy cơm' }}</p><a v-if="contact && pickup.status==='assigned'" :href="'tel:'+contact">{{ contact }}</a></div></div>
    <p v-else-if="!loading" class="meta">{{ menu.is_closed ? 'Chưa chọn người lấy cơm.' : 'Chốt đơn rồi chọn người lấy cơm nhé.' }}</p>
    <p v-if="pickup?.backup" class="meta">Dự phòng: {{ pickup.backup.full_name }}</p>
    <div class="row-wrap"><AppButton v-if="canReceive" :loading="busy" @click="change('received')">Đã lấy cơm</AppButton><AppButton v-if="poster && pickup?.backup_user_id && pickup.status==='assigned'" variant="ghost" :disabled="busy" @click="change('backup')">Gọi người dự phòng</AppButton><AppButton variant="ghost" :disabled="busy" @click="showPreferences=!showPreferences">{{ showPreferences?'Đóng':'Thông tin của mình' }}</AppButton></div>
    <PickupPreferenceForm v-if="showPreferences" ref="form" :date="menu.menu_date" :disabled="busy"><template #actions="{saving}"><AppButton variant="ghost" :loading="saving" @click="savePreferences">Lưu thông tin</AppButton></template></PickupPreferenceForm>
    <p v-if="error" class="alert" role="alert">{{ error }} <button type="button" @click="load">Thử lại</button></p>
  </section>
</template>
<style scoped>.pickup-panel{margin:20px 0;display:grid;gap:14px}.pickup-panel h2{font-size:20px;margin:0}.pickup-person{display:flex;align-items:center;gap:12px}.pickup-person p{margin:4px 0}.pickup-panel .meta{font-size:13px}</style>

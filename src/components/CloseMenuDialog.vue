<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useUser } from '@clerk/vue'
import { usePickup } from '../composables/usePickup'
import { choosePickupCandidate } from '../../shared/pickup.js'
import PickupPreferenceForm from './PickupPreferenceForm.vue'
import { AppDialog, AppButton } from './ui'
const props=defineProps({open:Boolean,menu:Object,busy:Boolean,error:String})
const emit=defineEmits(['close','confirm'])
const {user}=useUser(), api=usePickup()
const candidates=ref([]),primary=ref(''),backup=ref(''),loading=ref(false),loadError=ref(''),registerSelf=ref(false),preferences=ref(null)
const completedPickup=ref(null),manualDelivery=ref(false)
const eligible=computed(()=>candidates.value.filter(row=>row.available && row.phone_e164))
let generation=0
async function load(){
  const current=++generation,uid=user.value?.id
  candidates.value=[];primary.value='';backup.value='';loadError.value='';registerSelf.value=false;completedPickup.value=null;manualDelivery.value=false
  if(!props.open || !props.menu || !uid)return
  loading.value=true
  try{
    const [result,previous]=await Promise.all([api.listCandidates(props.menu.id),api.getPickup(props.menu.id)])
    if(current!==generation || user.value?.id!==uid)return
    if(result.error)throw result.error
    candidates.value=result.data || []
    if(previous.data?.status==='received'){completedPickup.value=previous.data;primary.value=previous.data.primary_user_id;backup.value=''}
    if(!completedPickup.value && eligible.value.some(row=>row.user_id===previous.data?.primary_user_id))primary.value=previous.data.primary_user_id
    if(!completedPickup.value && eligible.value.some(row=>row.user_id===previous.data?.backup_user_id))backup.value=previous.data.backup_user_id
  }catch{if(current===generation)loadError.value='Chưa tải được danh sách người nhận. Thử lại.'}
  finally{if(current===generation)loading.value=false}
}
watch([()=>props.open,()=>props.menu?.id],load,{immediate:true})
onUnmounted(()=>generation++)
function draw(){const selected=choosePickupCandidate(eligible.value);primary.value=selected?.user_id || '';if(backup.value===primary.value)backup.value=''}
async function saveSelf(){if(await preferences.value?.save()){await load();if(eligible.value.some(row=>row.user_id===user.value?.id))primary.value=user.value.id}}
watch(primary,value=>{if(value && backup.value===value)backup.value=''})
function confirm(){if((!primary.value && !manualDelivery.value) || (primary.value && primary.value===backup.value))return;emit('confirm',{primaryUserId:manualDelivery.value?null:primary.value,backupUserId:manualDelivery.value?null:backup.value || null,allowUnassigned:manualDelivery.value,expectedRevision:props.menu.current_closure?.revision || 0})}
</script>
<template>
  <AppDialog :open="open" title="Chốt đơn và chọn người nhận cơm" @close="!busy && emit('close')">
    <div class="stack"><p>Chốt sẽ khóa thay đổi món, giữ giá tại thời điểm này. Mỗi người vẫn tự xác nhận thanh toán.</p>
      <p v-if="loading" role="status" class="meta">Đang kiểm tra người có thể nhận cơm…</p>
      <p v-if="loadError" class="alert" role="alert">{{ loadError }} <button type="button" @click="load">Thử lại</button></p>
      <template v-if="!loading && !loadError">
        <p v-if="completedPickup" class="meta">Cơm đã được nhận bởi {{ completedPickup.primary?.full_name || 'người nhận trước đó' }}. Lần chốt này chỉ cập nhật bảng đối soát; giữ nguyên lịch sử nhận hàng.</p><p v-if="!eligible.length && !completedPickup" class="meta">Chưa có người đăng ký nhận cơm với số liên hệ hợp lệ. Bạn có thể đăng ký tự nhận.</p>
        <AppButton v-if="eligible.length && !completedPickup" variant="ghost" :disabled="busy" @click="draw">Bốc thăm người nhận · ưu tiên người ít nhận gần đây</AppButton>
        <label v-if="eligible.length && !completedPickup" class="field">Người nhận chính<select v-model="primary" class="input" :disabled="busy"><option value="">Chọn người nhận</option><option v-for="row in eligible" :key="row.user_id" :value="row.user_id">{{ row.full_name }} · {{ row.received_count }} lần/30 ngày</option></select></label>
        <label v-if="eligible.length > 1 && !completedPickup" class="field">Người dự phòng · không bắt buộc<select v-model="backup" class="input" :disabled="busy"><option value="">Không chọn</option><option v-for="row in eligible.filter(item=>item.user_id!==primary)" :key="row.user_id" :value="row.user_id">{{ row.full_name }}</option></select></label>
        <AppButton v-if="!completedPickup && !eligible.some(row=>row.user_id===user?.id)" variant="ghost" :disabled="busy" @click="registerSelf=!registerSelf">Tôi có thể nhận cơm</AppButton>
        <PickupPreferenceForm v-if="registerSelf" ref="preferences" :date="menu.menu_date" :disabled="busy"><template #actions><AppButton variant="ghost" @click="saveSelf">Lưu đăng ký của tôi</AppButton></template></PickupPreferenceForm>
        <label v-if="!eligible.length && !completedPickup" class="field"><span class="row"><input v-model="manualDelivery" type="checkbox" :disabled="busy" /> Tôi tự thu xếp nhận hàng, chốt trước và chưa phân công trong app</span></label><p v-if="primary && !completedPickup" class="meta">Chỉ người nhận chính sẽ được bot tag. Người dự phòng chỉ được gọi khi bạn kích hoạt thay thế.</p>
      </template><p v-if="error" class="alert" role="alert">{{ error }}</p>
    </div>
    <template #footer><AppButton variant="ghost" :disabled="busy" @click="emit('close')">Quay lại</AppButton><AppButton :loading="busy" :disabled="loading || (!primary && !manualDelivery) || (!!primary && primary===backup)" @click="confirm">Xác nhận & chốt đơn</AppButton></template>
  </AppDialog>
</template>

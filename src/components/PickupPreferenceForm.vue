<script setup>
import { ref, watch, onUnmounted } from 'vue'
import { useUser } from '@clerk/vue'
import { usePickup } from '../composables/usePickup'
import { normalizePickupPhone } from '../../shared/pickup.js'
import { AppButton } from './ui'
const props=defineProps({date:{type:String,required:true},enabled:{type:Boolean,default:true},disabled:Boolean})
const emit=defineEmits(['saved'])
const {user}=useUser(), api=usePickup()
const loading=ref(false), saving=ref(false), available=ref(null), phone=ref(''), savedPhone=ref(''), editing=ref(true), editingPhone=ref(false), error=ref(''), ready=ref(false)
let generation=0, loadedChoice=null
async function load(){
  const current=++generation, uid=user.value?.id
  ready.value=false; saving.value=false; error.value=''; phone.value=''; savedPhone.value=''; available.value=null; loadedChoice=null; editing.value=true; editingPhone.value=false
  if(!uid || !props.enabled){loading.value=false;return}
  loading.value=true
  try{
    const result=await api.getPreferences(props.date)
    if(current!==generation || user.value?.id!==uid)return
    if(result.error)throw result.error
    savedPhone.value=result.data?.contact?.phone_e164 || ''; phone.value=savedPhone.value
    loadedChoice=result.data?.availability?.available ?? null; available.value=loadedChoice
    editing.value=loadedChoice===null; ready.value=true
  }catch{if(current===generation)error.value='Chưa tải được thông tin nhận cơm. Thử lại trước khi lưu.'}
  finally{if(current===generation)loading.value=false}
}
watch([()=>props.date,()=>props.enabled,()=>user.value?.id],load,{immediate:true})
onUnmounted(()=>generation++)
function validate(){
  if(!props.enabled)return true
  error.value=''
  if(!ready.value){error.value='Chưa tải xong thông tin nhận cơm. Vui lòng thử lại.';return false}
  if(available.value===null){error.value='Chọn hôm nay bạn có thể nhận cơm hay không.';return false}
  if(available.value || editingPhone.value){
    try{normalizePickupPhone(phone.value)}catch{error.value='Nhập số di động Việt Nam hợp lệ, ví dụ 0901234567.';return false}
  }
  return true
}
async function save(){
  if(!props.enabled)return true
  if(!validate() || saving.value)return false
  if(available.value===loadedChoice && !editingPhone.value)return true
  const uid=user.value?.id,current=generation
  saving.value=true
  try{
    const result=available.value===loadedChoice && editingPhone.value
      ? await api.updatePhone(phone.value)
      : await api.savePreferences({date:props.date,available:available.value,phone:editingPhone.value || available.value && !savedPhone.value ? phone.value : null})
    if(current!==generation || user.value?.id!==uid)return false
    if(result.error)throw result.error
    if(available.value || editingPhone.value){savedPhone.value=normalizePickupPhone(phone.value);phone.value=savedPhone.value}
    loadedChoice=available.value;editing.value=false;editingPhone.value=false;emit('saved');return true
  }catch{if(current===generation)error.value='Chưa lưu được thông tin nhận cơm. Đơn đã lưu vẫn được giữ; bạn có thể thử lại ở đây.';return false}
  finally{if(current===generation)saving.value=false}
}
defineExpose({validate,save,reload:load})
</script>
<template>
  <section v-if="enabled" class="pickup-preferences" aria-labelledby="pickup-question" :aria-busy="loading || saving">
    <h3 id="pickup-question">Hôm nay bạn có thể xuống nhận cơm không?</h3>
    <p v-if="loading" class="meta" role="status">Đang tải lựa chọn đã lưu…</p>
    <template v-else-if="ready">
      <fieldset v-if="editing" :disabled="disabled || saving"><legend class="sr-only">Khả năng nhận cơm hôm nay</legend><label><input v-model="available" type="radio" :value="true" /> Có thể nhận</label><label><input v-model="available" type="radio" :value="false" /> Hôm nay không tiện</label></fieldset>
      <div v-else class="row-wrap"><span>{{ available ? 'Hôm nay: có thể nhận cơm' : 'Hôm nay: không tiện nhận cơm' }}</span><AppButton variant="ghost" size="sm" :disabled="disabled || saving" @click="editing=true">Thay đổi</AppButton></div>
      <template v-if="available || savedPhone">
        <label v-if="!savedPhone || editingPhone" class="field">Số điện thoại nhận cơm<input v-model.trim="phone" type="tel" inputmode="tel" autocomplete="tel" class="input" maxlength="24" :disabled="disabled || saving" placeholder="0901234567" /><span class="meta">Số này chỉ lưu một lần, chỉ người cần điều phối được xem.</span></label>
        <div v-else class="row-wrap"><span class="meta">Số đã lưu: {{ savedPhone }}</span><AppButton variant="ghost" size="sm" :disabled="disabled || saving" @click="editingPhone=true">Đổi số</AppButton></div>
      </template>
    </template>
    <p v-if="error" class="alert" role="alert">{{ error }} <button v-if="!ready && !loading" type="button" @click="load">Thử lại</button></p>
    <slot name="actions" :save="save" :saving="saving" />
  </section>
  <p v-else class="meta">Người được đặt hộ tự đăng ký khả năng nhận cơm và số điện thoại của họ trong menu.</p>
</template>
<style scoped>
.pickup-preferences{padding:16px;border:1px solid var(--line);border-radius:12px;background:var(--bg-tint);display:grid;gap:12px}.pickup-preferences h3{font-size:15px;margin:0}.pickup-preferences fieldset{border:0;margin:0;padding:0;display:flex;gap:18px;flex-wrap:wrap}.pickup-preferences label{min-height:44px;display:flex;align-items:center;gap:8px;font-size:14px}.pickup-preferences .field{display:grid;align-items:start}.pickup-preferences .meta{font-size:12px;margin:0}.sr-only{position:absolute;clip-path:inset(50%);width:1px;height:1px;overflow:hidden}
</style>

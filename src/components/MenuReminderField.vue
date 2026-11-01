<script setup>
import { computed, ref, useId, watch } from 'vue'
import GlassInput from './ui/liquid/GlassInput.vue'
import { AppButton } from './ui'
const props=defineProps({modelValue:{type:String,default:null},menuDate:{type:String,required:true},disabled:Boolean})
const emit=defineEmits(['update:modelValue'])
const id='reminder-'+useId(), error=ref(''), draft=ref('')
const localTime=computed(()=>props.modelValue?new Date(Date.parse(props.modelValue)+7*3600000).toISOString().slice(11,16):'')
const dateLabel=computed(()=>props.menuDate.split('-').reverse().join('/'))
watch(localTime,value=>{draft.value=value;error.value=''},{immediate:true})
watch(()=>props.menuDate,()=>{error.value=''})
function update(value){
  if(props.disabled)return
  const time=value.trim()
  if(!time){error.value='';emit('update:modelValue',null);return}
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)){draft.value=localTime.value;error.value=localTime.value ? `Giờ chưa hợp lệ. App giữ giờ ${localTime.value}; nhập theo dạng 10:45 nhé.` : 'Nhập giờ theo dạng 10:45 nhé.';return}
  draft.value=time;error.value=''
  emit('update:modelValue',new Date(`${props.menuDate}T${time}:00+07:00`).toISOString())
}
</script>
<template>
 <div class="menu-reminder-field">
  <div class="reminder-heading"><label :for="id">Giờ nhắc đặt cơm</label><span>{{ dateLabel }} · giờ Việt Nam</span></div>
  <div class="reminder-presets" role="group" aria-label="Giờ nhắc gợi ý"><AppButton v-for="time in ['10:30','10:45','11:00','11:15']" :key="time" variant="ghost" :disabled="disabled" :aria-pressed="localTime===time" @click="update(time)">{{ time }}</AppButton></div>
  <div class="reminder-custom"><GlassInput :id="id" v-model="draft" type="text" inputmode="numeric" autocomplete="off" maxlength="5" placeholder="Giờ khác, vd. 10:50" :disabled="disabled" :aria-describedby="id+'-hint'" :aria-invalid="!!error" @blur="update(draft)" /><AppButton v-if="modelValue" variant="ghost" :disabled="disabled" @click="update('')">Tắt nhắc</AppButton></div>
  <p v-if="error" class="alert" role="alert">{{ error }}</p>
  <p v-if="!modelValue" class="reminder-state">Chưa bật lịch nhắc.</p>
  <small :id="id+'-hint'">Bot nhắc trong thread đặt cơm; mọi người trong kênh đều thấy. Chọn giờ trước khi chốt đơn. Bạn đóng trình duyệt thì bot vẫn nhắc.</small>
 </div>
</template>
<style scoped>
.menu-reminder-field{display:grid;gap:14px;min-width:0}.reminder-heading{display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex-wrap:wrap}.reminder-heading label{font-size:16px;font-weight:600}.reminder-heading span,.menu-reminder-field small,.reminder-state{font-size:14px;line-height:1.6;color:var(--ink-soft)}.reminder-presets{display:flex;gap:8px;flex-wrap:wrap}.reminder-presets :deep([aria-pressed=true]){background:var(--primary-soft);color:var(--primary-ink);box-shadow:inset 0 0 0 1px var(--primary)}.reminder-custom{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.reminder-custom>:first-child{flex:1;min-width:0;max-width:320px}.reminder-state{margin:0}.menu-reminder-field .alert{margin:0}@media(max-width:480px){.reminder-presets{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))}.reminder-presets :deep(button){padding-inline:8px;min-width:0}.reminder-custom>:first-child{max-width:none;flex-basis:100%}}
</style>

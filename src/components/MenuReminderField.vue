<script setup>
import { computed } from 'vue'
const props=defineProps({modelValue:{type:String,default:null},menuDate:{type:String,required:true},disabled:Boolean})
const emit=defineEmits(['update:modelValue'])
const localValue=computed(()=>props.modelValue?new Date(Date.parse(props.modelValue)+7*3600000).toISOString().slice(0,16):'')
function update(value){emit('update:modelValue',value?new Date(`${value}:00+07:00`).toISOString():null)}
</script>
<template>
 <div class="menu-reminder-field"><label for="menu-reminder-at">Nhắc đặt cơm trên Slack (giờ Việt Nam)</label><div><input id="menu-reminder-at" type="datetime-local" :value="localValue" :min="`${menuDate}T00:00`" :max="`${menuDate}T23:59`" :disabled="disabled" @change="update($event.target.value)"/><button v-if="modelValue" type="button" :disabled="disabled" @click="update('')">Tắt nhắc</button></div><small>Chọn giờ trong ngày menu, trước lúc bạn định chốt. Slack vẫn nhắc khi bạn đóng trình duyệt.</small></div>
</template>
<style scoped>
.menu-reminder-field{display:grid;gap:.5rem}.menu-reminder-field>div{display:flex;gap:.5rem;flex-wrap:wrap}.menu-reminder-field input,.menu-reminder-field button{padding:.6rem;border:1px solid var(--border,#cbd5e1);border-radius:8px;background:var(--bg-input,#fff);color:inherit}.menu-reminder-field small{color:var(--text-secondary,#64748b)}
</style>

<script setup>
import GlassInput from './ui/liquid/GlassInput.vue'
defineProps({modelValue:{type:String,default:'self'},reason:{type:String,default:''},disabled:Boolean})
defineEmits(['update:modelValue','update:reason'])
</script>
<template><fieldset class="sponsorship-field" :disabled="disabled"><legend>Thanh toán bữa này</legend><label class="payment-choice" :class="{selected:modelValue==='self'}"><input type="radio" :checked="modelValue==='self'" @change="$emit('update:modelValue','self')" /> Mọi người tự thanh toán</label><label class="payment-choice" :class="{selected:modelValue==='sponsored'}"><input type="radio" :checked="modelValue==='sponsored'" @change="$emit('update:modelValue','sponsored')" /> Tôi mời cả nhóm · không cần trả tiền</label><div v-if="modelValue==='sponsored'" class="field"><GlassInput label="Nhân dịp gì? · Không bắt buộc" maxlength="240" :model-value="reason" placeholder="Sinh nhật, hoàn thành dự án…" @update:modelValue="$emit('update:reason',$event)" /></div><p v-if="modelValue==='sponsored'" class="meta">Không ai phải trả tiền bữa này.</p></fieldset></template>
<style scoped>
.sponsorship-field { border:0; padding:0; margin:0; min-width:0; display:grid; gap:12px; }
.sponsorship-field legend { padding:0; margin-bottom:12px; font-size:17px; font-weight:650; }
.payment-choice { display:flex; align-items:center; gap:12px; padding:14px 16px; min-height:52px; border-radius:var(--radius-field); background:var(--bg-tint); font-size:16px; line-height:1.5; cursor:pointer; }
.payment-choice.selected { background:var(--primary-soft); color:var(--primary-ink); }
.payment-choice input { width:22px; height:22px; flex:none; accent-color:var(--primary); }
.sponsorship-field:disabled .payment-choice { opacity:.6; cursor:default; }
.sponsorship-field p { margin:0; font-size:14px; line-height:1.6; color:var(--ink-soft); }
</style>

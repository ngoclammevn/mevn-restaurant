<script setup>
import GlassInput from './ui/liquid/GlassInput.vue'
defineProps({ modelValue: {type:String,default:''}, busy:Boolean, error:String, verifiedName:String })
defineEmits(['update:modelValue','save'])
</script>
<template>
  <div class="slack-account-field">
    <span class="slack-account-label">Slack member ID</span>
    <p>Trong Slack, mở hồ sơ → More → Copy member ID. Để bot nhắc đúng người lấy cơm.</p>
    <div><GlassInput id="slack-member-id" aria-label="Slack member ID" :model-value="modelValue" placeholder="U0123456789" autocomplete="off" spellcheck="false" @update:model-value="$emit('update:modelValue',$event.trim())" /><button type="button" :disabled="busy || !/^[UW][A-Z0-9]{8,20}$/.test(modelValue)" @click="$emit('save',modelValue)">{{ busy?'Đang kiểm tra…':'Kiểm tra và lưu' }}</button></div>
    <span v-if="verifiedName" role="status">Đã liên kết: {{ verifiedName }}</span><span v-if="error" role="alert">{{ error }}</span>
  </div>
</template>
<style scoped>
.slack-account-field{display:grid;gap:.5rem}.slack-account-field p{font-size:.82rem;color:var(--text-secondary,#64748b);margin:0}.slack-account-field>div{display:flex;gap:.5rem;flex-wrap:wrap}.slack-account-label{font-size:16px;font-weight:600}.slack-account-field p{font-size:14px}.slack-account-field .glass-input-host{flex:1 1 220px}.slack-account-field button{min-height:48px;padding:0 18px;font-size:16px;font-weight:600;border:1px solid var(--line-strong,#cbd5e1);border-radius:var(--radius-control);background:var(--card,#fff);color:var(--ink);cursor:pointer}.slack-account-field button:disabled{opacity:.5;cursor:not-allowed}
</style>

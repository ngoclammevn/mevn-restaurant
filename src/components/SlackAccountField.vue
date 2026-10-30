<script setup>
defineProps({ modelValue: {type:String,default:''}, busy:Boolean, error:String, verifiedName:String })
defineEmits(['update:modelValue','save'])
</script>
<template>
  <div class="slack-account-field">
    <label for="slack-member-id">Slack member ID</label>
    <p>Trong Slack, mở hồ sơ → More → Copy member ID. Để bot nhắc đúng người lấy cơm.</p>
    <div><input id="slack-member-id" :value="modelValue" placeholder="U0123456789" autocomplete="off" spellcheck="false" @input="$emit('update:modelValue',$event.target.value.trim())" /><button type="button" :disabled="busy || !/^[UW][A-Z0-9]{8,20}$/.test(modelValue)" @click="$emit('save',modelValue)">{{ busy?'Đang kiểm tra…':'Kiểm tra và lưu' }}</button></div>
    <span v-if="verifiedName" role="status">Đã liên kết: {{ verifiedName }}</span><span v-if="error" role="alert">{{ error }}</span>
  </div>
</template>
<style scoped>
.slack-account-field{display:grid;gap:.5rem}.slack-account-field p{font-size:.82rem;color:var(--text-secondary,#64748b);margin:0}.slack-account-field>div{display:flex;gap:.5rem;flex-wrap:wrap}.slack-account-field input{padding:.6rem;border:1px solid var(--border,#cbd5e1);border-radius:8px;min-width:0;flex:1;background:var(--bg-input,#fff);color:inherit}.slack-account-field button{padding:.6rem;border:1px solid var(--border,#cbd5e1);border-radius:8px;cursor:pointer}
</style>

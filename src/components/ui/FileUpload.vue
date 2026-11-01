<script setup>
import { ref, watch, onUnmounted } from 'vue'
import AppButton from './AppButton.vue'
const fileInput = ref(null)
const props = defineProps({ modelValue: { type: Object, default: null }, label: { type: String, default: 'Ảnh thực đơn' }, hint: { type: String, default: 'Chọn ảnh hoặc kéo thả vào đây' }, accept: { type: String, default: 'image/*' }, disabled: Boolean })
const emit = defineEmits(['update:modelValue'])
const preview = ref(''), error = ref(''), dragging = ref(false)
watch(() => props.modelValue, file => {
  if (preview.value) URL.revokeObjectURL(preview.value)
  preview.value = file ? URL.createObjectURL(file) : ''
}, { immediate: true })
onUnmounted(() => { if (preview.value) URL.revokeObjectURL(preview.value) })
function choose(file) {
  if (!file || props.disabled) return
  error.value = ''
  if (!file.type.startsWith('image/')) { error.value = 'Vui lòng chọn một ảnh thực đơn.'; return }
  if (file.size > 5 * 1024 * 1024) { error.value = 'Ảnh quá 5 MB. Hãy chọn ảnh nhỏ hơn.'; return }
  emit('update:modelValue', file)
}
function drop(event) { dragging.value = false; choose(event.dataTransfer?.files[0]) }
</script>
<template>
  <div class="stack-sm file-upload">
    <div class="field upload-label"><span>{{ label }}</span><input ref="fileInput" type="file" hidden :accept="accept" :disabled="disabled" @change="choose($event.target.files[0]); $event.target.value = ''" /><div class="row-wrap"><AppButton variant="ghost" :disabled="disabled" :aria-label="`Chọn ${label.toLowerCase()}`" @click="fileInput?.click()">{{ modelValue ? 'Đổi ảnh' : 'Chọn ảnh' }}</AppButton><span v-if="!modelValue" class="meta">Chưa chọn ảnh</span></div></div>
    <div class="upload-well" :class="{ dragging }" @dragover.prevent="dragging = !disabled" @dragleave.prevent="dragging = false" @drop.prevent="drop">
      <template v-if="modelValue">
        <img :src="preview" alt="Thực đơn xem trước" class="post-image" />
        <div class="upload-file-info"><span class="meta upload-file-name">{{ modelValue.name }} · {{ (modelValue.size / 1024 / 1024).toFixed(1) }} MB</span><AppButton variant="ghost" class="upload-remove" :disabled="disabled" @click="emit('update:modelValue', null)">Bỏ ảnh</AppButton></div>
      </template>
      <p v-else class="meta upload-hint">{{ hint }} · Tối đa 5 MB</p>
    </div>
    <p v-if="error" class="alert" role="alert">{{ error }}</p>
  </div>
</template>
<style scoped>
.file-upload { min-width:0; width:100%; }
.upload-label { min-width:0; font-size:16px; font-weight:600; color:var(--ink); overflow-wrap:anywhere; }
.upload-well { min-width:0; padding:14px; border:1px dashed var(--line-strong); border-radius:18px; background:var(--bg-tint); }
.upload-well.dragging { border-color:var(--primary); background:var(--primary-soft); }
.post-image { display:block; width:100%; height:auto; max-height:300px; object-fit:contain; border-radius:6px; background:var(--card); }
.upload-file-info { display:flex; align-items:center; gap:12px; min-width:0; margin-top:12px; }
.upload-file-name { flex:1; min-width:0; overflow-wrap:anywhere; font-size:14px; color:var(--ink-soft); }
.upload-remove { flex:none; min-height:44px; font-size:16px; font-weight:600; border-radius:var(--radius-control); }
.upload-hint { margin:6px 0; font-size:14px; line-height:1.6; color:var(--ink-soft); overflow-wrap:anywhere; }
@media(max-width:540px) {
  .upload-well { padding:12px; }
  .post-image { max-height:240px; }
  .upload-file-info { align-items:flex-start; flex-wrap:wrap; gap:8px; }
  .upload-file-name { flex-basis:100%; }
  .upload-remove { margin-left:auto; }
}
</style>

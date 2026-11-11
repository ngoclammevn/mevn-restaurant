<script setup>
import { ref, watch, onUnmounted } from 'vue'
import AppButton from './AppButton.vue'
import AppIcon from './AppIcon.vue'
const fileInput = ref(null)
const props = defineProps({ modelValue: { type: Object, default: null }, label: { type: String, default: 'Ảnh thực đơn' }, hint: { type: String, default: 'Kéo thả ảnh vào đây' }, accept: { type: String, default: 'image/*' }, disabled: Boolean })
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
function pick() { if (!props.disabled) fileInput.value?.click() }
function drop(event) { dragging.value = false; choose(event.dataTransfer?.files[0]) }
</script>
<template>
  <div class="stack-sm file-upload">
    <span class="upload-label">{{ label }}</span>
    <input ref="fileInput" type="file" hidden :accept="accept" :disabled="disabled" @change="choose($event.target.files[0]); $event.target.value = ''" />
    <div class="upload-well" :class="{ dragging, empty: !modelValue, disabled }" @dragover.prevent="dragging = !disabled" @dragleave.prevent="dragging = false" @drop.prevent="drop" @click="modelValue || pick()">
      <template v-if="modelValue">
        <img :src="preview" alt="Thực đơn xem trước" class="post-image" />
        <div class="upload-file-info"><span class="meta upload-file-name">{{ modelValue.name }} · {{ (modelValue.size / 1024 / 1024).toFixed(1) }} MB</span><AppButton variant="ghost" class="upload-action" :disabled="disabled" @click.stop="pick">Đổi ảnh</AppButton><AppButton variant="ghost" class="upload-action" :disabled="disabled" @click.stop="emit('update:modelValue', null)">Bỏ ảnh</AppButton></div>
      </template>
      <template v-else>
        <span class="upload-icon-wrap" aria-hidden="true"><AppIcon name="upload" class="upload-icon" /></span>
        <p class="upload-hint">{{ hint }}</p>
        <AppButton :disabled="disabled" :aria-label="`Tải ${label.toLowerCase()} lên`">Tải ảnh lên</AppButton>
        <p class="meta upload-limit">JPG, PNG · Tối đa 5 MB</p>
      </template>
    </div>
    <p v-if="error" class="alert" role="alert">{{ error }}</p>
  </div>
</template>
<style scoped>
.file-upload { min-width:0; width:100%; }
.upload-label { min-width:0; font-size:16px; font-weight:600; color:var(--ink); overflow-wrap:anywhere; }
.upload-well { min-width:0; padding:14px; border:2px dashed var(--line-strong); border-radius:18px; background:var(--bg-tint); transition:border-color .15s, background .15s; }
.upload-well.empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; min-height:220px; padding:28px 16px; text-align:center; cursor:pointer; background:var(--card); }
.upload-well.empty:hover, .upload-well.dragging { border-color:var(--primary); background:var(--primary-soft); }
.upload-well.disabled { cursor:not-allowed; opacity:.6; }
.upload-icon-wrap { display:grid; place-items:center; width:64px; height:64px; border-radius:50%; background:var(--primary-soft); color:var(--primary); }
.upload-icon { width:30px; height:30px; }
.upload-hint { margin:0; font-size:16px; font-weight:600; color:var(--ink); }
.upload-limit { margin:0; font-size:14px; color:var(--ink-soft); }
.post-image { display:block; width:100%; height:auto; max-height:300px; object-fit:contain; border-radius:6px; background:var(--card); }
.upload-file-info { display:flex; align-items:center; gap:8px; min-width:0; margin-top:12px; }
.upload-file-name { flex:1; min-width:0; overflow-wrap:anywhere; font-size:14px; color:var(--ink-soft); }
.upload-action { flex:none; min-height:44px; font-size:16px; font-weight:600; border-radius:var(--radius-control); }
@media(max-width:540px) {
  .upload-well { padding:12px; }
  .upload-well.empty { min-height:180px; }
  .post-image { max-height:240px; }
  .upload-file-info { flex-wrap:wrap; }
  .upload-file-name { flex-basis:100%; }
}
</style>

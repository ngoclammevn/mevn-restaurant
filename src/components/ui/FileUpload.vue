<script setup>
import { ref, watch, onUnmounted } from 'vue'
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
<template><div class="stack-sm"><label class="field">{{ label }}<input type="file" class="input" :accept="accept" :disabled="disabled" @change="choose($event.target.files[0]); $event.target.value = ''" /></label><div class="upload-well" :class="{ dragging }" @dragover.prevent="dragging = !disabled" @dragleave.prevent="dragging = false" @drop.prevent="drop"><template v-if="modelValue"><img :src="preview" alt="Thực đơn xem trước" class="post-image" /><div class="row-wrap"><span class="meta">{{ modelValue.name }} · {{ (modelValue.size / 1024 / 1024).toFixed(1) }} MB</span><button type="button" class="btn btn--ghost btn--sm spacer" :disabled="disabled" @click="emit('update:modelValue', null)">Bỏ ảnh</button></div></template><p v-else class="meta">{{ hint }} · Tối đa 5 MB</p></div><p v-if="error" class="alert" role="alert">{{ error }}</p></div></template>
<style scoped>.upload-well { padding:1rem; border:1px dashed var(--line-strong); border-radius:8px; background:var(--bg-tint); }.upload-well.dragging { border-color:var(--primary); background:var(--primary-soft); }</style>

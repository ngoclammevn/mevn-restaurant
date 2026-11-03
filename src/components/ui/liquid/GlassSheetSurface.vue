<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { GlassSheet } from '@zakisheriff/liquid-glass'
import '@zakisheriff/liquid-glass/styles.css'
const props = defineProps({ title: { type: String, default: '' } })
const emit = defineEmits(['close', 'ready'])
const host = ref(null), target = ref(null)
let root
let gesture
function startDrag(event) {
  const sheet = event.target.closest?.('.lg-sheet')
  if (!sheet || event.target.closest('input, textarea, button, a, [role="slider"], [role="switch"]')) return
  // GlassSheet tự unmount khi kéo đóng; Vue giữ quyền quyết định để parent có thể giữ bản nháp.
  event.stopPropagation()
  if (!event.target.closest('.lg-sheet__grabber-zone') || !event.isPrimary || event.button !== 0) return
  event.preventDefault()
  gesture = { id: event.pointerId, start: event.clientY, distance: 0, sheet }
  sheet.dataset.controlledDrag = ''
  host.value.setPointerCapture?.(event.pointerId)
}
function moveDrag(event) {
  if (!gesture || event.pointerId !== gesture.id) return
  gesture.distance = Math.max(0, event.clientY - gesture.start)
  gesture.sheet.style.translate = `0 ${Math.min(gesture.distance, 360)}px`
  if (event.cancelable) event.preventDefault()
}
function finishDrag(event) {
  if (!gesture || event.pointerId !== gesture.id) return
  const { sheet, distance, id } = gesture
  gesture = undefined
  delete sheet.dataset.controlledDrag
  sheet.style.removeProperty('translate')
  if (host.value?.hasPointerCapture?.(id)) host.value.releasePointerCapture(id)
  if (event.type === 'pointerup' && distance >= 80) emit('close')
}
function receiveTarget(element) {
  if (!element) return
  target.value = element
  emit('ready')
}
onMounted(() => {
  window.addEventListener('pointermove', moveDrag, { capture: true, passive: false })
  window.addEventListener('pointerup', finishDrag, true)
  window.addEventListener('pointercancel', finishDrag, true)
  root = createRoot(host.value)
  root.render(createElement(GlassSheet, {
    open: true, container: host.value, intensity: 2, tint: 'rgba(255,255,255,.96)',
    'aria-label': props.title, onClose: () => emit('close'),
  }, createElement('div', { ref: receiveTarget, className: 'glass-sheet-vue-content' })))
})
// Vue gỡ nội dung Teleport trước khi React gỡ phần khung.
onUnmounted(() => {
  window.removeEventListener('pointermove', moveDrag, true)
  window.removeEventListener('pointerup', finishDrag, true)
  window.removeEventListener('pointercancel', finishDrag, true)
  gesture = undefined
  root?.unmount(); root = undefined
})
</script>
<template>
  <div ref="host" @pointerdown.capture="startDrag" class="glass-sheet-surface" data-theme="light" />
  <Teleport v-if="target" :to="target"><slot /></Teleport>
</template>
<style>
.glass-sheet-surface { position:absolute; inset:0; --lg-font:var(--font); --lg-ink:var(--ink); }
.glass-sheet-surface .lg-sheet-layer { z-index:1; }
.glass-sheet-surface .lg-sheet.lg-glass { width:calc(100% - 16px); max-width:720px; max-height:calc(100% - 16px); display:flex; flex-direction:column; overflow:hidden; margin-bottom:max(8px,env(safe-area-inset-bottom)); border-radius:30px; color:var(--ink); background:#fff; }
.glass-sheet-surface .lg-sheet__content { padding:0; display:flex; flex-direction:column; flex:1 1 auto; min-height:0; overflow:hidden; }
.glass-sheet-surface .lg-sheet__grabber-zone { flex:none; }
.glass-sheet-surface .lg-sheet__scrim { background:rgb(0 0 0 / 25%); }
.glass-sheet-surface .lg-sheet:not([data-controlled-drag]) { transition:translate 160ms ease-out; }
.glass-sheet-surface .lg-sheet__grabber-zone { touch-action:none; cursor:grab; }
@media(prefers-reduced-motion:reduce) { .glass-sheet-surface .lg-sheet { transition:none; } }
.glass-sheet-vue-content { display:flex; flex-direction:column; flex:1 1 auto; min-width:0; min-height:0; overflow:hidden; }
@media(prefers-reduced-transparency:reduce) { .glass-sheet-surface .lg-sheet { background:#fff!important; backdrop-filter:none!important; } }
</style>

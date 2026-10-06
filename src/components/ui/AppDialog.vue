<script setup>
import { ref, watch, nextTick, onUnmounted, useId } from 'vue'
import { lockDialogScroll } from '../../lib/dialog'
const props = defineProps({ open: Boolean, title: { type: String, default: '' } })
const emit = defineEmits(['close'])
const dialog = ref(null), titleId = 'dialog-' + useId()
let release, previousFocus, generation = 0
function requestClose(event) { event?.preventDefault(); emit('close') }
watch(() => props.open, async value => {
  const current = ++generation
  await nextTick()
  if (current !== generation || !dialog.value) return
  if (value && !dialog.value.open) {
    previousFocus = document.activeElement
    release = lockDialogScroll()
    dialog.value.showModal()
    dialog.value.querySelector('[autofocus], h2')?.focus()
  } else if (!value && dialog.value.open) {
    dialog.value.close(); release?.(); release = null
    if (previousFocus?.isConnected) previousFocus.focus?.({ preventScroll: true })
  }
}, { immediate: true, flush: 'post' })
onUnmounted(() => { generation++; dialog.value?.close(); release?.(); if (previousFocus?.isConnected) previousFocus.focus?.({ preventScroll: true }) })
defineExpose({ focus: () => dialog.value?.querySelector('h2')?.focus() })
</script>
<template>
  <Teleport to="body">
    <dialog ref="dialog" class="app-dialog" :aria-labelledby="titleId" @cancel="requestClose" @click="event => { if (event.target === dialog) requestClose(event) }">
      <section class="app-dialog__content">
        <header class="app-dialog__header"><h2 :id="titleId" tabindex="-1">{{ title }}</h2><button type="button" class="app-dialog__close" aria-label="Đóng hộp thoại" @click="requestClose">×</button></header>
        <div class="app-dialog__body"><slot /></div>
        <footer v-if="$slots.footer" class="app-dialog__footer"><slot name="footer" /></footer>
      </section>
    </dialog>
  </Teleport>
</template>
<style scoped>
.app-dialog{border:1px solid var(--line);border-radius:18px;padding:0;width:min(720px,calc(100% - 32px));max-height:calc(100dvh - 32px);margin:auto;background:var(--card);color:var(--ink);overflow:auto;box-shadow:var(--shadow-lift)}
.app-dialog::backdrop{background:rgb(20 28 22 / 42%)}
.app-dialog__content{padding:24px}.app-dialog__header{display:flex;gap:16px;align-items:center;margin-bottom:20px}.app-dialog__header h2{font-size:1.35rem;line-height:1.4;flex:1;overflow-wrap:anywhere}.app-dialog__close{width:44px;height:44px;border:1px solid var(--line);border-radius:10px;background:none;font-size:24px;cursor:pointer;flex:none}.app-dialog__footer{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;padding-top:18px;border-top:1px solid var(--line);margin-top:20px}
@media(max-width:600px){.app-dialog{width:calc(100% - 20px);max-height:calc(100dvh - 20px)}.app-dialog__content{padding:20px 16px}.app-dialog__footer{position:relative}}
</style>

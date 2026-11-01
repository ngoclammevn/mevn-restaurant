<script setup>
import { ref, watch, nextTick, onUnmounted, useId } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import GlassSheetSurface from './liquid/GlassSheetSurface.vue'
import { lockDialogScroll } from '../../lib/dialog'
const props = defineProps({ open: Boolean, title: { type: String, default: '' } })
const emit = defineEmits(['close'])
const mobile = useMediaQuery('(max-width: 700px)')
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
    <dialog ref="dialog" class="app-dialog" :class="{ 'app-dialog--sheet': mobile }" :aria-labelledby="mobile ? undefined : titleId" :role="mobile ? 'presentation' : 'dialog'" @cancel="requestClose" @click="event => { if (event.target === dialog) requestClose(event) }">
      <component :is="mobile ? GlassSheetSurface : 'div'" v-if="open" :title="mobile ? title : undefined" @close="requestClose" @ready="nextTick(() => dialog?.querySelector('h2')?.focus())"><section class="app-dialog__content">
        <header class="app-dialog__header"><h2 :id="titleId" tabindex="-1">{{ title }}</h2><button type="button" class="app-dialog__close" aria-label="Đóng hộp thoại" @click="requestClose">×</button></header>
        <div class="app-dialog__body"><slot /></div>
        <footer v-if="$slots.footer" class="app-dialog__footer"><slot name="footer" /></footer>
      </section></component>
    </dialog>
  </Teleport>
</template>
<style scoped>
.app-dialog{border:1px solid var(--line);border-radius:28px;padding:0;width:min(720px,calc(100% - 32px));max-height:calc(100dvh - 32px);margin:auto;background:var(--card);color:var(--ink);overflow:auto;box-shadow:var(--shadow-lift)}
.app-dialog::backdrop{background:rgb(15 23 20 / 36%)}
.app-dialog__content{padding:24px}.app-dialog__header{display:flex;gap:16px;align-items:center;margin-bottom:20px}.app-dialog__header h2{font-size:1.35rem;line-height:1.4;flex:1;overflow-wrap:anywhere}.app-dialog__close{width:44px;height:44px;border:1px solid var(--line);border-radius:50%;background:var(--bg-tint);font-size:24px;cursor:pointer;flex:none}.app-dialog__footer{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;padding-top:18px;border-top:1px solid var(--line);margin-top:20px}
@media(max-width:600px){.app-dialog{width:calc(100% - 20px);max-height:calc(100dvh - 20px)}.app-dialog__content{padding:20px 16px}.app-dialog__footer{position:relative}}
.app-dialog__body{font-size:16px;line-height:1.6}.app-dialog__header h2{font-size:24px;letter-spacing:-.025em;margin:0}.app-dialog__close{color:var(--ink);touch-action:manipulation}.app-dialog__close:active{background:var(--line)}@media(prefers-contrast:more){.app-dialog{border-color:var(--ink)}}@media(max-width:600px){.app-dialog__content{padding:24px 20px}}
.app-dialog--sheet{position:fixed;inset:0;width:100%;height:100dvh;max-width:none;max-height:none;margin:0;border:0;border-radius:0;background:transparent;overflow:visible;box-shadow:none}.app-dialog--sheet::backdrop{background:transparent}.app-dialog--sheet .app-dialog__content{padding-bottom:calc(20px + env(safe-area-inset-bottom))}
@media(min-width:701px){.app-dialog{background:rgb(255 255 255 / 94%);backdrop-filter:blur(28px);-webkit-backdrop-filter:blur(28px)}.app-dialog::backdrop{backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}}
</style>

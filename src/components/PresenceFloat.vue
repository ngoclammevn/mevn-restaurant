<script setup>
import { ref, nextTick, onMounted, onUnmounted, useId } from 'vue'
import AppDialog from './ui/AppDialog.vue'
import AppIcon from './ui/AppIcon.vue'
defineProps({ viewers: { type: Array, default: () => [] }, connected: Boolean })
const open = ref(false), mobile = ref(false), trigger = ref(null), panel = ref(null), panelId = 'online-' + useId()
let media
function close() { open.value = false; nextTick(() => trigger.value?.focus()) }
async function toggle() { if (open.value) return close(); open.value = true; await nextTick(); if (!mobile.value) panel.value?.focus() }
function pointer(event) { if (open.value && !mobile.value && !panel.value?.contains(event.target) && !trigger.value?.contains(event.target)) close() }
function key(event) { if (open.value && event.key === 'Escape') close() }
function mediaChanged(event) { mobile.value = event.matches; open.value = false }
onMounted(() => { media = matchMedia('(max-width:700px)'); mobile.value = media.matches; media.addEventListener('change',mediaChanged); document.addEventListener('pointerdown',pointer); document.addEventListener('keydown',key) })
onUnmounted(() => { media?.removeEventListener('change',mediaChanged); document.removeEventListener('pointerdown',pointer); document.removeEventListener('keydown',key) })
</script>
<template><aside class="presence-float">
  <button ref="trigger" type="button" class="presence-trigger" :aria-expanded="open" :aria-controls="panelId" @click="toggle"><AppIcon name="online" /><span>{{ viewers.length }} đang online</span><span aria-hidden="true">{{ open ? '⌄' : '⌃' }}</span></button>
  <section v-if="open && !mobile" :id="panelId" ref="panel" class="presence-panel card stack-sm" tabindex="-1" aria-label="Người đang online">
    <div class="row-wrap"><h2 class="section-title">Đang online</h2><button class="presence-close" aria-label="Đóng danh sách online" @click="close">×</button></div>
    <p v-if="!connected" class="meta" role="status">Kết nối realtime đang gián đoạn.</p>
    <p v-if="!viewers.length" class="meta">Chưa có người khác trong danh sách.</p>
    <article v-for="viewer in viewers" :key="viewer.id" class="presence-person"><strong>{{ viewer.name }}</strong><p class="meta">{{ viewer.label }}{{ viewer.restaurantName ? ' · ' + viewer.restaurantName : '' }}</p><p v-if="viewer.picks.length" class="presence-picks">Đang chọn: {{ viewer.picks.join(' · ') }}</p></article>
  </section>
  <AppDialog :open="open && mobile" title="Đang online" @close="close"><div :id="panelId" class="stack-sm"><p v-if="!connected" class="meta" role="status">Kết nối realtime đang gián đoạn.</p><p v-if="!viewers.length" class="meta">Chưa có người khác trong danh sách.</p><article v-for="viewer in viewers" :key="viewer.id" class="presence-person"><strong>{{ viewer.name }}</strong><p class="meta">{{ viewer.label }}{{ viewer.restaurantName ? ' · ' + viewer.restaurantName : '' }}</p><p v-if="viewer.picks.length" class="presence-picks">Đang chọn: {{ viewer.picks.join(' · ') }}</p></article></div></AppDialog>
</aside></template>
<style scoped>
.presence-float{position:fixed;z-index:45;right:max(16px,env(safe-area-inset-right));bottom:18px}.presence-trigger{display:flex;align-items:center;gap:10px;min-height:48px;padding:10px 16px;border:1px solid var(--line-strong);border-radius:999px;background:var(--card);box-shadow:var(--shadow);font-size:var(--fs-sm);font-weight:600;cursor:pointer}.presence-panel{position:absolute;right:0;bottom:60px;width:min(340px,calc(100vw - 32px));max-height:min(500px,65dvh);overflow:auto;box-shadow:var(--shadow-lift)}.presence-person{padding:12px 0;border-top:1px solid var(--line);overflow-wrap:anywhere}.presence-person p{margin-top:4px}.presence-picks{font-size:var(--fs-sm)}.presence-close{margin-left:auto;min-width:44px;min-height:44px;border:0;background:none;font-size:22px;cursor:pointer}@media(max-width:700px){.presence-float{bottom:calc(var(--mobile-nav-height) + env(safe-area-inset-bottom) + 12px)}.presence-trigger{min-height:44px;padding:8px 13px}}
</style>

<script setup>
import { ref, computed } from 'vue'
import AppDialog from './AppDialog.vue'
import changelog from '../../changelog.json'
import { formatVNDate } from '../../lib/date'
const emit = defineEmits(['close'])
const tab = ref('latest')
const entries = computed(() => tab.value === 'latest' ? changelog.slice(0, 1) : changelog)
</script>
<template><AppDialog open title="Cập nhật" @close="emit('close')"><div class="stack"><div class="changelog-tabs" role="group" aria-label="Xem cập nhật"><button type="button" :aria-pressed="tab === 'latest'" :class="{ active: tab === 'latest' }" @click="tab = 'latest'">Mới nhất</button><button type="button" :aria-pressed="tab === 'history'" :class="{ active: tab === 'history' }" @click="tab = 'history'">Lịch sử</button></div><article v-for="entry in entries" :key="entry.date" class="changelog-entry"><h3 class="section-title"><time :datetime="entry.date">{{ formatVNDate(entry.date) }}</time></h3><ul><li v-for="(change,index) in entry.changes" :key="index">{{ change }}</li></ul></article><p v-if="!entries.length" class="meta">Chưa có cập nhật.</p></div></AppDialog></template>
<style scoped>.changelog-tabs { display:flex; gap:1rem; border-bottom:1px solid var(--line); }.changelog-tabs button { min-height:44px; background:none; border:0; border-bottom:2px solid transparent; cursor:pointer; padding:.5rem 0; }.changelog-tabs button.active { border-bottom-color:var(--ink); font-weight:600; }.changelog-entry { padding-bottom:1rem; border-bottom:1px solid var(--line); }.changelog-entry ul { padding-left:1.25rem; margin:.7rem 0 0; }.changelog-entry li + li { margin-top:.6rem; }</style>

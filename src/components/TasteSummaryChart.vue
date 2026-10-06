<script setup>
import { ref, computed } from 'vue'
import { AppButton } from './ui'
const props = defineProps({ title: String, items: { type: Array, default: () => [] }, emptyText: { type: String, default: 'Chưa có dữ liệu.' } })
const expanded = ref(false)
const visible = computed(() => expanded.value ? props.items : props.items.slice(0, 5))
const max = computed(() => Math.max(1, ...props.items.map(item => item.value)))
</script>
<template>
  <section class="card stack taste-chart">
    <h2 class="section-title">{{ title }}</h2><slot />
    <p v-if="!items.length" class="meta">{{ emptyText }}</p>
    <ol v-else class="taste-bars">
      <li v-for="item in visible" :key="item.key" class="stack-sm">
        <div class="row-wrap"><router-link v-if="item.to" :to="item.to" class="taste-label">{{ item.label }}</router-link><span v-else class="taste-label">{{ item.label }}</span><span class="meta taste-value">{{ item.detail || item.value }}</span></div>
        <p v-if="item.context" class="meta taste-context">{{ item.context }}</p><div class="taste-track" aria-hidden="true"><div :style="{ width: `${100 * item.value / max}%` }" /></div>

      </li>
    </ol>
    <AppButton v-if="items.length > 5" variant="ghost" @click="expanded = !expanded">{{ expanded ? 'Thu gọn' : `Xem tất cả (${items.length})` }}</AppButton>
    <slot name="footer" />
  </section>
</template>
<style scoped>
.taste-chart { gap:0; }.taste-chart h2 { font-size:21px; margin:0 0 8px; }.taste-bars { list-style:none; padding:0; margin:18px 0 0; display:grid; gap:0; }.taste-bars li { gap:0; }.taste-bars .row-wrap { gap:12px; justify-content:space-between; }.taste-label { min-width:0; overflow-wrap:anywhere; color:var(--ink); font-weight:600; text-decoration:none; font-size:15px; }.taste-label:hover { text-decoration:underline; }.taste-value { font-size:12px; }.taste-context { margin:4px 0 0; font-size:12px; }.taste-track { height:9px; background:#edf1e8; border-radius:10px; overflow:hidden; margin:10px 0 24px; }.taste-track > div { height:100%; background:var(--primary); border-radius:10px; }.taste-chart > .btn { align-self:flex-start; margin-bottom:16px; }
</style>

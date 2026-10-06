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
    <h2 class="section-title">{{ title }}</h2>
    <p v-if="!items.length" class="meta">{{ emptyText }}</p>
    <ol v-else class="taste-bars">
      <li v-for="item in visible" :key="item.key" class="stack-sm">
        <div class="row-wrap"><router-link v-if="item.to" :to="item.to" class="taste-label">{{ item.label }}</router-link><span v-else class="taste-label">{{ item.label }}</span><strong>{{ item.value }}</strong></div>
        <div class="taste-track" aria-hidden="true"><div :style="{ width: `${100 * item.value / max}%` }" /></div>
        <p v-if="item.detail" class="meta">{{ item.detail }}</p>
      </li>
    </ol>
    <AppButton v-if="items.length > 5" variant="ghost" @click="expanded = !expanded">{{ expanded ? 'Thu gọn' : `Xem tất cả (${items.length})` }}</AppButton>
  </section>
</template>
<style scoped>
.taste-bars { list-style:none; padding:0; margin:0; display:grid; gap:1.25rem; }
.taste-label { flex:1; min-width:0; overflow-wrap:anywhere; color:var(--ink); }
.taste-track { height:6px; background:var(--bg-tint); border-radius:4px; overflow:hidden; }
.taste-track > div { height:100%; background:var(--ink-soft); border-radius:4px; }
</style>

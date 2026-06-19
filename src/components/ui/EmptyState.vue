<script setup>
defineProps({
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  icon: { type: String, default: '🍚' },
})
</script>

<template>
  <div class="empty stack-sm empty-box">
    <slot name="icon"><div class="empty-icon">{{ icon }}</div></slot>
    <p class="empty-title">{{ title }}</p>
    <p v-if="description" class="meta">{{ description }}</p>
    <slot />
  </div>
</template>

<style scoped>
.empty-box { align-items: center; }
.empty-icon { font-size: 2.1rem; }
.empty-title { font-weight: 700; color: var(--ink); }
</style>

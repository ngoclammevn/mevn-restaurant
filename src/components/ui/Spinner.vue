<script setup>
defineProps({ label: { type: String, default: 'Đang tải…' } })
</script>

<template>
  <div class="row loading-row">
    <span class="spinner" aria-hidden="true" />
    <span class="meta">{{ label }}</span>
  </div>
</template>

<style scoped>
.loading-row { padding: 1.4rem 0; justify-content: center; }
</style>

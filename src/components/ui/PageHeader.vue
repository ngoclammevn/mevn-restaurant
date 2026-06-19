<script setup>
defineProps({
  eyebrow: { type: String, default: '' },
  title: { type: String, default: '' },
  sub: { type: String, default: '' },
})
</script>

<template>
  <header class="page-header stack-sm">
    <span v-if="eyebrow" class="eyebrow">{{ eyebrow }}</span>
    <h1 class="page-title">{{ title }}</h1>
    <p v-if="sub" class="page-sub">{{ sub }}</p>
    <slot />
  </header>
</template>

<style scoped>
.page-header { margin-bottom: 1.5rem; }
</style>

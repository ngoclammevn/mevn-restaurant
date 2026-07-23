<script setup>
defineProps({
  menu: { type: Object, required: true },
  viewerCount: { type: Number, default: 0 },
})

const emit = defineEmits(['copy-link'])
</script>

<template>
  <header class="menu-hero">
    <div>
      <p class="menu-hero__eyebrow">THỰC ĐƠN HÔM NAY</p>
      <h1>{{ menu.title }}</h1>
      <p v-if="menu.note" class="menu-hero__note">{{ menu.note }}</p>
    </div>

    <div class="menu-hero__actions">
      <span v-if="viewerCount" class="menu-hero__viewers">{{ viewerCount }} người đang xem</span>
      <button type="button" class="menu-hero__copy" @click="emit('copy-link')">Sao chép link</button>
    </div>
  </header>
</template>

<style scoped>
.menu-hero { display: flex; align-items: end; justify-content: space-between; gap: 1rem; padding: clamp(1.25rem, 3vw, 2rem); border: 1px solid var(--line); border-radius: var(--radius-lg); background: var(--card); box-shadow: var(--shadow-sm); }
.menu-hero__eyebrow { margin: 0 0 .35rem; color: var(--primary); font-size: var(--fs-xs); font-weight: 800; letter-spacing: .11em; }
.menu-hero h1 { margin: 0; color: var(--ink); font-size: clamp(1.55rem, 4vw, 2.4rem); }
.menu-hero__note { margin: .55rem 0 0; color: var(--ink-soft); white-space: pre-line; }
.menu-hero__actions { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; justify-content: flex-end; }
.menu-hero__viewers { color: var(--ink-soft); font-size: var(--fs-sm); }
.menu-hero__copy { padding: .65rem .9rem; border: 0; border-radius: var(--radius-sm); background: var(--primary); color: white; cursor: pointer; font-weight: 750; }

@media (max-width: 640px) {
  .menu-hero { align-items: flex-start; flex-direction: column; }
  .menu-hero__actions { justify-content: flex-start; }
}
</style>

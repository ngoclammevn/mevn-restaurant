<script setup>
import changelog from '../changelog.json'
</script>

<template>
  <div>
    <p class="eyebrow">Lịch sử cập nhật</p>
    <h1 class="page-title">Changelog</h1>

    <div class="stack" style="margin-top: 1.5rem">
      <div v-for="entry in changelog" :key="entry.date" class="card">
        <p class="entry-date">{{ entry.date }}</p>
        <ul class="entry-list">
          <li v-for="(change, i) in entry.changes" :key="i">{{ change }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.entry-date {
  font-family: 'Courier New', monospace;
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--primary);
  margin-bottom: 0.6rem;
}
.entry-list {
  margin: 0;
  padding-left: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.entry-list li {
  color: var(--ink-soft);
  font-size: var(--fs-sm);
  line-height: 1.5;
}
</style>

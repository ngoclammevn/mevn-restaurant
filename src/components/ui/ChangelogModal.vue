<script setup>
import { onMounted, onUnmounted } from 'vue'
import changelog from '../../changelog.json'

defineEmits(['close'])

function handleKeyDown(e) {
  if (e.key === 'Escape') {
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  document.body.style.overflow = 'hidden' // Lock scroll behind modal
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  document.body.style.overflow = '' // Restore scroll
})
</script>

<template>
  <div class="changelog-overlay" @click.self="$emit('close')">
    <div class="changelog-modal">
      <header class="changelog-header">
        <div>
          <p class="changelog-eyebrow">Lịch sử cập nhật</p>
          <h2 class="changelog-title">Changelog</h2>
        </div>
        <button class="changelog-close-btn" @click="$emit('close')" aria-label="Đóng">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </header>

      <div class="changelog-body">
        <div class="changelog-stack">
          <div v-for="entry in changelog" :key="entry.date" class="changelog-card">
            <div class="changelog-date-badge">{{ entry.date }}</div>
            <ul class="changelog-list">
              <li v-for="(change, i) in entry.changes" :key="i" class="changelog-item">
                <span class="changelog-bullet">•</span>
                <span class="changelog-text">{{ change }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.changelog-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  animation: fade-in 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.changelog-modal {
  background: var(--bg-paper, #ffffff);
  border: 1px solid var(--border-soft, rgba(148, 163, 184, 0.12));
  border-radius: 20px;
  width: 100%;
  max-width: 520px;
  max-height: 82vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 
    0 20px 25px -5px rgba(0, 0, 0, 0.1),
    0 8px 10px -6px rgba(0, 0, 0, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
  animation: slide-up 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.changelog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border-soft, rgba(148, 163, 184, 0.08));
  background: var(--bg-paper-light, rgba(255, 255, 255, 0.5));
}

.changelog-eyebrow {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
  color: var(--primary-ink, #b45309);
  margin: 0 0 0.15rem 0;
}

.changelog-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--ink, #0f172a);
  margin: 0;
}

.changelog-close-btn {
  background: transparent;
  border: none;
  color: var(--ink-soft, #64748b);
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.changelog-close-btn:hover {
  background: var(--border-soft, rgba(148, 163, 184, 0.1));
  color: var(--ink, #0f172a);
  transform: rotate(90deg);
}

.changelog-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.changelog-stack {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.changelog-card {
  background: var(--bg-paper-subtle, rgba(248, 250, 252, 0.65));
  border: 1px solid var(--border-soft, rgba(148, 163, 184, 0.08));
  border-radius: 14px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.changelog-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.03);
}

.changelog-date-badge {
  align-self: flex-start;
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--primary, #d97706);
  background: var(--primary-soft, rgba(217, 119, 6, 0.08));
  padding: 0.25rem 0.6rem;
  border-radius: 6px;
  letter-spacing: 0.02em;
}

.changelog-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.changelog-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  line-height: 1.5;
}

.changelog-bullet {
  color: var(--primary, #d97706);
  font-weight: bold;
  flex-shrink: 0;
}

.changelog-text {
  font-size: 0.875rem;
  color: var(--ink-soft, #475569);
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(24px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>

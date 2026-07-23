<script setup>
import { nextTick, onUnmounted, ref, watch } from 'vue'

const props = defineProps({
  open: Boolean,
  note: { type: String, default: '' },
  orderFor: { type: String, default: '' },
  profiles: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:note', 'update:orderFor', 'close'])
const dialogRef = ref(null)
let previouslyFocusedElement = null

function restorePreviousFocus() {
  if (previouslyFocusedElement?.isConnected && typeof previouslyFocusedElement.focus === 'function') {
    previouslyFocusedElement.focus()
  }
  previouslyFocusedElement = null
}

watch(() => props.open, (open, wasOpen) => {
  if (open && !wasOpen) {
    previouslyFocusedElement = document.activeElement
    nextTick(() => dialogRef.value?.querySelector('#order-note')?.focus())
  } else if (!open && wasOpen) {
    restorePreviousFocus()
  }
}, { immediate: true })

onUnmounted(restorePreviousFocus)

function handleKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
    return
  }
  if (event.key !== 'Tab') return

  const focusable = Array.from(dialogRef.value?.querySelectorAll(
    'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
  ) ?? [])
  const first = focusable[0]
  const last = focusable.at(-1)
  if (!first || !last) return
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}
</script>

<template>
  <div v-if="open" class="order-options-sheet__overlay" @click.self="emit('close')">
    <section ref="dialogRef" class="order-options-sheet" role="dialog" aria-modal="true" aria-labelledby="order-options-heading" @keydown="handleKeydown">
      <h2 id="order-options-heading">Tuỳ chọn đơn</h2>
      <div class="field">
        <label for="order-note">Ghi chú</label>
        <textarea id="order-note" class="textarea" :value="note" placeholder="Ví dụ: ít cơm" @input="emit('update:note', $event.target.value)" />
      </div>
      <div class="field">
        <label for="order-for">Đặt cho</label>
        <select id="order-for" class="input" :value="orderFor" @change="emit('update:orderFor', $event.target.value)">
          <option value="">Tôi</option>
          <option v-for="profile in profiles" :key="profile.id" :value="profile.id">{{ profile.display_name || profile.full_name || profile.name || profile.id }}</option>
        </select>
      </div>
      <button data-testid="order-options-close" class="order-options-sheet__close" type="button" @click="emit('close')">Xong</button>
    </section>
  </div>
</template>

<style scoped>
.order-options-sheet__overlay { position: fixed; z-index: 80; inset: 0; display: flex; align-items: end; background: rgba(35, 39, 31, .35); }
.order-options-sheet { width: 100%; display: grid; gap: 1rem; padding: 1.25rem max(1rem, env(safe-area-inset-right)) calc(1.25rem + env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left)); border-radius: var(--radius) var(--radius) 0 0; background: var(--card); box-shadow: var(--shadow-lift); }
.order-options-sheet h2 { font-size: var(--fs-lg); }
.order-options-sheet__close { min-height: 44px; border: 0; border-radius: var(--radius-pill); background: var(--primary); color: #fff; font-weight: 700; cursor: pointer; }
@media (min-width: 1080px) {
  .order-options-sheet__overlay { align-items: center; justify-content: center; padding: 1.5rem; }
  .order-options-sheet { width: min(420px, 100%); border-radius: var(--radius); padding: 1.5rem; }
}
</style>

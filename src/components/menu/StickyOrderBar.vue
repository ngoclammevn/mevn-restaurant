<script setup>
import { computed } from 'vue'

const props = defineProps({
  count: { type: Number, default: 0 },
  total: { type: Number, default: null },
  disabled: Boolean,
  submitting: Boolean,
})

const emit = defineEmits(['submit', 'open-options'])
const summary = computed(() => {
  if (!props.count) return '0 món'
  const total = props.total === null ? '' : ` · ${new Intl.NumberFormat('vi-VN').format(props.total)}đ`
  return `${props.count} món${total}`
})
</script>

<template>
  <aside class="sticky-order-bar" aria-label="Tóm tắt đơn hàng">
    <div class="sticky-order-bar__summary">
      <strong>{{ summary }}</strong>
      <span v-if="!count">Chọn món để đặt</span>
    </div>
    <button class="sticky-order-bar__options" type="button" aria-label="Tuỳ chọn đơn" @click="emit('open-options')">⋯</button>
    <button
      data-testid="sticky-order-submit"
      class="sticky-order-bar__submit"
      type="button"
      :disabled="!count || disabled || submitting"
      :aria-busy="submitting ? 'true' : undefined"
      @click="emit('submit')"
    >{{ submitting ? 'Đang đặt…' : count ? 'Đặt món' : 'Chọn món để đặt' }}</button>
  </aside>
</template>

<style scoped>
.sticky-order-bar {
  position: fixed;
  right: 0;
  bottom: env(safe-area-inset-bottom);
  left: 0;
  z-index: 40;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: .6rem;
  padding: .75rem max(1rem, env(safe-area-inset-right)) calc(.75rem + env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
  border-top: 1px solid var(--line);
  background: color-mix(in srgb, var(--card) 96%, transparent);
  box-shadow: 0 -4px 18px rgba(35, 39, 31, .08);
  backdrop-filter: blur(12px);
}
.sticky-order-bar__summary { display: flex; min-width: 0; flex-direction: column; font-size: var(--fs-sm); }
.sticky-order-bar__summary span { color: var(--muted); }
.sticky-order-bar__options, .sticky-order-bar__submit { min-height: 44px; border: 0; border-radius: var(--radius-pill); font-weight: 700; cursor: pointer; }
.sticky-order-bar__options { width: 44px; background: var(--bg-tint); color: var(--ink); font-size: 1.25rem; }
.sticky-order-bar__submit { padding: .6rem .9rem; background: var(--primary); color: #fff; }
.sticky-order-bar__submit:disabled { opacity: .55; cursor: not-allowed; }
@media (min-width: 1080px) {
  .sticky-order-bar { position: static; padding: 0; border: 0; background: transparent; box-shadow: none; backdrop-filter: none; }
}
</style>

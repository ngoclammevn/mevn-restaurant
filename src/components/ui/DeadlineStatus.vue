<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { formatVNTime } from '../../lib/date'
import { getDeadlineState } from '../../lib/orderDeadline'

const props = defineProps({
  deadline: { type: [String, null], default: null },
  // Supplying now makes the component deterministic for tests and previews.
  now: { type: Date, default: null },
})

const currentNow = ref(props.now ?? new Date())
let timerId = null

watch(() => props.now, (value) => {
  if (value) currentNow.value = value
}, { immediate: true })

if (!props.now) {
  timerId = window.setInterval(() => {
    currentNow.value = new Date()
  }, 30_000)
}

onUnmounted(() => {
  if (timerId) window.clearInterval(timerId)
})

const state = computed(() => getDeadlineState(props.deadline, currentNow.value))
const timeLabel = computed(() => props.deadline ? formatVNTime(props.deadline) : '')
const label = computed(() => {
  if (state.value.kind === 'open-unlimited') return 'Nhận đơn không giới hạn'
  if (state.value.kind === 'closed') return `Đã chốt đơn lúc ${timeLabel.value}`
  if (state.value.kind === 'closing-soon') return state.value.label
  return `Nhận đơn đến ${timeLabel.value}`
})
</script>

<template>
  <span
    class="deadline-status"
    :class="`deadline-status--${state.kind}`"
    :title="state.kind === 'open' ? state.label : undefined"
    aria-live="polite"
  >
    <span aria-hidden="true">{{ state.kind === 'closed' ? '●' : '◷' }}</span>
    {{ label }}
  </span>
</template>

<style scoped>
.deadline-status {
  display: inline-flex;
  align-items: center;
  gap: .3rem;
  width: fit-content;
  color: var(--ink-soft);
  font-size: var(--fs-xs);
  font-weight: 650;
  line-height: 1.35;
}
.deadline-status--closing-soon { color: var(--warning, #bf6500); }
.deadline-status--closed { color: var(--danger, #b42318); }
</style>

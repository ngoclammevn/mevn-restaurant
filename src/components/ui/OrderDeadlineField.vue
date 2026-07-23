<script setup>
import { computed, ref, watch } from 'vue'
import {
  buildQuickDeadline,
  fromDeadlineInputValue,
  toDeadlineInputValue,
} from '../../lib/orderDeadline'

const props = defineProps({
  modelValue: { type: [String, null], default: null },
  originalValue: { type: [String, null], default: null },
  now: { type: Date, default: () => new Date() },
})

const emit = defineEmits(['update:modelValue'])
const inputValue = ref('')

watch(() => props.modelValue, (value) => {
  inputValue.value = toDeadlineInputValue(value)
}, { immediate: true })

const inputIso = computed(() => fromDeadlineInputValue(inputValue.value))
const isPersistedValue = computed(() => {
  if (!inputIso.value || !props.originalValue) return false
  return new Date(inputIso.value).getTime() === new Date(props.originalValue).getTime()
})
const isPastNewValue = computed(() => Boolean(
  inputValue.value && inputIso.value && !isPersistedValue.value && new Date(inputIso.value) <= props.now,
))
const error = computed(() => {
  if (!inputValue.value) return ''
  if (!inputIso.value) return 'Thời gian không hợp lệ.'
  return isPastNewValue.value ? 'Hạn chót mới phải ở tương lai.' : ''
})
const elevenAmDisabled = computed(() => {
  const deadline = buildQuickDeadline('today-11am', props.now)
  return !deadline || new Date(deadline) <= props.now
})

function updateInput(value) {
  inputValue.value = value
  const deadline = fromDeadlineInputValue(value)
  emit('update:modelValue', deadline)
}

function applyQuickDeadline(kind) {
  const deadline = buildQuickDeadline(kind, props.now)
  if (!deadline) return
  inputValue.value = toDeadlineInputValue(deadline)
  emit('update:modelValue', deadline)
}

function clearDeadline() {
  inputValue.value = ''
  emit('update:modelValue', null)
}
</script>

<template>
  <div class="field deadline-field">
    <div class="deadline-field__heading">
      <label for="order-deadline">Hạn chót đặt món</label>
      <span class="deadline-field__optional">Không bắt buộc</span>
    </div>
    <input
      id="order-deadline"
      data-testid="deadline-input"
      class="input"
      type="datetime-local"
      :value="inputValue"
      :aria-invalid="error ? 'true' : undefined"
      aria-describedby="order-deadline-hint"
      @input="updateInput($event.target.value)"
    />
    <span id="order-deadline-hint" class="hint">Theo giờ Việt Nam (UTC+7). Để trống nếu không giới hạn thời gian đặt món.</span>
    <span v-if="error" data-testid="deadline-error" class="field-error">{{ error }}</span>
    <div class="deadline-field__actions" aria-label="Chọn nhanh hạn chót">
      <button type="button" class="deadline-field__quick" data-testid="deadline-plus-30m" @click="applyQuickDeadline('plus-30m')">+30 phút</button>
      <button type="button" class="deadline-field__quick" data-testid="deadline-plus-1h" @click="applyQuickDeadline('plus-1h')">+1 giờ</button>
      <button type="button" class="deadline-field__quick" :disabled="elevenAmDisabled" @click="applyQuickDeadline('today-11am')">11:00 hôm nay</button>
      <button type="button" class="deadline-field__clear" @click="clearDeadline">Bỏ giới hạn</button>
    </div>
  </div>
</template>

<style scoped>
.deadline-field { gap: .45rem; }
.deadline-field__heading { display: flex; align-items: baseline; justify-content: space-between; gap: .75rem; }
.deadline-field__optional { color: var(--muted); font-size: var(--fs-xs); }
.deadline-field__actions { display: flex; flex-wrap: wrap; gap: .45rem; margin-top: .15rem; }
.deadline-field__quick, .deadline-field__clear { border-radius: 999px; font: inherit; font-size: var(--fs-xs); padding: .35rem .62rem; cursor: pointer; }
.deadline-field__quick { background: var(--bg-tint); border: 1px solid var(--line); color: var(--primary-ink); }
.deadline-field__clear { background: transparent; border: 0; color: var(--ink-soft); text-decoration: underline; }
.deadline-field__quick:hover:not(:disabled) { border-color: var(--primary); background: var(--primary-soft); }
.deadline-field__quick:disabled { cursor: not-allowed; opacity: .48; }
</style>

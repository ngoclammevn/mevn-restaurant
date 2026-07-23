<script setup>
import { computed, ref, watch, onMounted, onUnmounted, useId } from 'vue'
import flatpickr from 'flatpickr'
import { Vietnamese } from 'flatpickr/dist/l10n/vn.js'
import 'flatpickr/dist/flatpickr.min.css'

const props = defineProps({
  id:         { type: String, default: '' },
  modelValue: { type: String, default: '' },
  label:      { type: String, default: '' },
  hint:       { type: String, default: '' },
  error:      { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const inputRef = ref(null)
const generatedId = useId()
const controlId = computed(() => props.id || generatedId)
const describedBy = computed(() => [
  props.hint && `${controlId.value}-hint`,
  props.error && `${controlId.value}-error`,
].filter(Boolean).join(' ') || undefined)
let fp = null

onMounted(() => {
  fp = flatpickr(inputRef.value, {
    dateFormat:    'Y-m-d',
    locale:        Vietnamese,
    allowInput:    true,
    disableMobile: false,
    defaultDate:   props.modelValue || undefined,
    onChange(selectedDates, dateStr) {
      emit('update:modelValue', dateStr)
    },
  })
})

onUnmounted(() => {
  fp?.destroy()
})

watch(() => props.modelValue, (val) => {
  if (fp && val !== fp.input.value) {
    fp.setDate(val, false)
  }
})
</script>

<template>
  <div class="field">
    <label v-if="label" :for="controlId">{{ label }}</label>
    <input
      :id="controlId"
      ref="inputRef"
      type="text"
      class="input"
      :value="modelValue"
      :aria-describedby="describedBy"
      :aria-invalid="error ? 'true' : undefined"
      readonly
      placeholder="Chọn ngày..."
    />
    <span v-if="hint" :id="`${controlId}-hint`" class="hint">{{ hint }}</span>
    <span v-if="error" :id="`${controlId}-error`" class="field-error">{{ error }}</span>
  </div>
</template>

<style>
/* Override flatpickr calendar để match design system */
.flatpickr-calendar {
  font-family: var(--font, system-ui, sans-serif);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius);
  box-shadow: 0 8px 24px rgba(15, 20, 13, 0.12);
  background: var(--card);
}

.flatpickr-day.selected,
.flatpickr-day.selected:hover {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}

.flatpickr-day:hover {
  background: var(--primary-soft);
  border-color: transparent;
  color: var(--primary-ink);
}

.flatpickr-day.today {
  border-color: var(--primary);
}

.flatpickr-months .flatpickr-month,
.flatpickr-weekdays,
span.flatpickr-weekday {
  background: var(--card);
  color: var(--ink);
}

.flatpickr-current-month .flatpickr-monthDropdown-months,
.flatpickr-current-month input.cur-year {
  color: var(--ink);
  font-weight: 700;
}

.flatpickr-prev-month svg,
.flatpickr-next-month svg {
  fill: var(--ink-soft);
}

.flatpickr-prev-month:hover svg,
.flatpickr-next-month:hover svg {
  fill: var(--primary);
}

.flatpickr-day {
  color: var(--ink);
  border-radius: var(--radius-sm);
}

.flatpickr-day.flatpickr-disabled,
.flatpickr-day.flatpickr-disabled:hover {
  color: var(--ink-soft);
  opacity: 0.4;
}
</style>

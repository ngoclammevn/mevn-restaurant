<script setup>
import { computed, useId } from 'vue'

const props = defineProps({
  id: { type: String, default: '' },
  label: { type: String, default: '' },
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  hint: { type: String, default: '' },
  error: { type: String, default: '' },
  rows: { type: [Number, String], default: 3 },
})
defineEmits(['update:modelValue'])

const generatedId = useId()
const controlId = computed(() => props.id || generatedId)
const describedBy = computed(() => [
  props.hint && `${controlId.value}-hint`,
  props.error && `${controlId.value}-error`,
].filter(Boolean).join(' ') || undefined)
</script>

<template>
  <div class="field">
    <label v-if="label" :for="controlId">{{ label }}</label>
    <textarea
      :id="controlId"
      class="textarea"
      :rows="rows"
      :value="modelValue"
      :placeholder="placeholder"
      :aria-describedby="describedBy"
      :aria-invalid="error ? 'true' : undefined"
      @input="$emit('update:modelValue', $event.target.value)"
    />
    <span v-if="hint" :id="`${controlId}-hint`" class="hint">{{ hint }}</span>
    <span v-if="error" :id="`${controlId}-error`" class="field-error">{{ error }}</span>
  </div>
</template>

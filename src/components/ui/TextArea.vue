<script setup>
defineProps({
  label: { type: String, default: '' },
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  hint: { type: String, default: '' },
  rows: { type: [Number, String], default: 3 },
})
defineEmits(['update:modelValue'])
</script>

<template>
  <div class="field">
    <label v-if="label">{{ label }}</label>
    <textarea
      class="textarea"
      :rows="rows"
      :value="modelValue"
      :placeholder="placeholder"
      @input="$emit('update:modelValue', $event.target.value)"
    />
    <span v-if="hint" class="hint">{{ hint }}</span>
  </div>
</template>

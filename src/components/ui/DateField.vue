<script setup>
import AppDatePicker from './AppDatePicker.vue'
defineOptions({ inheritAttrs: false })
defineProps({ modelValue: { type: String, default: '' }, label: { type: String, default: 'Ngày' } })
const emit = defineEmits(['update:modelValue', 'change'])
</script>
<template><AppDatePicker v-bind="$attrs" :model-value="modelValue" :label="label || 'Ngày'" @update:model-value="emit('update:modelValue', $event)" @change="emit('change', $event)" /></template>

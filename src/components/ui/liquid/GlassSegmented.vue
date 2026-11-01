<script setup>
import { ref, onMounted, onBeforeUnmount, onUpdated } from 'vue'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { GlassSegmented } from '@zakisheriff/liquid-glass'
import '@zakisheriff/liquid-glass/styles.css'
const props = defineProps({ modelValue: { type: Number, default: 0 }, options: { type: Array, required: true }, label: { type: String, required: true } })
const emit = defineEmits(['update:modelValue'])
const host = ref(null)
let root
function render() {
  root?.render(createElement(GlassSegmented, { options: props.options, value: props.modelValue, intensity: 2, 'aria-label': props.label, onChange: value => emit('update:modelValue', value) }))
}
onMounted(() => { root = createRoot(host.value); render() })
onUpdated(render)
onBeforeUnmount(() => root?.unmount())
</script>
<template><span ref="host" class="glass-segmented-host" data-theme="light" :data-value="modelValue" :data-options="JSON.stringify(options)" :aria-label="label" /></template>
<style>
.glass-segmented-host { display: block; min-width: 0; --lg-accent: #176b44; --lg-font: inherit; }
.glass-segmented-host .lg-segmented { width: 100%; }
.glass-segmented-host .lg-track__item { min-height: 48px; font-size: 16px; font-family: inherit; }
.glass-segmented-host .lg-nav__label { font-size: 16px; }
</style>

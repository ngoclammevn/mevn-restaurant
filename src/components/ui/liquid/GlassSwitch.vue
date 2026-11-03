<script setup>
import { ref, onMounted, onBeforeUnmount, onUpdated, useAttrs, normalizeClass } from 'vue'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { GlassSwitch } from '@zakisheriff/liquid-glass'
import '@zakisheriff/liquid-glass/styles.css'
defineOptions({ inheritAttrs: false })
const props = defineProps({ modelValue: Boolean })
const emit = defineEmits(['update:modelValue', 'change'])
const attrs = useAttrs()
const host = ref(null)
let root
function render() {
  const { class: _class, ...switchAttrs } = attrs
  root?.render(createElement(GlassSwitch, { ...switchAttrs, className: normalizeClass(attrs.class), checked: props.modelValue, tint: '#176b44', intensity: 2,
    onChange: value => { emit('update:modelValue', value); emit('change', value) },
  }))
}
onMounted(() => { root = createRoot(host.value); render() })
onUpdated(render)
onBeforeUnmount(() => root?.unmount())
</script>
<template><span ref="host" class="glass-switch-host" data-theme="light" :data-value="modelValue" /></template>
<style>.glass-switch-host { display: inline-flex; align-items: center; min-height: 48px; min-width: 48px; }</style>

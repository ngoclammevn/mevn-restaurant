<script setup>
import { ref, onMounted, onBeforeUnmount, onUpdated, useAttrs } from 'vue'
import { createElement, useState, useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { GlassInput } from '@zakisheriff/liquid-glass'
import '@zakisheriff/liquid-glass/styles.css'
defineOptions({ inheritAttrs: false })
const props = defineProps({ modelValue: { type: [String, Number], default: '' }, label: String, modelModifiers: { type: Object, default: () => ({}) } })
const emit = defineEmits(['update:modelValue', 'input', 'change', 'blur', 'focus'])
const attrs = useAttrs()
const host = ref(null)
let root
let observer
function localizeClear() { host.value?.querySelector('.lg-input__clear')?.setAttribute('aria-label', 'Xóa nội dung') }
function ControlledInput({ value, ...rest }) {
  const [draft, setDraft] = useState(value)
  const composing = useRef(false)
  useEffect(() => { if (!composing.current) setDraft(value) }, [value])
  function update(event) {
    setDraft(event.target.value)
    if (!composing.current && !event.nativeEvent.isComposing) publish(event)
  }
  function publish(event) {
    emit('update:modelValue', props.modelModifiers.trim ? event.target.value.trim() : event.target.value)
    emit('input', event.nativeEvent)
    emit('change', event.nativeEvent)
  }
  return createElement(GlassInput, { ...rest, value: draft, onChange: update,
    onClear: () => {
      if (rest.readOnly || rest.disabled) return
      setDraft('')
      emit('update:modelValue', '')
      const input = host.value?.querySelector('input')
      if (input) {
        input.value = ''
        const event = new Event('input', { bubbles: true })
        input.dispatchEvent(event)
        emit('input', event)
        emit('change', event)
      }
    },
    onCompositionStart: () => { composing.current = true },
    onCompositionEnd: event => { composing.current = false; setDraft(event.target.value); publish(event) },
  })
}
function render() {
  root?.render(createElement(ControlledInput, { ...attrs,
    readOnly: attrs.readonly != null && attrs.readonly !== false || attrs.readOnly,
    maxLength: attrs.maxlength ?? attrs.maxLength, minLength: attrs.minlength ?? attrs.minLength,
    autoComplete: attrs.autocomplete ?? attrs.autoComplete, inputMode: attrs.inputmode ?? attrs.inputMode,
    className: attrs.class, label: props.label, value: String(props.modelValue ?? ''), intensity: 2, tint: '#176b44',
    onBlur: event => emit('blur', event.nativeEvent), onFocus: event => emit('focus', event.nativeEvent),
  }))
}
onMounted(() => { observer = new MutationObserver(localizeClear); observer.observe(host.value, { childList: true, subtree: true }); root = createRoot(host.value); render() })
onUpdated(render)
onBeforeUnmount(() => { observer?.disconnect(); root?.unmount() })
</script>
<template><span ref="host" class="glass-input-host" data-theme="light" :data-value="modelValue" /></template>
<style>
.glass-input-host { display: block; min-width: 0; width: 100%; --lg-font: inherit; --lg-fg: #202723; }
.glass-input-host .lg-input { width: 100%; }
.glass-input-host .lg-input:has(input[readonly]) .lg-input__clear { display: none; }
.glass-input-host input { min-height: 48px; font: inherit; font-size: 16px; }
.glass-input-host .lg-input__label { font-size:16px; font-weight:600; color:var(--ink-soft); }
.glass-input-host .lg-input__field { border-radius:var(--radius-field); }
/* Ring toàn cục :focus-visible không được vẽ trên thẻ input bên trong; vòng focus nằm ở viền ngoài của ô kính. */
.glass-input-host input:focus-visible { outline: none; box-shadow: none; border-radius: inherit; }
.glass-input-host .lg-input__field:has(input:focus-visible) { outline: 2px solid var(--primary, #176b44); outline-offset: 2px; }
</style>

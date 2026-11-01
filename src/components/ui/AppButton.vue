<script setup>
import { computed, ref, onMounted, onUpdated, onBeforeUnmount, useAttrs, normalizeClass } from 'vue'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { GlassButton } from '@zakisheriff/liquid-glass'
import '@zakisheriff/liquid-glass/styles.css'
defineOptions({ inheritAttrs: false })
const props = defineProps({
  variant: { type: String, default: 'primary' }, block: Boolean,
  size: { type: String, default: '' }, loading: Boolean, disabled: Boolean,
  to: { type: [String, Object], default: null }, type: { type: String, default: 'button' },
})
const emit = defineEmits(['click'])
const attrs = useAttrs()
const host = ref(null)
const content = ref(null)
let root
let observer
const cls = computed(() => normalizeClass(['btn', props.variant === 'ghost' && 'btn--ghost', props.variant === 'danger' && 'btn--danger', props.block && 'btn--block', props.size === 'sm' && 'btn--sm', attrs.class]))
// Vue giữ slot gốc; React nhận cây chữ và icon riêng để hai renderer không cùng sửa DOM.
function copyContent(node, key) {
  if (node.nodeType === 3) return node.textContent
  if (node.nodeType !== 1) return null
  const tag = node.tagName.toLowerCase()
  const attributes = { key }
  for (const attribute of node.attributes) {
    if (attribute.name === 'style' || attribute.name === 'id' || attribute.name.startsWith('on')) continue
    const name = ({ class: 'className', 'stroke-width': 'strokeWidth', 'stroke-linecap': 'strokeLinecap', 'stroke-linejoin': 'strokeLinejoin', viewbox: 'viewBox' })[attribute.name] || attribute.name
    attributes[name] = attribute.value
  }
  return createElement(tag, attributes, ...Array.from(node.childNodes, copyContent))
}
function renderButton() {
  if (props.to || !host.value || !content.value) { root?.unmount(); root = undefined; return }
  if (!root) root = createRoot(host.value)
  const { class: _class, ...buttonAttrs } = attrs
  root.render(createElement(GlassButton, {
    ...buttonAttrs, className: cls.value, type: props.type, disabled: props.disabled || props.loading,
    'aria-busy': props.loading || undefined, variant: props.variant === 'ghost' ? 'glass' : 'filled',
    destructive: props.variant === 'danger', tint: props.variant === 'danger' ? '#c13535' : '#176b44',
    size: 'md', intensity: 2, onClick: event => emit('click', event.nativeEvent),
  }, props.loading && createElement('span', { className: 'spinner', 'aria-hidden': true }), ...Array.from(content.value.childNodes, copyContent)))
}
onMounted(() => {
  observer = new MutationObserver(renderButton)
  if (content.value) observer.observe(content.value, { subtree: true, childList: true, characterData: true, attributes: true })
  renderButton()
})
onUpdated(renderButton)
onBeforeUnmount(() => { observer?.disconnect(); root?.unmount() })
</script>
<template>
  <router-link v-if="to" v-bind="attrs" :to="to" :class="cls" :aria-disabled="disabled || loading || undefined" @click="disabled || loading ? $event.preventDefault() : emit('click', $event)"><slot /></router-link>
  <span v-else class="glass-button-host" :class="[attrs.class, { 'glass-button-host--block': block }]" data-theme="light" :data-loading="loading" :data-disabled="disabled" :data-variant="variant"><span ref="host" class="glass-button-mount" /><span ref="content" hidden aria-hidden="true"><slot /></span></span>
</template>
<style>
.glass-button-host { display: inline-flex; max-width: 100%; vertical-align: middle; --lg-font: inherit; }
.glass-button-host--block, .glass-button-host--block .glass-button-mount, .glass-button-host--block button { width: 100%; }
.glass-button-mount { display: inline-flex; max-width: 100%; }
.glass-button-host .lg-button { min-height: 48px; font-family: inherit; font-size: 16px; font-weight: 600; }
.glass-button-host .lg-button { opacity:1; --lg-glass-shadow:0 3px 10px rgb(23 37 29 / 8%); }
.glass-button-host .lg-button:not(:disabled):hover { border-color:rgb(23 107 68 / 35%); }
.glass-button-host .lg-button:disabled { opacity:.55; box-shadow:none; }
.glass-button-host .lg-button:focus-visible { outline:2px solid var(--primary); outline-offset:3px; }
</style>

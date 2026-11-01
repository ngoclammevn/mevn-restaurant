<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { GlassNav } from '@zakisheriff/liquid-glass'
import '@zakisheriff/liquid-glass/styles.css'

const props = defineProps({
  items: { type: Array, required: true },
  activeIndex: { type: Number, default: 0 },
  label: { type: String, default: 'Điều hướng chính' },
  compact: Boolean,
})
const emit = defineEmits(['navigate'])
const host = ref(null)
let root, observer
let pendingRoute
function selectIndex(index) {
  const item = props.items[index]
  if (!item || index === props.activeIndex || pendingRoute === item.to) return
  pendingRoute = item.to
  emit('navigate', item.to)
  queueMicrotask(() => { pendingRoute = undefined })
}
function navigateFromClick(event) {
  const tab = event.target.closest?.('[data-lg-item]')
  if (!tab || !host.value?.contains(tab)) return
  const index = Number(tab.dataset.lgItem)
  selectIndex(index)
}
function navigateFromKey(event) {
  const tab = event.target.closest?.('[data-lg-item]')
  if (!tab || !host.value?.contains(tab)) return
  const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End']
  if (!keys.includes(event.key)) return
  const current = Number(tab.dataset.lgItem)
  const count = props.items.length
  const index = event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : (current + (event.key === 'ArrowRight' ? 1 : count - 1)) % count
  event.preventDefault()
  event.stopPropagation()
  host.value.querySelector(`[data-lg-item="${index}"]`)?.focus()
  selectIndex(index)
}
const icons = {
  today: ['M8 3v4m8-4v4M4 5h16v16H4zM4 10h16M9 15l2 2 4-4'],
  calendar: ['M8 3v4m8-4v4M4 5h16v16H4zM4 10h16M8 14h2m4 0h2m-8 4h2'],
  manage: ['M4 7h16M4 17h16M8 4v6m8 4v6'],
  person: ['M16 7a4 4 0 1 1-8 0a4 4 0 0 1 8 0', 'M4 21v-2a8 8 0 0 1 16 0v2'],
}
function renderNavigation() {
  root?.render(createElement(GlassNav, {
    items: props.items.map(item => ({
      label: item.label,
      icon: props.compact ? undefined : createElement('svg', {
        viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8,
        strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
      }, ...(icons[item.icon] || icons.today).map((d, key) => createElement('path', { d, key }))),
    })),
    activeIndex: props.activeIndex,
    // Callback của thư viện chỉ đổi trang sau tương tác; cập nhật controlled không tự gọi callback.
    onChange: selectIndex,
    intensity: 2,
    'aria-label': props.label,
  }))
}
onMounted(() => {
  observer = new MutationObserver(() => {
    if (props.activeIndex >= 0) return
    const first = [...host.value.querySelectorAll('button[role=tab]')].find(button => !button.closest('[aria-hidden=true]'))
    if (first && first.tabIndex !== 0) first.tabIndex = 0
  })
  observer.observe(host.value, { childList:true, subtree:true, attributes:true, attributeFilter:['tabindex'] })
  root = createRoot(host.value)
  renderNavigation()
})
watch(() => [props.items, props.activeIndex, props.label, props.compact], renderNavigation, { deep: true })
onBeforeUnmount(() => { observer?.disconnect(); root?.unmount(); root = undefined })
</script>

<template><div ref="host" @click.capture="navigateFromClick" @keydown.capture="navigateFromKey" class="glass-navigation" :class="{ 'glass-navigation--compact': compact, 'glass-navigation--unselected': activeIndex < 0 }" data-theme="light" /></template>

<style>
.glass-navigation { --lg-accent: var(--primary, #176b44); --lg-ink: #202723; --lg-font: inherit; --lg-navigation-fill: rgb(255 255 255 / .86); width: 100%; }
.glass-navigation .lg-nav { --lg-item-w: 60px; width: 100%; font-family: inherit; }
.glass-navigation .lg-track__item { min-height: 56px; min-width: 60px; font-family: inherit; color:var(--ink-soft); touch-action: manipulation; }
.glass-navigation .lg-nav__label { font-size: 14px; font-weight: 600; letter-spacing: -.01em; }
.glass-navigation .lg-nav__icon svg { width: 23px; height: 23px; }
.glass-navigation .lg-track__item[aria-selected=true] { color:var(--primary-ink); font-weight:700; }
.glass-navigation .lg-track__item[aria-selected=true] .lg-nav__label { font-weight:700; }
.glass-navigation .lg-nav { --lg-tab-selection:rgb(23 107 68 / .10); --lg-track-active:var(--primary-ink); }
.glass-navigation--compact .lg-track__item { min-height: 44px; padding-inline:14px; }
.glass-navigation--compact .lg-nav__label { font-size: 16px; }
.glass-navigation--unselected .lg-track__select { visibility: hidden; }
@media (prefers-reduced-transparency: reduce) { .glass-navigation { --lg-navigation-fill: #fff; } }
@media (prefers-contrast: more) { .glass-navigation { --lg-navigation-fill: #fff; } .glass-navigation .lg-nav { outline: 1px solid #465149; } }
</style>

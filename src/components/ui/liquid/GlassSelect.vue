<script setup>
import { computed, ref, nextTick, watch, onMounted, onBeforeUnmount, useId, useAttrs } from 'vue'
import AppButton from '../AppButton.vue'
// GlassMenu chặn cuộn cảm ứng; listbox giữ thao tác cuộn và chọn riêng cho danh sách dài.
defineOptions({ inheritAttrs: false })
const attrs = useAttrs()
const props = defineProps({
  modelValue: { type: [String, Number], default: null },
  options: { type: Array, required: true },
  label: { type: String, required: true },
  placeholder: { type: String, default: 'Chọn…' },
  disabled: Boolean,
})
const emit = defineEmits(['update:modelValue'])
const root = ref(null)
const popup = ref(null)
const open = ref(false)
const active = ref(-1)
const position = ref({})
const id = 'glass-select-' + useId()
const selected = computed(() => props.options.find(option => option.value === props.modelValue))
const display = computed(() => selected.value?.label ?? props.placeholder)
let typeahead = '', typeTimer
function place() {
  if (!open.value || !root.value) return
  const box = root.value.querySelector('button')?.getBoundingClientRect()
  if (!box) return
  const below = window.innerHeight - box.bottom - 12
  const above = box.top - 12
  const up = below < 200 && above > below
  position.value = {
    left: `${Math.max(8, Math.min(box.left, window.innerWidth - Math.min(box.width, window.innerWidth - 16) - 8))}px`,
    width: `${Math.min(box.width, window.innerWidth - 16)}px`,
    maxHeight: `${Math.max(48, Math.min(360, up ? above : below))}px`,
    top: up ? 'auto' : `${box.bottom + 6}px`, bottom: up ? `${window.innerHeight - box.top + 6}px` : 'auto',
  }
}
function focusActive() {
  const option = popup.value?.querySelector(`[data-option="${active.value}"]`)
  option?.focus({ preventScroll: true })
  option?.scrollIntoView({ block: 'nearest' })
}
async function show() {
  if (props.disabled || open.value || !props.options.some(option => !option.disabled)) return
  open.value = true
  active.value = props.options.findIndex(option => option.value === props.modelValue && !option.disabled)
  if (active.value < 0) active.value = props.options.findIndex(option => !option.disabled)
  await nextTick()
  popup.value?.showPopover?.()
  place()
  await nextTick()
  focusActive()
}
function close(restore = false) {
  if (!open.value) return
  popup.value?.hidePopover?.()
  open.value = false
  clearTimeout(typeTimer)
  typeahead = ''
  if (restore) root.value?.querySelector('button')?.focus()
}
function choose(index) {
  const option = props.options[index]
  if (!props.disabled && option && !option.disabled) {
    emit('update:modelValue', option.value)
    close(true)
  }
}
function move(direction) {
  for (let step = 1; step <= props.options.length; step++) {
    const index = (active.value + direction * step + props.options.length) % props.options.length
    if (!props.options[index].disabled) { active.value = index; focusActive(); return }
  }
}
function keydown(event) {
  if (!open.value) {
    if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); show() }
    return
  }
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return }
  if (event.key === 'Tab') { close(true); return }
  if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) {
    event.preventDefault()
    event.stopPropagation()
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') move(event.key === 'ArrowDown' ? 1 : -1)
    else if (event.key === 'Home' || event.key === 'End') {
      const indices = props.options.map((option, index) => option.disabled ? -1 : index).filter(index => index >= 0)
      active.value = event.key === 'Home' ? indices[0] : indices.at(-1)
      focusActive()
    } else choose(active.value)
  } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
    typeahead += event.key.toLocaleLowerCase('vi')
    clearTimeout(typeTimer)
    typeTimer = setTimeout(() => { typeahead = '' }, 600)
    const index = props.options.findIndex(option => !option.disabled && String(option.label).toLocaleLowerCase('vi').startsWith(typeahead))
    if (index >= 0) { active.value = index; focusActive() }
  }
}
function outside(event) { if (open.value && !root.value?.contains(event.target)) close() }
watch(() => props.disabled, value => { if (value) close() })
watch(() => props.options, () => close(), { deep: true })
onMounted(() => { document.addEventListener('pointerdown', outside, true); window.addEventListener('resize', place); window.addEventListener('scroll', place, true) })
onBeforeUnmount(() => { close(); document.removeEventListener('pointerdown', outside, true); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) })
</script>
<template>
  <div ref="root" class="glass-select" data-theme="light" @keydown.capture="keydown">
    <span :id="id + '-label'" class="glass-select__label">{{ label }}</span>
    <AppButton v-bind="attrs" block variant="ghost" :disabled="disabled || !options.some(option => !option.disabled)" aria-haspopup="listbox" :aria-expanded="open" :aria-controls="id" :aria-label="`${label}: ${display}`" @click="open ? close(true) : show()"><span :id="id + '-value'" class="glass-select__value">{{ display }}</span><span aria-hidden="true" class="glass-select__chevron">⌄</span></AppButton>
    <div :id="id" ref="popup" popover="manual" class="glass-select__options" :class="{ 'is-open': open }" :style="position" role="listbox" :aria-labelledby="id + '-label'">
      <button v-for="(option, index) in options" :key="index" type="button" role="option" :data-option="index" :aria-selected="option.value === modelValue" :disabled="option.disabled" :tabindex="index === active ? 0 : -1" @focus="active = index" @click="choose(index)"><span>{{ option.label }}</span><span v-if="option.value === modelValue" aria-hidden="true">✓</span></button>
    </div>
  </div>
</template>
<style>
.glass-select { display:grid; grid-template-columns:minmax(0,1fr); gap:8px; min-width: 0; --lg-font: inherit; }
.glass-select__label { min-width:0; overflow-wrap:anywhere; font-size:16px; font-weight: 600; color: var(--ink-soft, #465149); }
.glass-select .lg-button { width:100%; text-align:left; border-radius:var(--radius-field); }
.glass-select .lg-button__label { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; min-width: 0; }
.glass-select__value { min-width:0; flex:1; overflow:hidden; text-overflow: ellipsis; white-space: nowrap; }
.glass-select__chevron { flex: none; font-size: 22px; line-height: 1; }
.glass-select__options { display: none; position: fixed; inset: auto; margin: 0; box-sizing: border-box; z-index: 10000; padding: 6px; overflow: auto; overscroll-behavior: contain; touch-action: pan-y; border: 1px solid rgb(0 0 0 / .12); border-radius: 18px; background: rgb(255 255 255 / .97); color: var(--ink, #202723); box-shadow: 0 12px 40px rgb(0 0 0 / .16); }
.glass-select__options.is-open { display: block; }
.glass-select__options button { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; min-height: 48px; padding: 12px; border: 0; border-radius: 12px; background: transparent; color: inherit; font: inherit; font-size: 16px; text-align: left; cursor: pointer; }
.glass-select__options button[aria-selected=true] { background: #e7f3eb; color: #135f3b; font-weight: 600; }
.glass-select__options button:focus-visible { outline: 2px solid #176b44; outline-offset: -2px; background: #edf5ef; }
.glass-select__options button:disabled { opacity: .45; cursor: not-allowed; }
@media (prefers-reduced-transparency: reduce) { .glass-select__options { background: #fff; } }
</style>

<style>
.glass-select .glass-button-host,.glass-select .glass-button-mount { min-width:0; }
</style>

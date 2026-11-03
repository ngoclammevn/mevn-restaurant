<script setup>
import { computed, ref, nextTick, watch, onMounted, onBeforeUnmount, useAttrs, useId } from 'vue'
import AppButton from './AppButton.vue'
defineOptions({ inheritAttrs: false })
const props = defineProps({ modelValue: { type: String, default: '' }, label: { type: String, required: true }, disabled: Boolean, required: Boolean, clearable: Boolean, min: String, max: String })
const emit = defineEmits(['update:modelValue', 'change'])
const attrs = useAttrs(), root = ref(null), popup = ref(null), open = ref(false), position = ref({})
const id = 'date-picker-' + useId()
const parts = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(part => [part.type, part.value]))
const today = `${parts.year}-${parts.month}-${parts.day}`
function parse(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null
  const [y, m, d] = value.split('-').map(Number), result = new Date(y, m - 1, d, 12)
  return result.getFullYear() === y && result.getMonth() === m - 1 && result.getDate() === d ? result : null
}
function format(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
const focused = ref(parse(props.modelValue) ? props.modelValue : today)
const month = ref(focused.value.slice(0, 7))
const title = computed(() => `Tháng ${Number(month.value.slice(5))}, ${month.value.slice(0, 4)}`)
const valueLabel = computed(() => parse(props.modelValue) ? props.modelValue.split('-').reverse().join('/') : 'Chọn ngày')
const weeks = computed(() => {
  const first = parse(`${month.value}-01`), start = new Date(first)
  start.setDate(1 - (first.getDay() + 6) % 7)
  const cells = Array.from({ length: 42 }, (_, index) => { const day = new Date(start); day.setDate(start.getDate() + index); return { value: format(day), day: day.getDate(), outside: format(day).slice(0, 7) !== month.value } })
  return Array.from({ length: 6 }, (_, index) => cells.slice(index * 7, index * 7 + 7))
})
function allowed(value) { return !!parse(value) && (!props.min || value >= props.min) && (!props.max || value <= props.max) }
function place() {
  if (!open.value) return
  const box = root.value?.querySelector('button')?.getBoundingClientRect()
  if (!box) return
  const width = Math.min(360, window.innerWidth - 16), below = window.innerHeight - box.bottom - 12, above = box.top - 12, up = below < 440 && above > below
  position.value = { width: `${width}px`, left: `${Math.max(8, Math.min(box.left, window.innerWidth - width - 8))}px`, top: up ? 'auto' : `${box.bottom + 6}px`, bottom: up ? `${window.innerHeight - box.top + 6}px` : 'auto', maxHeight: `${Math.max(100, up ? above : below)}px` }
}
async function focusDay() { await nextTick(); popup.value?.querySelector(`[data-day="${focused.value}"]`)?.focus({ preventScroll: true }) }
async function show() {
  if (props.disabled || open.value) return
  focused.value = parse(props.modelValue) ? props.modelValue : today
  if (props.min && focused.value < props.min) focused.value = props.min
  if (props.max && focused.value > props.max) focused.value = props.max
  month.value = focused.value.slice(0, 7)
  open.value = true
  await nextTick()
  if (!open.value || !popup.value) return
  popup.value.showPopover?.()
  place()
  focusDay()
}
function close(restore = false) { if (!open.value) return; popup.value?.hidePopover?.(); open.value = false; if (restore) root.value?.querySelector('button')?.focus() }
function choose(value) {
  if (props.disabled || value && !allowed(value) || !value && (!props.clearable || props.required)) return
  emit('update:modelValue', value)
  emit('change', { target: { value } })
  close(true)
}
function shiftMonth(offset) {
  const date = parse(`${month.value}-01`), day = parse(focused.value)?.getDate() || 1
  date.setMonth(date.getMonth() + offset)
  month.value = format(date).slice(0, 7)
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0, 12).getDate()
  date.setDate(Math.min(day, last)); focused.value = format(date)
}
function keydown(event) {
  if (!open.value) { if (event.key === 'ArrowDown') { event.preventDefault(); show() }; return }
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return }
  if (!event.target.closest?.('[data-day]')) return
  const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']
  if (!keys.includes(event.key)) return
  event.preventDefault(); event.stopPropagation()
  const date = parse(focused.value), weekday = (date.getDay() + 6) % 7
  if (event.key === 'PageUp' || event.key === 'PageDown') {
    const day = date.getDate(), direction = event.key === 'PageUp' ? -1 : 1
    date.setDate(1); date.setMonth(date.getMonth() + direction * (event.shiftKey ? 12 : 1))
    const last = new Date(date.getFullYear(), date.getMonth() + 1, 0, 12).getDate()
    date.setDate(Math.min(day, last))
  } else date.setDate(date.getDate() + ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -weekday, End: 6 - weekday })[event.key])
  let value = format(date)
  if (props.min && value < props.min) value = props.min
  if (props.max && value > props.max) value = props.max
  focused.value = value; month.value = value.slice(0, 7); focusDay()
}
function outside(event) { if (open.value && !root.value?.contains(event.target)) close() }
watch(() => props.disabled, value => { if (value) close() })
onMounted(() => { document.addEventListener('pointerdown', outside, true); window.addEventListener('resize', place); window.addEventListener('scroll', place, true) })
onBeforeUnmount(() => { close(); document.removeEventListener('pointerdown', outside, true); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) })
</script>
<template>
  <div ref="root" class="app-date-picker" @keydown.capture="keydown">
    <span class="app-date-picker__label">{{ label }}</span>
    <AppButton v-bind="attrs" block variant="ghost" :disabled="disabled" :aria-required="required || undefined" :aria-label="`${label}: ${valueLabel}`" aria-haspopup="dialog" :aria-expanded="open" :aria-controls="id" @click="open ? close(true) : show()"><span>{{ valueLabel }}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true" width="20" height="20"><path d="M8 3v4m8-4v4M4 5h16v16H4zM4 10h16" /></svg></AppButton>
    <section :id="id" ref="popup" popover="manual" class="app-date-picker__calendar" :class="{ 'is-open': open }" :style="position" role="dialog" :aria-label="label">
      <header><AppButton variant="ghost" aria-label="Tháng trước" @click="shiftMonth(-1)">‹</AppButton><h3 aria-live="polite">{{ title }}</h3><AppButton variant="ghost" aria-label="Tháng sau" @click="shiftMonth(1)">›</AppButton></header>
      <div role="grid" :aria-label="title"><div class="app-date-picker__week" role="row"><span v-for="day in ['T2','T3','T4','T5','T6','T7','CN']" :key="day" role="columnheader">{{ day }}</span></div><div v-for="(week, index) in weeks" :key="index" role="row" class="app-date-picker__week"><button v-for="day in week" :key="day.value" type="button" role="gridcell" :data-day="day.value" :aria-label="day.value.split('-').reverse().join('/')" :aria-selected="day.value === modelValue" :aria-current="day.value === today ? 'date' : undefined" :class="{ 'is-outside': day.outside }" :tabindex="day.value === focused ? 0 : -1" :disabled="!allowed(day.value)" @focus="focused = day.value" @click="choose(day.value)">{{ day.day }}</button></div></div>
      <footer><AppButton variant="ghost" :disabled="!allowed(today)" @click="choose(today)">Hôm nay</AppButton><AppButton v-if="clearable && !required" variant="ghost" @click="choose('')">Bỏ chọn</AppButton></footer>
    </section>
  </div>
</template>
<style>
.app-date-picker { display:grid; gap:8px; min-width:0; }
.app-date-picker__label { font-size:16px; font-weight:600; color:var(--ink-soft,#465149); }
.app-date-picker>.glass-button-host,.app-date-picker>.glass-button-host .glass-button-mount { min-width:0; }
.app-date-picker>.glass-button-host .lg-button { border-radius:var(--radius-field,16px); }
.app-date-picker>.glass-button-host .lg-button__label { display:flex; width:100%; align-items:center; justify-content:space-between; gap:12px; }
.app-date-picker__calendar { display:none; position:fixed; inset:auto; margin:0; box-sizing:border-box; z-index:10000; padding:12px; overflow:auto; overscroll-behavior:contain; touch-action:pan-y; border:1px solid rgb(0 0 0 / .12); border-radius:24px; background:#fff; color:var(--ink,#202723); box-shadow:0 12px 40px rgb(0 0 0 / .16); font-family:var(--font,system-ui); }
.app-date-picker__calendar.is-open { display:block; }
.app-date-picker__calendar header { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px; }
.app-date-picker__calendar h3 { font-size:17px; font-weight:700; margin:0; }
.app-date-picker__calendar header .lg-button { width:44px; min-width:44px; padding:0; font-size:26px; }
.app-date-picker__week { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); }
.app-date-picker__week [role=columnheader] { text-align:center; padding:8px 0; font-size:14px; font-weight:600; color:var(--ink-soft,#465149); }
.app-date-picker__week button { min-width:0; min-height:44px; padding:4px; border:0; border-radius:50%; background:transparent; color:inherit; font:inherit; font-size:16px; cursor:pointer; }
.app-date-picker__week button.is-outside { color:var(--ink-soft,#68756c); }
.app-date-picker__week button[aria-current=date] { box-shadow:inset 0 0 0 1px var(--primary,#176b44); }
.app-date-picker__week button[aria-selected=true] { background:var(--primary,#176b44); color:#fff; font-weight:700; }
.app-date-picker__week button:disabled { opacity:.35; cursor:not-allowed; }
.app-date-picker__week button:focus-visible { outline:2px solid var(--primary,#176b44); outline-offset:-2px; }
.app-date-picker__calendar footer { display:flex; justify-content:space-between; gap:8px; padding-top:10px; margin-top:8px; border-top:1px solid var(--line,#e2e8e4); }
@media(max-width:360px) {
  .app-date-picker__calendar { width:calc(100vw - 2px)!important; left:1px!important; padding:4px; }
  .app-date-picker__calendar header,.app-date-picker__calendar footer { padding-inline:8px; }
}
</style>

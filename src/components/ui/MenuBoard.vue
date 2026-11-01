<script setup>
import { ref, computed, nextTick, watch } from 'vue'
import AppIcon from './AppIcon.vue'
import GlassInput from './liquid/GlassInput.vue'
import AppButton from './AppButton.vue'

const props = defineProps({
  mode:           { type: String,  default: 'view' },
  heading: { type: String, default: 'Thực đơn' },
  disabled:       { type: Boolean, default: false },
  note:           { type: String,  default: '' },
  picks:          { type: Object,  default: () => ({}) },
  viewers:        { type: Array,   default: () => [] },  // presence viewers for dish chips
  dishes:         { type: Array,   default: () => [] },
  notes:          { type: String,  default: '' },
  showCalories:   { type: Boolean, default: false },
  showCategories: { type: Boolean, default: true },
  identityLocked: { type: Boolean, default: false },
  lockedDishIds: { type: Array, default: () => [] },
  lockedDishNames: { type: Array, default: () => [] },
  restaurantId: { type: String, default: '' },
  feedback: { type: Object, default: () => ({}) },
  showFeedback: { type: Boolean, default: false },
  feedbackState: { type: String, default: '' },
})

const emit = defineEmits(['update:dishes', 'update:notes', 'toggle-dish', 'hover-dish', 'feedback'])

// Dish → viewers currently hovering or who have picked it
const dishSelectors = computed(() => {
  const map = Object.create(null)
  for (const v of props.viewers) {
    const seen = new Set()
    // activeDish takes priority (hover state)
    if (v.activeDish) {
      if (!map[v.activeDish]) map[v.activeDish] = []
      map[v.activeDish].push(v)
      seen.add(v.activeDish)
    }
    // Also show chip on dishes the viewer has selected (picks)
    for (const dishName of v.picks ?? []) {
      if (!seen.has(dishName)) {
        if (!map[dishName]) map[dishName] = []
        map[dishName].push(v)
        seen.add(dishName)
      }
    }
  }
  return map
})

// ── View mode helpers ──
const parsedView = computed(() => {
  if (props.mode !== 'view' || !props.note) return { notes: '', dishes: [] }
  try { return JSON.parse(props.note) } catch { return { notes: '', dishes: [] } }
})
const search = ref(''), activeCategory = ref('')
const categories = computed(() => [...new Set((parsedView.value.dishes ?? []).map(d => d.category || 'Khác'))])
const searchKey = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
const filteredDishes = computed(() => (parsedView.value.dishes ?? []).filter(d => (!activeCategory.value || (d.category || 'Khác') === activeCategory.value) && searchKey(d.name).includes(searchKey(search.value.trim()))))
watch(categories, value => { if (!value.includes(activeCategory.value)) activeCategory.value = '' })

const viewGroups = computed(() => {
  const groups = Object.create(null)
  for (const d of filteredDishes.value) {
    const cat = d.category || 'Khác'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(d)
  }
  return groups
})

// ── Edit mode: grouped with originalIndex ──
const editGroups = computed(() => {
  const groups = Object.create(null)
  props.dishes.forEach((dish, idx) => {
    const cat = dish.category || 'Khác'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push({ ...dish, originalIndex: idx })
  })
  return groups
})

// ── Edit mode: inline editing state ──
const editingItem        = ref(null)
const editValue          = ref('')
const editingGroup       = ref(null)
const editingGroupValue  = ref('')
const editingNotes       = ref(false)
const editNotesValue     = ref('')

// ── Formatters ──
function fmt(v) {
  return v == null ? '' : new Intl.NumberFormat('vi-VN').format(v) + 'đ'
}
function fmtDisplay(val) {
  if (val === undefined || val === null || val === '') return ''
  const isNeg = String(val).startsWith('-')
  const clean = String(val).replace(/[^0-9]/g, '')
  if (!clean) return isNeg ? '-' : ''
  const num = parseInt(clean, 10)
  if (isNaN(num)) return ''
  return isNeg ? '-' + new Intl.NumberFormat('vi-VN').format(num) : new Intl.NumberFormat('vi-VN').format(num)
}
function parsePrice(val) {
  if (!String(val ?? '').trim()) return null
  const isNeg = String(val).startsWith('-')
  const num = parseInt(String(val).replace(/[^0-9]/g, ''), 10) || 0
  return isNeg ? -num : num
}

function identityIsLocked(dish) { return props.identityLocked || props.lockedDishIds.includes(dish?.id) || props.lockedDishNames.includes(dish?.name) }

// ── Edit mode actions ──
function startEdit(index, field, value) {
  if (props.disabled || (identityIsLocked(props.dishes[index]) && field === 'name')) return
  editingItem.value = { index, field }
  editValue.value = (field === 'price' || field === 'calories') ? String(value ?? '') : value
  nextTick(() => document.getElementById(`mb-${field}-${index}`)?.focus())
}

function saveEdit(index) {
  if (!editingItem.value || props.disabled) return
  const field = editingItem.value.field
  const updated = props.dishes.map((d, i) => {
    if (i !== index) return d
    if (field === 'price')    return { ...d, price: parsePrice(editValue.value) }
    if (field === 'calories') return { ...d, calories: parseInt(editValue.value.replace(/[^0-9]/g, ''), 10) || 0 }
    return { ...d, [field]: editValue.value.trim() }
  })
  emit('update:dishes', updated)
  editingItem.value = null
  nextTick(() => document.getElementById(`mb-edit-${field}-${index}`)?.focus())
}

function startEditGroup(name) {
  if (props.disabled) return
  editingGroup.value = name
  editingGroupValue.value = name
  nextTick(() => document.getElementById(`mb-group-${name}`)?.focus())
}

function saveEditGroup(oldName) {
  const newName = editingGroupValue.value.trim()
  if (newName && newName !== oldName)
    emit('update:dishes', props.dishes.map(d => (d.category || 'Khác') === oldName ? { ...d, category: newName } : d))
  editingGroup.value = null
}

function startEditNotes() {
  if (props.disabled) return
  editingNotes.value = true
  editNotesValue.value = props.notes
  nextTick(() => document.getElementById('mb-notes')?.focus())
}

function saveEditNotes() {
  emit('update:notes', editNotesValue.value.trim())
  editingNotes.value = false
}

function removeDish(index) {
  if (props.disabled || identityIsLocked(props.dishes[index])) return
  emit('update:dishes', props.dishes.filter((_, i) => i !== index))
}

function addDishInGroup(groupName) {
  if (props.disabled) return
  const newDishes = [...props.dishes, { name: 'Món ăn mới', price: null, available: true, category: groupName, calories: null, description: '' }]
  emit('update:dishes', newDishes)
  nextTick(() => startEdit(newDishes.length - 1, 'name', 'Món ăn mới'))
}

function addNewGroup() {
  if (props.disabled) return
  const name = 'Phân loại mới'
  const newDishes = [...props.dishes, { name: 'Món ăn mới', price: null, available: true, category: name, calories: null, description: '' }]
  emit('update:dishes', newDishes)
  nextTick(() => startEditGroup(name))
}
</script>

<template>
  <div class="menu-board">

    <!-- ── Header ── -->
    <div class="mb-header">
      <div class="mb-title-row">
        <div class="mb-title-line" />
        <span class="mb-ornament">◆</span>
        <h2 class="mb-title">{{ heading }}</h2>
        <span class="mb-ornament">◆</span>
        <div class="mb-title-line" />
      </div>

      <!-- Notes: view -->
      <div v-if="mode === 'view'" class="mb-notes-wrap">
        <p v-if="parsedView.notes" class="mb-notes-text">{{ parsedView.notes }}</p>
      </div>

      <!-- Notes: edit -->
      <div v-else class="mb-notes-wrap">
        <div v-if="editingNotes" class="mb-inline-wrap">
          <input :disabled="disabled"
            id="mb-notes" aria-label="Ghi chú chung của menu"
            v-model="editNotesValue"
            type="text"
            class="input mb-inline-input mb-notes-input"
            placeholder="Thêm ghi chú chung cho menu..."
            @blur="saveEditNotes"
            @keydown.enter.prevent="saveEditNotes"
          />
        </div>
        <button v-else type="button" :disabled="disabled" class="mb-notes-display" @click="startEditNotes" title="Nhấp để sửa ghi chú">
          <span v-if="notes">{{ notes }}</span>
          <span v-else class="mb-placeholder">Thêm ghi chú chung</span>
        </button>
      </div>
    </div>

    <!-- ── Body ── -->

    <!-- VIEW MODE -->
    <template v-if="mode === 'view'">
      <div v-if="(parsedView.dishes ?? []).length > 5" class="mb-filters stack-sm">
        <div class="field"><GlassInput v-model="search" label="Tìm món trong thực đơn" type="search" placeholder="Tên món…" /></div>
        <div v-if="categories.length > 1" class="mb-categories"><div class="mb-category-chips" role="group" aria-label="Lọc theo nhóm món"><AppButton v-for="(category,index) in ['',...categories]" :key="category" variant="ghost" :aria-pressed="activeCategory===category" @click="activeCategory=category">{{ index===0 ? `Tất cả · ${parsedView.dishes.length}` : category }}</AppButton></div></div>
        <p class="meta" role="status">{{ filteredDishes.length }} món{{ search || activeCategory ? ' phù hợp' : ' trong thực đơn' }} · Bấm + để chọn món.</p>
      </div>
      <div v-if="!Object.keys(viewGroups).length" class="mb-empty">{{ search || activeCategory ? 'Không tìm thấy món phù hợp.' : 'Chưa có món ăn nào.' }}<button v-if="search || activeCategory" type="button" class="btn btn--ghost" @click="search = ''; activeCategory = ''">Xóa bộ lọc</button></div>
      <div v-else class="mb-body">
        <div v-for="(dishes, cat) in viewGroups" :key="cat" class="mb-group mb-group--view">
          <div v-if="categories.length > 1" class="mb-group-name">{{ cat }}</div>
          <article v-for="d in dishes" :key="d.id || d.name" class="mb-dish-card" :class="{ 'mb-dish-card--picked': picks[d.name], 'mb-dish-card--unavailable': d.available === false }">
            <div class="mb-dish-content"><div class="mb-dish-heading"><h3>{{ d.name }}</h3><span v-if="d.available === false" class="badge">Hết món</span></div><div class="mb-dish-meta"><strong class="mb-dish-price">{{ d.price == null || d.price === '' ? 'Chưa có giá' : fmt(d.price) }}</strong><span v-if="showCalories && d.calories" class="meta"> · {{ d.calories }} kcal</span>

              <div v-if="showFeedback && feedback[`${restaurantId}:${d.restaurant_dish_id}`]?.rating_count > 0" class="mb-feedback"><button type="button" class="mb-feedback-link" :aria-label="`Xem đánh giá ${d.name}`" @click="emit('feedback', d)"><strong>★ {{ Number(feedback[`${restaurantId}:${d.restaurant_dish_id}`].average_rating).toLocaleString('vi-VN', {maximumFractionDigits:1}) }}</strong><span>· {{ feedback[`${restaurantId}:${d.restaurant_dish_id}`].rating_count }} lượt</span></button></div></div>
            </div>
            <button type="button" class="mb-select-button" :class="{ 'mb-select-button--picked': picks[d.name] }" :disabled="disabled || (d.available === false && !picks[d.name])" :aria-label="`${picks[d.name] ? 'Bỏ chọn' : 'Chọn'} ${d.name}`" :aria-pressed="!!picks[d.name]" @click="emit('toggle-dish', d)"><AppIcon :name="picks[d.name] ? 'check' : 'plus'" /></button>
          </article>
        </div>
      </div>
    </template>

    <!-- EDIT MODE -->
    <template v-else>
      <div v-if="!dishes.length" class="mb-empty">
        Chưa có món. Nhấn "+ Thêm phân loại mới" để bắt đầu.
      </div>
      <div v-else class="mb-body">

        <!-- Flat list (showCategories = false) -->
        <div v-if="!showCategories" class="mb-group-dishes">
          <div v-for="(dish, idx) in dishes" :key="idx" class="mb-dish-row mb-dish-row--edit">
            <div class="mb-dish-name-cell">
              <div v-if="editingItem?.index === idx && editingItem?.field === 'name'" class="mb-inline-wrap">
                <input :disabled="disabled" :id="`mb-name-${idx}`" aria-label="Tên món" v-model="editValue" type="text" class="input mb-inline-input mb-name-input"
                  placeholder="Tên món" @blur="saveEdit(idx)" @keydown.enter.prevent="saveEdit(idx)" />
              </div>
              <button v-else type="button" :disabled="disabled || identityIsLocked(dish)" :id="`mb-edit-name-${idx}`" class="mb-dish-name mb-editable" @click="startEdit(idx, 'name', dish.name)" title="Sửa tên món">{{ dish.name }}</button>
              <div v-if="editingItem?.index === idx && editingItem?.field === 'calories'" class="mb-inline-wrap" style="display:inline-flex;margin-left:.4rem">
                <input :disabled="disabled" :id="`mb-calories-${idx}`" v-model="editValue" type="text" inputmode="numeric"
                  class="input mb-inline-input mb-calo-input" placeholder="Kcal"
                  @blur="saveEdit(idx)" @keydown.enter.prevent="saveEdit(idx)" />
              </div>
              <span v-else-if="showCalories" class="mb-calo-badge mb-editable" @click.stop="startEdit(idx, 'calories', dish.calories || 0)">
                ⚡ {{ dish.calories || 0 }} kcal
              </span>
            </div>
            <div class="mb-dot-leader" />
            <div class="mb-dish-price-cell">
              <div v-if="editingItem?.index === idx && editingItem?.field === 'price'" class="mb-inline-wrap mb-price-wrap">
                <input :disabled="disabled" :id="`mb-price-${idx}`" aria-label="Giá món" v-model="editValue" type="text" inputmode="numeric"
                  class="input mb-inline-input mb-price-input" placeholder="Giá"
                  @blur="saveEdit(idx)" @keydown.enter.prevent="saveEdit(idx)" />
              </div>
              <button v-else type="button" :disabled="disabled" :id="`mb-edit-price-${idx}`" class="mb-dish-price mb-editable" @click="startEdit(idx, 'price', dish.price)" title="Nhấp để sửa">
                {{ dish.price == null || dish.price === '' ? 'Chưa có giá' : fmtDisplay(dish.price) + 'đ' }}
              </button>
            </div>
            <button type="button" :disabled="disabled || identityIsLocked(dish)" :aria-label="`Xóa món ${dish.name}`" class="mb-delete-btn" @click="removeDish(idx)" title="Xóa món">✕</button>
          </div>
          <div class="mb-add-row">
            <button type="button" :disabled="disabled" class="mb-add-btn" @click="addDishInGroup('Khác')">+ Thêm món mới</button>
          </div>
        </div>

        <!-- Grouped list (showCategories = true) -->
        <template v-else>
          <div v-for="(groupDishes, groupName) in editGroups" :key="groupName" class="mb-group">
            <div class="mb-group-header">
              <div v-if="editingGroup === groupName" class="mb-inline-wrap mb-group-wrap">
                <input :disabled="disabled" :id="`mb-group-${groupName}`" aria-label="Tên nhóm món" v-model="editingGroupValue" type="text"
                  class="input mb-inline-input mb-group-input" placeholder="Tên phân loại"
                  @blur="saveEditGroup(groupName)" @keydown.enter.prevent="saveEditGroup(groupName)" />
              </div>
              <button v-else type="button" :disabled="disabled" class="mb-group-name mb-editable" @click="startEditGroup(groupName)" title="Nhấp để sửa tên nhóm">{{ groupName }}</button>
              <button type="button" :disabled="disabled" class="mb-add-dish-btn" @click="addDishInGroup(groupName)">+ Thêm món</button>
            </div>
            <div class="mb-group-dishes">
              <div v-for="dish in groupDishes" :key="dish.originalIndex" class="mb-dish-row mb-dish-row--edit">
                <div class="mb-dish-name-cell">
                  <div v-if="editingItem?.index === dish.originalIndex && editingItem?.field === 'name'" class="mb-inline-wrap">
                    <input :disabled="disabled" :id="`mb-name-${dish.originalIndex}`" aria-label="Tên món" v-model="editValue" type="text"
                      class="input mb-inline-input mb-name-input" placeholder="Tên món"
                      @blur="saveEdit(dish.originalIndex)" @keydown.enter.prevent="saveEdit(dish.originalIndex)" />
                  </div>
                  <button v-else type="button" :disabled="disabled || identityIsLocked(dish)" :id="`mb-edit-name-${dish.originalIndex}`" class="mb-dish-name mb-editable" @click="startEdit(dish.originalIndex, 'name', dish.name)" title="Sửa tên món">{{ dish.name }}</button>
                  <div v-if="editingItem?.index === dish.originalIndex && editingItem?.field === 'calories'" class="mb-inline-wrap" style="display:inline-flex;margin-left:.4rem">
                    <input :disabled="disabled" :id="`mb-calories-${dish.originalIndex}`" v-model="editValue" type="text" inputmode="numeric"
                      class="input mb-inline-input mb-calo-input" placeholder="Kcal"
                      @blur="saveEdit(dish.originalIndex)" @keydown.enter.prevent="saveEdit(dish.originalIndex)" />
                  </div>
                  <span v-else-if="showCalories" class="mb-calo-badge mb-editable" @click.stop="startEdit(dish.originalIndex, 'calories', dish.calories || 0)">
                    ⚡ {{ dish.calories || 0 }} kcal
                  </span>
                </div>
                <div class="mb-dot-leader" />
                <div class="mb-dish-price-cell">
                  <div v-if="editingItem?.index === dish.originalIndex && editingItem?.field === 'price'" class="mb-inline-wrap mb-price-wrap">
                    <input :disabled="disabled" :id="`mb-price-${dish.originalIndex}`" aria-label="Giá món" v-model="editValue" type="text" inputmode="numeric"
                      class="input mb-inline-input mb-price-input" placeholder="Giá"
                      @blur="saveEdit(dish.originalIndex)" @keydown.enter.prevent="saveEdit(dish.originalIndex)" />
                  </div>
                  <button v-else type="button" :disabled="disabled" :id="`mb-edit-price-${dish.originalIndex}`" class="mb-dish-price mb-editable" @click="startEdit(dish.originalIndex, 'price', dish.price)" title="Nhấp để sửa">
                    {{ dish.price == null || dish.price === '' ? 'Chưa có giá' : fmtDisplay(dish.price) + 'đ' }}
                  </button>
                </div>
                <button type="button" :disabled="disabled || identityIsLocked(dish)" :aria-label="`Xóa món ${dish.name}`" class="mb-delete-btn" @click="removeDish(dish.originalIndex)" title="Xóa món">✕</button>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Edit toolbar: add group -->
      <div class="mb-edit-toolbar">
        <button type="button" :disabled="disabled" class="mb-add-btn" @click="addNewGroup">+ Thêm phân loại mới</button>
      </div>
    </template>

  </div>
</template>

<style scoped>
.menu-board { min-width:0; }
.mb-header { margin-bottom:20px; }
.mb-title { margin:0; font-size:21px; line-height:1.35; color:var(--ink); }
.mb-title-line,.mb-ornament { display:none; }
.mb-notes-wrap { margin-top:8px; }.mb-notes-wrap:empty{display:none;}
.mb-notes-text { white-space:pre-line; color:var(--ink-soft); font-size:var(--fs-sm); }
.mb-body { display:grid; gap:18px; }
.mb-group-name { margin:0 0 8px; font-size:14px; color:var(--ink-soft); font-weight:600; }
.mb-group--view { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
.mb-group--view>.mb-group-name { grid-column:1 / -1; margin:8px 0 0; font-size:15px; font-weight:700; color:var(--ink); }
.mb-dish-card { display:flex; align-items:center; gap:12px; border:1px solid var(--line); border-radius:16px; padding:12px 14px; background:var(--card); margin:0; min-width:0; }
.mb-dish-card:hover { border-color:var(--line-strong); }
.mb-dish-card--picked,.mb-dish-card--picked:hover { border-color:var(--primary); background:var(--primary-soft); }
.mb-dish-content { flex:1; min-width:0; overflow-wrap:anywhere; }
.mb-dish-heading { display:flex; align-items:center; flex-wrap:wrap; gap:8px; }.mb-dish-heading h3{margin:0;font-size:17px;line-height:1.4;}
.mb-dish-description { color:var(--ink-soft); font-size:14px; margin:6px 0 10px; line-height:1.5; }
.mb-select-button { width:44px; min-height:44px; flex:0 0 44px; display:grid; place-items:center; border:1px solid var(--line-strong); border-radius:var(--radius-control); padding:8px; background:var(--card); color:var(--ink); cursor:pointer; }
.mb-select-button--picked { background:var(--primary); border-color:var(--primary); color:white; }.mb-select-button :deep(svg){width:20px;height:20px;}
.mb-dish-row { display:flex; align-items:center; gap:12px; min-height:56px; width:100%; padding:12px; border:1px solid transparent; border-radius:8px; background:transparent; color:var(--ink); font:inherit; text-align:left; }
button.mb-dish-row { cursor:pointer; }
button.mb-dish-row:hover:not(:disabled) { background:var(--bg-tint); }
.mb-dish-row--picked { border-color:var(--primary); }
.mb-dish-row--picked .mb-pick-check { background:var(--primary); color:white; }
.mb-dish-row--unavailable { color:var(--ink-soft); }
.mb-dish-name-cell { display:flex; align-items:center; flex-wrap:wrap; gap:8px; flex:1; min-width:0; overflow-wrap:anywhere; }
.mb-dish-name { font-weight:600; }
.mb-dish-price { flex-shrink:0; font-size:16px; font-weight:700; color:var(--ink); font-variant-numeric:tabular-nums; }
.mb-pick-check { display:grid; place-items:center; flex-shrink:0; width:28px; height:28px; border:1px solid var(--line-strong); border-radius:6px; }
.mb-pick-check :deep(svg) { width:16px; height:16px; }
.mb-dish-meta { display:flex; align-items:center; flex-wrap:wrap; gap:6px 12px; }.mb-feedback { margin:0; }.mb-dish-meta .mb-feedback-link { min-height:44px; gap:5px; }
.mb-feedback-labels { margin:0; font-size:14px; line-height:1.5; color:var(--ink-soft); }
.mb-feedback-empty { margin:8px 0 0; font-size:14px; color:var(--ink-soft); }
.mb-feedback-link { display:inline-flex; gap:8px; align-items:center; flex-wrap:wrap; min-height:44px; border:0; background:transparent; padding:2px 0; font:inherit; font-size:14px; color:var(--ink-soft); text-align:left; cursor:pointer; }
.mb-feedback-link strong { color:var(--ink); }.mb-feedback .meta{margin:0;}
.mb-live-picks { display:flex; align-items:center; gap:10px; border-top:1px solid var(--line); margin-top:9px; padding-top:9px; font-size:14px; color:var(--ink-soft); }
.mb-viewer-avatar { width:34px; height:34px; flex:0 0 34px; display:grid; place-items:center; border-radius:50%; background:var(--bg-tint); font-size:14px; font-weight:700; }
.mb-filters { margin-bottom:20px; }
.mb-categories { display:block; }



.mb-empty { padding:24px 0; color:var(--ink-soft); }
.mb-group-header { display:flex; gap:12px; align-items:center; justify-content:space-between; }
.mb-group-dishes { display:grid; gap:8px; }
.mb-dish-row--edit { border:1px solid var(--line); }
.mb-inline-wrap { min-width:0; width:100%; }
.mb-price-wrap { width:104px; }
.mb-inline-input { min-height:44px; font-size:16px; }
.mb-editable,.mb-notes-display { border:0; padding:8px 0; background:transparent; font:inherit; color:inherit; min-height:44px; text-align:left; cursor:pointer; }
.mb-placeholder { color:var(--ink-soft); font-size:var(--fs-sm); }
.mb-dot-leader { display:none; }
.mb-delete-btn,.mb-add-dish-btn,.mb-add-btn { min-height:44px; min-width:44px; border:1px solid var(--line-strong); background:transparent; color:var(--ink); border-radius:var(--radius-control); padding:8px 12px; font:inherit; font-size:var(--fs-xs); cursor:pointer; }
.mb-add-row,.mb-edit-toolbar { margin-top:12px; }
button:disabled { cursor:default; }
button:focus-visible,input:focus-visible { outline:3px solid var(--primary); outline-offset:3px; }
@media(max-width:640px) { .mb-group--view{grid-template-columns:1fr}.mb-dish-card{padding:12px;gap:10px}.mb-dish-description{font-size:14px}.mb-live-picks{font-size:14px} .mb-dish-row { gap:8px; padding:10px 8px; flex-wrap:wrap; }.mb-dish-name-cell { flex-basis:calc(100% - 144px); }.mb-feedback { padding:0; }.mb-delete-btn { padding:8px; }.mb-dish-row--edit .mb-dish-name-cell { flex-basis:calc(100% - 60px); } }
.mb-filters { gap:12px; margin-bottom:24px; }
.mb-filters :deep(.lg-input__field) { border-radius:var(--radius-control); min-height:52px; }
.mb-categories { min-width:0; padding:4px 0; }
.mb-category-chips { display:flex; flex-wrap:wrap; align-items:flex-start; gap:8px; }
.mb-category-chips > :deep(*) { max-width:100%; }
.mb-category-chips :deep(.btn) { height:auto; min-height:48px; }
.mb-category-chips :deep(.lg-button__label) { white-space:normal; overflow-wrap:anywhere; line-height:1.4; }
.mb-category-chips :deep([aria-pressed=true]) { background:var(--primary-soft); color:var(--primary-ink); border-color:var(--primary); }
</style>

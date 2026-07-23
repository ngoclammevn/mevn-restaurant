<script setup>
import { ref, computed, nextTick } from 'vue'

const props = defineProps({
  mode:           { type: String,  default: 'view' },
  note:           { type: String,  default: '' },
  picks:          { type: Object,  default: () => ({}) },
  viewers:        { type: Array,   default: () => [] },  // presence viewers for dish chips
  dishes:         { type: Array,   default: () => [] },
  notes:          { type: String,  default: '' },
  showCalories:   { type: Boolean, default: false },
  showCategories: { type: Boolean, default: true },
  lockedDishNames: { type: [Array, Set], default: () => [] },
  lockedPriceNames: { type: [Array, Set], default: () => [] },
  orderedCounts: { type: [Object, Map], default: () => ({}) },
  selectionLocked: { type: Boolean, default: false },
})

const emit = defineEmits(['update:dishes', 'update:notes', 'toggle-dish', 'hover-dish'])

// Dish → viewers currently hovering or who have picked it
const dishSelectors = computed(() => {
  const map = {}
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

const viewGroups = computed(() => {
  const groups = {}
  for (const d of parsedView.value.dishes ?? []) {
    const cat = d.category || 'Khác'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(d)
  }
  return groups
})

// ── Edit mode: grouped with originalIndex ──
const editGroups = computed(() => {
  const groups = {}
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
  if (!val) return 0
  const isNeg = String(val).startsWith('-')
  const num = parseInt(String(val).replace(/[^0-9]/g, ''), 10) || 0
  return isNeg ? -num : num
}

function includesName(names, name) {
  return names instanceof Set ? names.has(name) : names.includes?.(name)
}

function getOrderCount(name) {
  return props.orderedCounts instanceof Map ? (props.orderedCounts.get(name) ?? 0) : (props.orderedCounts?.[name] ?? 0)
}

function isDishLocked(name) {
  return includesName(props.lockedDishNames, name)
}

function isPriceLocked(name) {
  return includesName(props.lockedPriceNames, name)
}

function lockReason(name, field) {
  if (field === 'price' && isPriceLocked(name)) return 'Không thể đổi giá vì đã có đơn thanh toán.'
  if (field === 'name' || field === 'remove') return 'Không thể đổi tên hoặc xoá món đã có người đặt.'
  return ''
}

function lockReasonId(index, field) {
  return `dish-${field}-lock-${index}`
}

// ── Edit mode actions ──
function startEdit(index, field, value) {
  const dish = props.dishes[index]
  if (!dish || (field === 'name' && isDishLocked(dish.name)) || (field === 'price' && isPriceLocked(dish.name))) return
  editingItem.value = { index, field }
  editValue.value = (field === 'price' || field === 'calories') ? String(value) : value
  nextTick(() => document.getElementById(`mb-${field}-${index}`)?.focus())
}

function saveEdit(index) {
  if (!editingItem.value) return
  const field = editingItem.value.field
  const currentDish = props.dishes[index]
  if (!currentDish) return
  if (field === 'price') {
    const nextPrice = parsePrice(editValue.value)
    const currentPrice = parsePrice(currentDish.price)
    const affectedOrders = getOrderCount(currentDish.name)
    if (nextPrice !== currentPrice && affectedOrders > 0 && !isPriceLocked(currentDish.name)) {
      const message = `Giá mới sẽ cập nhật số tiền của ${affectedOrders} đơn chưa thanh toán`
      if (typeof window !== 'undefined' && typeof window.confirm === 'function' && !window.confirm(message)) return
    }
  }
  const updated = props.dishes.map((d, i) => {
    if (i !== index) return d
    if (field === 'price')    return { ...d, price: parsePrice(editValue.value) }
    if (field === 'calories') return { ...d, calories: parseInt(editValue.value.replace(/[^0-9]/g, ''), 10) || 0 }
    return { ...d, [field]: editValue.value.trim() }
  })
  emit('update:dishes', updated)
  editingItem.value = null
}

function startEditGroup(name) {
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
  editingNotes.value = true
  editNotesValue.value = props.notes
  nextTick(() => document.getElementById('mb-notes')?.focus())
}

function saveEditNotes() {
  emit('update:notes', editNotesValue.value.trim())
  editingNotes.value = false
}

function removeDish(index) {
  if (isDishLocked(props.dishes[index]?.name)) return
  emit('update:dishes', props.dishes.filter((_, i) => i !== index))
}

function addDishInGroup(groupName) {
  const newDishes = [...props.dishes, { name: 'Món ăn mới', price: 35000, category: groupName, calories: 0, description: '' }]
  emit('update:dishes', newDishes)
  nextTick(() => startEdit(newDishes.length - 1, 'name', 'Món ăn mới'))
}

function addNewGroup() {
  const name = 'Phân loại mới'
  const newDishes = [...props.dishes, { name: 'Món ăn mới', price: 35000, category: name, calories: 0, description: '' }]
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
        <h4 class="mb-title">THỰC ĐƠN</h4>
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
          <input
            id="mb-notes"
            v-model="editNotesValue"
            type="text"
            class="input mb-inline-input mb-notes-input"
            placeholder="Thêm ghi chú chung cho menu..."
            @blur="saveEditNotes"
            @keyup.enter="saveEditNotes"
          />
        </div>
        <div v-else class="mb-notes-display" @click="startEditNotes" title="Nhấp để sửa ghi chú">
          <span v-if="notes">{{ notes }}</span>
          <span v-else class="mb-placeholder">Thêm ghi chú chung (nhấp để viết)...</span>
        </div>
      </div>
    </div>

    <!-- ── Body ── -->

    <!-- VIEW MODE -->
    <template v-if="mode === 'view'">
      <div v-if="!Object.keys(viewGroups).length" class="mb-empty">Chưa có món ăn nào.</div>
      <div v-else class="mb-body">
        <div v-for="(dishes, cat) in viewGroups" :key="cat" class="mb-group">
          <div class="mb-group-name">{{ cat }}</div>
          <div
            v-for="d in dishes"
            :key="d.name"
            class="mb-dish-row"
            :class="{ 'mb-dish-row--picked': picks[d.name], 'mb-dish-row--hot': dishSelectors[d.name]?.length >= 2, 'mb-dish-row--locked': selectionLocked }"
            @click="!selectionLocked && emit('toggle-dish', d)"
            @mouseenter="!selectionLocked && emit('hover-dish', d.name)"
            @mouseleave="!selectionLocked && emit('hover-dish', null)"
          >
            <div class="mb-dish-name-cell">
              <span class="mb-dish-name">{{ d.name }}</span>
              <span v-if="showCalories && d.calories" class="mb-calo-badge">⚡ {{ d.calories }} kcal</span>
            </div>
            <div class="mb-dot-leader" />
            <!-- Selector chips: people currently viewing this dish -->
            <div v-if="dishSelectors[d.name]?.length" class="mb-selectors">
              <div
                v-for="v in dishSelectors[d.name].slice(0, 3)"
                :key="v.presenceKey"
                class="mb-sel-av"
                :style="{'--sc': v.color}"
                :title="v.name"
              >
                <img v-if="v.avatar" :src="v.avatar" />
                <span v-else>{{ v.name?.[0] ?? '?' }}</span>
              </div>
              <span v-if="dishSelectors[d.name].length >= 2" class="mb-fomo">{{ dishSelectors[d.name].length }}!</span>
            </div>
            <span class="mb-dish-price">{{ fmt(d.price) }}</span>
            <span class="mb-pick-check">{{ picks[d.name] ? '✓' : '' }}</span>
          </div>
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
                <input :id="`mb-name-${idx}`" v-model="editValue" type="text" class="input mb-inline-input mb-name-input"
                  placeholder="Tên món" @blur="saveEdit(idx)" @keyup.enter="saveEdit(idx)" />
              </div>
              <button v-else type="button" class="mb-dish-name mb-editable" :data-testid="`dish-name-${idx}`"
                :disabled="isDishLocked(dish.name)" :title="lockReason(dish.name, 'name') || 'Nhấp để sửa'"
                :aria-describedby="isDishLocked(dish.name) ? lockReasonId(idx, 'name') : undefined"
                @click="startEdit(idx, 'name', dish.name)">{{ dish.name }}</button>
              <div v-if="editingItem?.index === idx && editingItem?.field === 'calories'" class="mb-inline-wrap" style="display:inline-flex;margin-left:.4rem">
                <input :id="`mb-calories-${idx}`" v-model="editValue" type="text" inputmode="numeric"
                  class="input mb-inline-input mb-calo-input" placeholder="Kcal"
                  @blur="saveEdit(idx)" @keyup.enter="saveEdit(idx)" />
              </div>
              <span v-else-if="showCalories" class="mb-calo-badge mb-editable" @click.stop="startEdit(idx, 'calories', dish.calories || 0)">
                ⚡ {{ dish.calories || 0 }} kcal
              </span>
              <div v-if="editingItem?.index === idx && editingItem?.field === 'description'" class="mb-inline-wrap mb-description-wrap">
                <input :id="`mb-description-${idx}`" v-model="editValue" type="text" class="input mb-inline-input"
                  placeholder="Mô tả món" @blur="saveEdit(idx)" @keyup.enter="saveEdit(idx)" />
              </div>
              <button v-else-if="dish.description" type="button" class="mb-dish-description mb-editable" @click="startEdit(idx, 'description', dish.description)">{{ dish.description }}</button>
              <button v-else type="button" class="mb-dish-description mb-editable" @click="startEdit(idx, 'description', '')">+ Mô tả</button>
            </div>
            <div class="mb-dot-leader" />
            <div class="mb-dish-price-cell">
              <div v-if="editingItem?.index === idx && editingItem?.field === 'price'" class="mb-inline-wrap mb-price-wrap">
                <input :id="`mb-price-${idx}`" v-model="editValue" type="text" inputmode="numeric"
                  class="input mb-inline-input mb-price-input" placeholder="Giá"
                  @blur="saveEdit(idx)" @keyup.enter="saveEdit(idx)" />
              </div>
              <button v-else type="button" class="mb-dish-price mb-editable" :data-testid="`dish-price-${idx}`"
                :disabled="isPriceLocked(dish.name)" :title="lockReason(dish.name, 'price') || 'Nhấp để sửa'"
                :aria-describedby="isPriceLocked(dish.name) ? lockReasonId(idx, 'price') : undefined" @click="startEdit(idx, 'price', dish.price)">
                {{ fmtDisplay(dish.price) ? fmtDisplay(dish.price) + 'đ' : '0đ' }}
              </button>
            </div>
            <button type="button" class="mb-delete-btn" :data-testid="`dish-remove-${idx}`" :disabled="isDishLocked(dish.name)"
              :title="lockReason(dish.name, 'remove') || 'Xóa món'"
              :aria-describedby="isDishLocked(dish.name) ? lockReasonId(idx, 'name') : undefined" @click="removeDish(idx)">✕</button>
            <p v-if="isDishLocked(dish.name) || isPriceLocked(dish.name)" class="mb-lock-reasons">
              <span v-if="isDishLocked(dish.name)" :id="lockReasonId(idx, 'name')">Không đổi tên hoặc xoá: món đã có người đặt.</span>
              <span v-if="isPriceLocked(dish.name)" :id="lockReasonId(idx, 'price')">Không đổi giá: đã có đơn thanh toán.</span>
            </p>
          </div>
          <div class="mb-add-row">
            <button type="button" class="mb-add-btn" @click="addDishInGroup('Khác')">+ Thêm món mới</button>
          </div>
        </div>

        <!-- Grouped list (showCategories = true) -->
        <template v-else>
          <div v-for="(groupDishes, groupName) in editGroups" :key="groupName" class="mb-group">
            <div class="mb-group-header">
              <div v-if="editingGroup === groupName" class="mb-inline-wrap mb-group-wrap">
                <input :id="`mb-group-${groupName}`" v-model="editingGroupValue" type="text"
                  class="input mb-inline-input mb-group-input" placeholder="Tên phân loại"
                  @blur="saveEditGroup(groupName)" @keyup.enter="saveEditGroup(groupName)" />
              </div>
              <h5 v-else class="mb-group-name mb-editable" @click="startEditGroup(groupName)" title="Nhấp để sửa tên nhóm">{{ groupName }}</h5>
              <button type="button" class="mb-add-dish-btn" @click="addDishInGroup(groupName)">+ Thêm món</button>
            </div>
            <div class="mb-group-dishes">
              <div v-for="dish in groupDishes" :key="dish.originalIndex" class="mb-dish-row mb-dish-row--edit">
                <div class="mb-dish-name-cell">
                  <div v-if="editingItem?.index === dish.originalIndex && editingItem?.field === 'name'" class="mb-inline-wrap">
                    <input :id="`mb-name-${dish.originalIndex}`" v-model="editValue" type="text"
                      class="input mb-inline-input mb-name-input" placeholder="Tên món"
                      @blur="saveEdit(dish.originalIndex)" @keyup.enter="saveEdit(dish.originalIndex)" />
                  </div>
                  <button v-else type="button" class="mb-dish-name mb-editable" :data-testid="`dish-name-${dish.originalIndex}`"
                    :disabled="isDishLocked(dish.name)" :title="lockReason(dish.name, 'name') || 'Nhấp để sửa'"
                    :aria-describedby="isDishLocked(dish.name) ? lockReasonId(dish.originalIndex, 'name') : undefined"
                    @click="startEdit(dish.originalIndex, 'name', dish.name)">{{ dish.name }}</button>
                  <div v-if="editingItem?.index === dish.originalIndex && editingItem?.field === 'calories'" class="mb-inline-wrap" style="display:inline-flex;margin-left:.4rem">
                    <input :id="`mb-calories-${dish.originalIndex}`" v-model="editValue" type="text" inputmode="numeric"
                      class="input mb-inline-input mb-calo-input" placeholder="Kcal"
                      @blur="saveEdit(dish.originalIndex)" @keyup.enter="saveEdit(dish.originalIndex)" />
                  </div>
                  <span v-else-if="showCalories" class="mb-calo-badge mb-editable" @click.stop="startEdit(dish.originalIndex, 'calories', dish.calories || 0)">
                    ⚡ {{ dish.calories || 0 }} kcal
                  </span>
                  <div v-if="editingItem?.index === dish.originalIndex && editingItem?.field === 'description'" class="mb-inline-wrap mb-description-wrap">
                    <input :id="`mb-description-${dish.originalIndex}`" v-model="editValue" type="text" class="input mb-inline-input"
                      placeholder="Mô tả món" @blur="saveEdit(dish.originalIndex)" @keyup.enter="saveEdit(dish.originalIndex)" />
                  </div>
                  <button v-else-if="dish.description" type="button" class="mb-dish-description mb-editable" @click="startEdit(dish.originalIndex, 'description', dish.description)">{{ dish.description }}</button>
                  <button v-else type="button" class="mb-dish-description mb-editable" @click="startEdit(dish.originalIndex, 'description', '')">+ Mô tả</button>
                </div>
                <div class="mb-dot-leader" />
                <div class="mb-dish-price-cell">
                  <div v-if="editingItem?.index === dish.originalIndex && editingItem?.field === 'price'" class="mb-inline-wrap mb-price-wrap">
                    <input :id="`mb-price-${dish.originalIndex}`" v-model="editValue" type="text" inputmode="numeric"
                      class="input mb-inline-input mb-price-input" placeholder="Giá"
                      @blur="saveEdit(dish.originalIndex)" @keyup.enter="saveEdit(dish.originalIndex)" />
                  </div>
                  <button v-else type="button" class="mb-dish-price mb-editable" :data-testid="`dish-price-${dish.originalIndex}`"
                    :disabled="isPriceLocked(dish.name)" :title="lockReason(dish.name, 'price') || 'Nhấp để sửa'"
                    :aria-describedby="isPriceLocked(dish.name) ? lockReasonId(dish.originalIndex, 'price') : undefined" @click="startEdit(dish.originalIndex, 'price', dish.price)">
                    {{ fmtDisplay(dish.price) ? fmtDisplay(dish.price) + 'đ' : '0đ' }}
                  </button>
                </div>
                <button type="button" class="mb-delete-btn" :data-testid="`dish-remove-${dish.originalIndex}`" :disabled="isDishLocked(dish.name)"
                  :title="lockReason(dish.name, 'remove') || 'Xóa món'"
                  :aria-describedby="isDishLocked(dish.name) ? lockReasonId(dish.originalIndex, 'name') : undefined" @click="removeDish(dish.originalIndex)">✕</button>
                <p v-if="isDishLocked(dish.name) || isPriceLocked(dish.name)" class="mb-lock-reasons">
                  <span v-if="isDishLocked(dish.name)" :id="lockReasonId(dish.originalIndex, 'name')">Không đổi tên hoặc xoá: món đã có người đặt.</span>
                  <span v-if="isPriceLocked(dish.name)" :id="lockReasonId(dish.originalIndex, 'price')">Không đổi giá: đã có đơn thanh toán.</span>
                </p>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Edit toolbar: add group -->
      <div class="mb-edit-toolbar">
        <button type="button" class="mb-add-btn" @click="addNewGroup">+ Thêm phân loại mới</button>
      </div>
    </template>

  </div>
</template>

<style scoped>
/* ── Board shell ── */
.menu-board {
  background: radial-gradient(circle at top left, #fffdfa 0%, #faf5e6 100%);
  border: 1px solid #e2dac7;
  border-radius: 8px;
  padding: 2.5rem 2.25rem;
  box-shadow: 0 12px 35px -12px rgba(86,81,74,.18), 0 2px 4px rgba(86,81,74,.03);
  position: relative;
  overflow: hidden;
}
.menu-board::after {
  content: ''; position: absolute; inset: 12px;
  border: 1px solid rgba(140,110,51,.22); border-radius: 6px; pointer-events: none;
}
.menu-board::before {
  content: ''; position: absolute; inset: 16px;
  border: 1px solid rgba(140,110,51,.09); border-radius: 4px; pointer-events: none;
}

/* ── Header ── */
.mb-header { text-align: center; margin-bottom: 2rem; position: relative; z-index: 2; }

.mb-title-row {
  display: flex; align-items: center; justify-content: center; gap: .8rem; margin-bottom: .4rem;
}
.mb-title-line { height: 1px; width: 50px; background: linear-gradient(to right, transparent, rgba(140,110,51,.45), transparent); }
.mb-ornament { font-size: .8rem; color: #be9a5b; user-select: none; animation: pulseGold 2s infinite ease-in-out alternate; display: inline-block; }
.mb-title {
  font-size: var(--fs-sm); font-weight: 700; letter-spacing: .3em;
  color: #8c6e33; margin: 0; text-transform: uppercase;
  animation: warmGlow 4s infinite ease-in-out;
}
.mb-notes-wrap { min-height: 1.6rem; display: flex; justify-content: center; }
.mb-notes-text { font-size: var(--fs-sm); color: var(--ink-soft); font-style: italic; margin: 0; }
.mb-notes-display {
  font-size: var(--fs-sm); color: var(--ink-soft); font-style: italic;
  padding: .15rem .5rem; border-bottom: 1px dashed transparent;
  cursor: pointer; transition: all .2s;
}
.mb-notes-display:hover { color: var(--primary); border-bottom-color: var(--primary); }
.mb-placeholder { color: var(--muted); font-style: italic; }

/* ── Body ── */
.mb-body { display: flex; flex-direction: column; gap: 1.5rem; position: relative; z-index: 2; }
.mb-empty { text-align: center; color: var(--muted); font-style: italic; padding: 1.5rem 0; position: relative; z-index: 2; }

/* ── Group ── */
.mb-group { display: flex; flex-direction: column; gap: .25rem; }
.mb-group-header {
  display: flex; align-items: center; justify-content: space-between;
  border-bottom: 1px solid rgba(140,110,51,.15); padding-bottom: .35rem; margin-bottom: .25rem;
}
.mb-group-name {
  font-size: .65rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: .08em; color: #8c6e33; margin: 0;
}
.mb-group-dishes { display: flex; flex-direction: column; gap: .35rem; padding-left: .1rem; }

/* ── Dish row ── */
.mb-dish-row {
  display: flex; align-items: baseline; gap: .4rem;
  flex-wrap: wrap;
  padding: .28rem .4rem; border-radius: 4px;
  border: 1.5px solid transparent;
  transition: background .12s, border-color .12s;
}
/* View mode: clickable */
.mb-dish-row:not(.mb-dish-row--edit) { cursor: pointer; user-select: none; }
.mb-dish-row:not(.mb-dish-row--edit):hover { background: rgba(140,110,51,.07); }
.mb-dish-row--locked { cursor: not-allowed !important; opacity: .72; }
.mb-dish-row--locked:hover { background: transparent !important; }
.mb-dish-row--picked { background: rgba(31,110,69,.08) !important; border-color: rgba(31,110,69,.25) !important; }
.mb-dish-row--picked .mb-dish-name { color: var(--primary-ink) !important; font-weight: 600; }

.mb-dish-name-cell { flex: 0 1 auto; max-width: 68%; display: flex; flex-wrap: wrap; align-items: center; gap: .3rem; }
.mb-dish-name { font-size: .95rem; font-weight: 500; color: var(--ink); line-height: 1.4; }
button.mb-dish-name, button.mb-dish-price, button.mb-dish-description { appearance: none; background: transparent; border: 0; padding: 0; font: inherit; text-align: left; }
.mb-dish-description { flex-basis: 100%; color: var(--ink-soft); font-size: var(--fs-xs); font-style: italic; max-width: 100%; }
.mb-description-wrap { margin-top: .2rem; }
.mb-editable { cursor: pointer; border-bottom: 1px dashed transparent; transition: all .15s; }
.mb-editable:hover { color: var(--primary-ink); border-bottom-color: rgba(140,110,51,.4); }
.mb-editable:disabled { cursor: not-allowed; color: var(--muted); border-bottom: 0; }

.mb-dot-leader { flex: 1; border-bottom: 1px dashed rgba(140,110,51,.35); margin-bottom: 3px; min-width: 1rem; }

.mb-dish-price-cell { flex-shrink: 0; display: flex; align-items: center; }
.mb-dish-price { font-weight: 600; font-size: var(--fs-sm); color: var(--ink); white-space: nowrap; }
.mb-lock-reasons {
  flex: 1 0 100%; display: flex; flex-wrap: wrap; gap: .2rem .7rem;
  margin: -.05rem 0 .05rem; color: var(--ink-soft); font-size: var(--fs-xs); line-height: 1.4;
}
.mb-lock-reasons span::before { content: '• '; color: #8c6e33; }

.mb-pick-check { font-size: var(--fs-xs); color: var(--primary); font-weight: 700; width: 1rem; flex-shrink: 0; text-align: right; }

/* ── Calorie badge ── */
.mb-calo-badge {
  font-size: .72rem; font-weight: 600; color: var(--primary);
  background: var(--primary-soft); padding: .05rem .28rem; border-radius: 3px;
  white-space: nowrap; flex-shrink: 0;
  border: 1px dashed rgba(31,110,69,.2);
}

/* ── Delete button (edit mode) ── */
.mb-delete-btn {
  position: relative; background: transparent; border: none; color: var(--muted);
  cursor: pointer; font-size: 10px; opacity: 0; transition: all .2s;
  width: 18px; height: 18px; display: grid; place-items: center;
  border-radius: 50%; flex-shrink: 0; margin-left: .2rem;
}
.mb-delete-btn:disabled { cursor: not-allowed; opacity: .28; }
.mb-dish-row--edit:hover .mb-delete-btn { opacity: .6; }
.mb-dish-row--edit:hover .mb-delete-btn:hover { opacity: 1; color: var(--accent); background: var(--accent-soft); }

/* ── Add buttons ── */
.mb-add-dish-btn {
  background: transparent; border: 1px solid rgba(140,110,51,.25); color: #8c6e33;
  font-size: 11px; font-weight: 600; cursor: pointer; padding: .2rem .55rem;
  border-radius: 4px; transition: all .15s;
}
.mb-add-dish-btn:hover { background: rgba(140,110,51,.08); border-color: #8c6e33; }
.mb-add-row { display: flex; justify-content: center; margin-top: .8rem; padding-top: .8rem; border-top: 1px dashed var(--line); }
.mb-add-btn {
  background: #fff; border: 1px solid #e2dac7; color: var(--ink-soft);
  padding: .45rem .9rem; border-radius: var(--radius-sm); font-size: var(--fs-xs);
  font-weight: 600; cursor: pointer; transition: all .2s;
}
.mb-add-btn:hover { background: var(--bg-tint); border-color: var(--line-strong); color: var(--primary-ink); }

.mb-edit-toolbar { display: flex; justify-content: center; margin-top: 1.25rem; position: relative; z-index: 2; }

/* ── Inline inputs ── */
.mb-inline-wrap { display: inline-flex; align-items: center; width: 100%; }
.mb-group-wrap { flex: 1; max-width: 240px; }
.mb-price-wrap { width: 80px; }
.mb-inline-input {
  background: transparent !important; border: none !important;
  border-bottom: 1px dashed var(--primary) !important; border-radius: 0 !important;
  padding: 0 !important; font-size: inherit !important; font-family: inherit !important;
  font-weight: inherit !important; color: inherit !important; height: auto !important;
  box-shadow: none !important; width: 100%; outline: none !important;
}
.mb-inline-input:focus { border-bottom-color: #8c6e33 !important; }
.mb-name-input   { font-size: var(--fs-sm) !important; font-weight: 500; color: var(--primary-ink) !important; }
.mb-price-input  { font-size: var(--fs-sm) !important; font-weight: 600; color: #8c6e33 !important; text-align: right; }
.mb-group-input  { font-size: var(--fs-sm) !important; font-weight: 700; text-transform: uppercase; color: #8c6e33 !important; }
.mb-notes-input  { font-size: var(--fs-sm) !important; font-style: italic; color: #8c6e33 !important; text-align: center; }
.mb-calo-input   { width: 55px !important; font-size: .72rem !important; font-weight: 600; color: var(--primary) !important; }

/* ── Dish selector chips (presence) ── */
.mb-selectors { display:flex; align-items:center; gap:0; margin-right:4px; flex-shrink:0; }
.mb-sel-av {
  width:18px; height:18px; border-radius:50%;
  border:1.5px solid var(--card,#fffdf9);
  background:var(--sc,#888);
  margin-left:-4px; overflow:hidden;
  display:flex; align-items:center; justify-content:center;
  font-size:7px; font-weight:800; color:#fff;
}
.mb-sel-av:first-child { margin-left:0; }
.mb-sel-av img { width:100%; height:100%; object-fit:cover; border-radius:50%; }
.mb-fomo { font-size:9px; font-weight:800; color:var(--accent); margin-left:3px; white-space:nowrap; flex-shrink:0; }
.mb-dish-row--hot { background:rgba(226,84,43,.04) !important; }
.mb-dish-row--hot::before { content:''; position:absolute; left:0; top:4px; bottom:4px; width:2.5px; border-radius:2px; background:var(--accent); }
.mb-dish-row { position:relative; }

/* ── Animations ── */
@keyframes warmGlow {
  0%,100% { text-shadow: 0 0 8px rgba(220,180,100,.2); color: #8c6e33; }
  50%      { text-shadow: 0 0 16px rgba(220,180,100,.65); color: #b08e49; }
}
@keyframes pulseGold {
  0%   { transform: scale(1);    opacity: .7; }
  100% { transform: scale(1.25); opacity: 1;  }
}
</style>

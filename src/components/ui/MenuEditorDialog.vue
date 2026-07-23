<script setup>
import { computed, ref, watch } from 'vue'
import { getOrderedDishUsage, parseMenuEditorDraft, serializeMenuEditorDraft, validateMenuEditorDraft } from '../../lib/menuEditor'
import { toDeadlineInputValue } from '../../lib/orderDeadline'
import AppButton from './AppButton.vue'
import MenuBoard from './MenuBoard.vue'
import OrderDeadlineField from './OrderDeadlineField.vue'
import TextArea from './TextArea.vue'
import TextField from './TextField.vue'

const props = defineProps({
  menu: { type: Object, required: true },
  orders: { type: Array, default: () => [] },
  open: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
  error: { type: String, default: '' },
  now: { type: Date, default: () => new Date() },
})

const emit = defineEmits(['close', 'save'])
const draft = ref(emptyDraft())
const initialPayload = ref('')
const validationError = ref('')

function emptyDraft() {
  return { title: '', order_deadline: null, menu: { kind: 'plain', text: '' } }
}

function cloneDishes(dishes) {
  return (dishes ?? []).map(dish => ({ ...dish }))
}

function matchesOriginalDeadline(deadline) {
  const original = props.menu?.order_deadline ?? null
  if (deadline === null || original === null) return deadline === original
  const displayedDeadline = toDeadlineInputValue(deadline)
  const displayedOriginal = toDeadlineInputValue(original)
  return Boolean(displayedDeadline) && displayedDeadline === displayedOriginal
}

function buildPayload() {
  const menuDraft = draft.value.menu
  const note = menuDraft.kind === 'structured'
    ? serializeMenuEditorDraft(menuDraft)
    : menuDraft.kind === 'plain' ? menuDraft.text : menuDraft.raw
  return {
    id: props.menu?.id,
    title: draft.value.title.trim(),
    note,
    order_deadline: draft.value.order_deadline,
  }
}

function resetDraft() {
  const parsed = parseMenuEditorDraft(props.menu?.note ?? '')
  const menuDraft = parsed.kind === 'structured'
    ? { ...parsed, dishes: cloneDishes(parsed.dishes) }
    : { ...parsed }
  draft.value = {
    title: props.menu?.title ?? '',
    order_deadline: props.menu?.order_deadline ?? null,
    menu: menuDraft,
  }
  validationError.value = ''
  initialPayload.value = JSON.stringify(buildPayload())
}

watch(() => props.open, (open, wasOpen) => {
  if (open && !wasOpen) resetDraft()
}, { immediate: true })

const usage = computed(() => getOrderedDishUsage(draft.value.menu.dishes, props.orders))
const isDirty = computed(() => JSON.stringify(buildPayload()) !== initialPayload.value)
const deadlineError = computed(() => {
  const deadline = draft.value.order_deadline
  if (deadline === null) return ''
  const deadlineDate = new Date(deadline)
  if (Number.isNaN(deadlineDate.getTime())) return 'Thời gian hạn chót không hợp lệ.'
  if (!matchesOriginalDeadline(deadline) && deadlineDate <= props.now) {
    return 'Hạn chót mới phải ở tương lai.'
  }
  return ''
})
const formError = computed(() => {
  if (!draft.value.title.trim()) return 'Tiêu đề menu không được để trống.'
  return deadlineError.value || validateMenuEditorDraft(draft.value.menu).error
})
const saveDisabled = computed(() => props.saving || !isDirty.value || Boolean(formError.value))

function setDishes(dishes) {
  draft.value.menu = { ...draft.value.menu, dishes }
}

function setNotes(notes) {
  draft.value.menu = { ...draft.value.menu, notes }
}

function setDeadline(deadline) {
  draft.value.order_deadline = deadline
}

function close() {
  if (isDirty.value && typeof window !== 'undefined' && typeof window.confirm === 'function') {
    if (!window.confirm('Bạn có thay đổi chưa lưu. Bỏ thay đổi?')) return
  }
  emit('close')
}

function save() {
  validationError.value = formError.value
  if (validationError.value || saveDisabled.value) return
  emit('save', buildPayload())
}
</script>

<template>
  <div v-if="open" class="menu-editor-overlay" role="presentation" @click.self="close">
    <section class="menu-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="menu-editor-heading">
      <header class="menu-editor-dialog__header">
        <div>
          <span class="menu-editor-dialog__eyebrow">QUẢN LÝ THỰC ĐƠN</span>
          <h2 id="menu-editor-heading">Chỉnh sửa món</h2>
          <p>{{ isDirty ? 'Có thay đổi chưa lưu' : 'Mọi thay đổi đã được lưu' }}</p>
        </div>
        <button type="button" class="menu-editor-dialog__close" aria-label="Đóng" @click="close">✕</button>
      </header>

      <div class="menu-editor-dialog__body">
        <aside v-if="menu.image_url" class="menu-editor-dialog__reference">
          <p>Ảnh menu gốc để đối chiếu</p>
          <a :href="menu.image_url" target="_blank" rel="noopener noreferrer" title="Mở ảnh menu gốc">
            <img :src="menu.image_url" alt="Ảnh menu gốc" />
          </a>
        </aside>

        <form class="menu-editor-dialog__form" @submit.prevent="save">
          <TextField id="menu-editor-title" v-model="draft.title" label="Tiêu đề menu" placeholder="Ví dụ: Cơm trưa thứ Hai" />
          <OrderDeadlineField
            :model-value="draft.order_deadline"
            :original-value="menu.order_deadline ?? null"
            :now="now"
            @update:model-value="setDeadline"
          />

          <MenuBoard
            v-if="draft.menu.kind === 'structured'"
            mode="edit"
            :dishes="draft.menu.dishes"
            :notes="draft.menu.notes"
            :show-calories="true"
            :locked-dish-names="usage.orderedNames"
            :locked-price-names="usage.paidNames"
            :ordered-counts="usage.counts"
            @update:dishes="setDishes"
            @update:notes="setNotes"
          />
          <TextArea
            v-else-if="draft.menu.kind === 'plain'"
            v-model="draft.menu.text"
            data-testid="menu-editor-plain-note"
            label="Nội dung menu"
            :rows="8"
            hint="Menu dạng chữ sẽ được giữ nguyên như bạn nhập."
          />
          <div v-else class="menu-editor-dialog__invalid">
            <strong>Không thể đọc dữ liệu menu cũ.</strong>
            <p>Nội dung được giữ nguyên để tránh làm mất dữ liệu. Bạn có thể sao chép và sửa lại sau.</p>
            <TextArea v-model="draft.menu.raw" label="Dữ liệu menu" :rows="8" />
          </div>

          <p v-if="validationError || formError || error" class="menu-editor-dialog__error" role="alert">{{ validationError || formError || error }}</p>
        </form>
      </div>

      <footer class="menu-editor-dialog__footer">
        <AppButton variant="ghost" type="button" @click="close">Huỷ</AppButton>
        <AppButton data-testid="menu-editor-save" type="button" :disabled="saveDisabled" :loading="saving" @click="save">Lưu thay đổi</AppButton>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.menu-editor-overlay { position: fixed; inset: 0; z-index: 100; overflow-y: auto; padding: max(1.5rem, 4vh) 1rem; background: rgba(42, 35, 26, .48); display: grid; place-items: start center; }
.menu-editor-dialog { width: min(1080px, 100%); max-height: calc(100vh - 3rem); overflow: auto; background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-lg); box-shadow: 0 28px 72px rgba(49, 38, 25, .28); }
.menu-editor-dialog__header, .menu-editor-dialog__footer { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1.25rem 1.5rem; }
.menu-editor-dialog__header { border-bottom: 1px solid var(--line); }
.menu-editor-dialog__header h2 { margin: .18rem 0; color: var(--ink); font-size: var(--fs-xl); }
.menu-editor-dialog__header p { margin: 0; color: var(--muted); font-size: var(--fs-sm); }
.menu-editor-dialog__eyebrow { color: var(--primary); font-size: var(--fs-xs); font-weight: 800; letter-spacing: .11em; }
.menu-editor-dialog__close { border: 0; background: transparent; cursor: pointer; color: var(--ink-soft); font-size: 1.15rem; padding: .45rem; }
.menu-editor-dialog__body { display: grid; grid-template-columns: minmax(220px, .72fr) minmax(0, 1.28fr); gap: 1.5rem; padding: 1.5rem; }
.menu-editor-dialog__reference { margin: 0; align-self: start; position: sticky; top: 0; }
.menu-editor-dialog__reference p { margin: 0 0 .55rem; color: var(--ink-soft); font-size: var(--fs-sm); font-weight: 650; }
.menu-editor-dialog__reference img { display: block; width: 100%; max-height: 70vh; object-fit: contain; background: var(--bg-tint); border: 1px solid var(--line); border-radius: var(--radius-md); }
.menu-editor-dialog__form { display: flex; flex-direction: column; gap: 1.15rem; min-width: 0; }
.menu-editor-dialog__invalid { padding: 1rem; border: 1px solid var(--accent); border-radius: var(--radius-md); background: var(--accent-soft); color: var(--ink); }
.menu-editor-dialog__invalid p { margin: .35rem 0 .8rem; font-size: var(--fs-sm); }
.menu-editor-dialog__error { margin: 0; color: var(--accent); font-size: var(--fs-sm); font-weight: 650; }
.menu-editor-dialog__footer { position: sticky; bottom: 0; border-top: 1px solid var(--line); background: color-mix(in srgb, var(--card) 94%, transparent); }

@media (max-width: 700px) {
  .menu-editor-overlay { padding: 0; place-items: stretch; }
  .menu-editor-dialog { width: 100%; min-height: 100vh; max-height: none; border-radius: 0; border: 0; }
  .menu-editor-dialog__header, .menu-editor-dialog__footer { padding: 1rem; }
  .menu-editor-dialog__body { grid-template-columns: 1fr; gap: 1rem; padding: 1rem; }
  .menu-editor-dialog__reference { position: static; }
  .menu-editor-dialog__reference img { max-height: 40vh; }
}
</style>

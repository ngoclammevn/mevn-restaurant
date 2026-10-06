<script setup>
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import { useUser } from '@clerk/vue'
import { useMenus } from '../composables/useMenus'
import { useCatalog } from '../composables/useCatalog'
import { menuDishes, parseMenuNote, serializeMenu } from '../lib/menu'
import RestaurantPicker from './RestaurantPicker.vue'
import { AppButton, MenuBoard, FormErrorSummary } from './ui'
const props = defineProps({ menu: { type: Object, required: true } })
const emit = defineEmits(['saved', 'cancel'])
const { user } = useUser()
const { updateMenu } = useMenus()
const { listDishes } = useCatalog()
const title = ref(props.menu.title), restaurantId = ref(props.menu.restaurant_id ?? ''), dishes = ref(menuDishes(props.menu).map(d => ({ ...d })))
const structured = !!parseMenuNote(props.menu.note) || !!props.menu.menu_items?.length
const notes = ref(parseMenuNote(props.menu.note)?.notes ?? props.menu.note ?? '')
const saving = ref(false), error = ref(''), catalog = ref([])
const identityLocked = computed(() => (props.menu.orders?.length ?? 0) > 0)
const lockedDishIds = computed(() => [...new Set((props.menu.orders || []).flatMap(o=>(o.order_items || []).map(i=>i.menu_item_id).filter(Boolean)))])
const lockedDishNames = computed(() => [...new Set((props.menu.orders || []).filter(o=>!o.order_items?.some(i=>i.menu_item_id)).flatMap(o=>String(o.item_text || '').split('\n').map(name=>name.trim())))])
function dishLocked(dish) { return lockedDishIds.value.includes(dish.id) || lockedDishNames.value.includes(dish.name) }
const formErrors = ref([]), errorSummary = ref(null)
const original = JSON.stringify({title:title.value,restaurantId:restaurantId.value,dishes:dishes.value,notes:notes.value})
function cancel() { if (saving.value) return; if (JSON.stringify({title:title.value,restaurantId:restaurantId.value,dishes:dishes.value,notes:notes.value}) !== original && !confirm('Bỏ thay đổi menu chưa lưu?')) return; emit('cancel') }
let generation = 0
watch(restaurantId, async (id, oldId) => {
  const current = ++generation
  if (oldId !== undefined && id !== oldId) dishes.value = dishes.value.map(({ restaurant_dish_id, ...dish }) => dish)
  catalog.value = []
  if (!id) return
  const result = await listDishes(id)
  if (current === generation) catalog.value = result.data ?? []
}, { immediate: true })
onUnmounted(() => generation++)
async function save() {
  if (saving.value || props.menu.poster_id !== user.value?.id || props.menu.is_closed) return
  formErrors.value=[]
  if (!title.value.trim()) formErrors.value.push({fieldId:'menu-editor-title',message:'Nhập tiêu đề menu.'})
  if (structured && (!dishes.value.length || dishes.value.some(d=>!d.name?.trim()))) formErrors.value.push({fieldId:'menu-editor-dishes',message:'Thêm ít nhất một món có tên hợp lệ.'})
  if (dishes.value.some(d=>d.price != null && (!Number.isFinite(d.price) || d.price<0))) formErrors.value.push({fieldId:'menu-editor-dishes',message:'Giá món không được âm. Giá chưa rõ có thể để trống.'})
  const orderedIds=new Set(lockedDishIds.value)
  const orderedNames=new Set(lockedDishNames.value)
  const originals=menuDishes(props.menu)
  const ordered=originals.filter(d=>orderedIds.has(d.id) || orderedNames.has(d.name))
  if (ordered.some(old=>{ const current=dishes.value.find(d=>old.id ? d.id===old.id : d.name===old.name); return !current || current.name!==old.name || current.restaurant_dish_id!==old.restaurant_dish_id }) || (identityLocked.value && restaurantId.value !== (props.menu.restaurant_id || ''))) formErrors.value.push({fieldId:'menu-editor-dishes',message:'Giữ nguyên quán, tên và liên kết của món đã có người đặt. Bạn có thể báo hết món.'})
  if (formErrors.value.length) { await nextTick(); errorSummary.value?.focus(); return }
  if (ordered.some(old=>dishes.value.find(d=>old.id ? d.id===old.id : d.name===old.name)?.price !== old.price) && !confirm('Giá mới thay đổi tiền của các đơn có món này, kể cả đơn đã trả. Trạng thái đã trả giữ nguyên. Lưu giá mới?')) return
  const account=user.value?.id, menuId=props.menu.id
  saving.value = true; error.value = ''
  try {
    const result = await updateMenu({ id: props.menu.id, title: title.value.trim(), restaurant_id: restaurantId.value || null, note: structured ? serializeMenu(dishes.value, notes.value) : notes.value.trim() || null })
    if (user.value?.id !== account || props.menu.id !== menuId) return
    if (result.error) throw result.error
    emit('saved', result.data)
  } catch { if (user.value?.id===account && props.menu.id===menuId) error.value = 'Chưa lưu được menu. Các thay đổi vẫn được giữ để bạn thử lại.' }
  finally { if (user.value?.id===account) saving.value = false }
}
</script>
<template><div class="stack menu-editor" :aria-busy="saving"><div><h3 class="section-title">Sửa menu</h3><p class="meta">Kiểm tra nội dung rồi lưu để cập nhật menu cho cả nhóm.</p></div><p v-if="menu.is_closed" class="alert">Mở lại nhận đơn trước khi sửa nội dung menu.</p><FormErrorSummary ref="errorSummary" :errors="formErrors" /><label class="field">Tiêu đề<input id="menu-editor-title" v-model="title" class="input" :aria-invalid="formErrors.some(e=>e.fieldId==='menu-editor-title')" maxlength="240" :disabled="saving || menu.is_closed" /><span v-for="entry in formErrors.filter(e=>e.fieldId==='menu-editor-title')" :key="entry.message" class="field-error">{{ entry.message }}</span></label><RestaurantPicker v-model="restaurantId" :disabled="identityLocked || saving || menu.is_closed" :lock-reason="identityLocked ? 'Quán đã được khóa vì menu có đơn đặt.' : ''" />
  <template v-if="structured"><div id="menu-editor-dishes" tabindex="-1"><MenuBoard v-model:dishes="dishes" v-model:notes="notes" mode="edit" :locked-dish-ids="lockedDishIds" :locked-dish-names="lockedDishNames" :disabled="saving || menu.is_closed" /><p v-for="entry in formErrors.filter(e=>e.fieldId==='menu-editor-dishes')" :key="entry.message" class="field-error">{{ entry.message }}</p></div><section class="stack-sm"><h4 class="section-title">Tình trạng món</h4><p class="meta">Đánh dấu hết món để mọi người không đặt thêm món đó.</p><div v-for="(dish, index) in dishes" :key="dish.id || index" class="dish-association"><div class="row-wrap"><strong>{{ dish.name || `Món ${index + 1}` }}</strong><label class="sold-out-toggle spacer"><input v-model="dish.available" type="checkbox" :true-value="false" :false-value="true" :disabled="saving || menu.is_closed" /> Hết món</label></div><label v-if="restaurantId" class="field">Món trong danh mục<select v-model="dish.restaurant_dish_id" class="input" :disabled="dishLocked(dish) || saving || menu.is_closed"><option :value="null">Ghi nhận theo tên món</option><option v-for="entry in catalog" :key="entry.id" :value="entry.id">{{ entry.name }}{{ entry.variant ? ` · ${entry.variant}` : '' }}</option></select></label></div></section></template>
  <label v-else class="field">Nội dung menu<textarea v-model="notes" class="textarea" rows="5" :disabled="saving || menu.is_closed" /></label><p v-if="error" class="alert" role="alert">{{ error }}</p><div class="row"><AppButton :loading="saving" :disabled="!title.trim() || menu.is_closed" @click="save">Lưu thay đổi</AppButton><AppButton variant="ghost" :disabled="saving" @click="cancel">Hủy</AppButton></div>
</div></template>
<style scoped>
.field-error { color: var(--unpaid-ink); font-size: .875rem; }
.menu-editor { padding: 20px; border: 1px solid var(--line); border-radius: 16px; background: var(--card); }
.dish-association { display: grid; gap: .5rem; padding: .75rem; background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-sm); }
.sold-out-toggle { display: flex; align-items: center; gap: .5rem; min-height: 44px; cursor: pointer; }
.sold-out-toggle input { width: 20px; height: 20px; accent-color: var(--primary); }
</style>

<script setup>
import { ref, watch, computed } from 'vue'
import { useUser } from '@clerk/vue'
import { useCatalog } from '../composables/useCatalog'
import { AppButton } from './ui'
const props = defineProps({ modelValue: { type: String, default: '' }, disabled: Boolean, lockReason: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue','selection'])
const { user } = useUser()
const { listRestaurants, createRestaurant } = useCatalog()
const restaurants = ref([]), query = ref(''), adding = ref(false), name = ref(''), branch = ref(''), busy = ref(false), error = ref('')
const filtered = computed(() => restaurants.value.filter(r => r.id === props.modelValue || `${r.name} ${r.branch ?? ''}`.toLocaleLowerCase('vi').includes(query.value.toLocaleLowerCase('vi'))))
const selection = computed(() => restaurants.value.find(r => r.id === props.modelValue))
watch(selection, value => emit('selection', value || null), { immediate: true })
let generation = 0
watch(user, async () => {
  const current = ++generation; restaurants.value = []; busy.value = false; error.value = ''; adding.value = false; name.value = ''; branch.value = ''
  if (!user.value) return
  const result = await listRestaurants()
  if (current !== generation) return
  if (result.error) error.value = 'Chưa tải được danh sách quán.'
  else restaurants.value = result.data ?? []
}, { immediate: true })
async function add() {
  if (!name.value.trim() || props.disabled || busy.value) return
  const account = user.value?.id, current = generation
  busy.value = true; error.value = ''
  try {
    const result = await createRestaurant({ name: name.value.trim(), branch: branch.value.trim() || null })
    if (current !== generation || user.value?.id !== account) return
    if (result.error) throw result.error
    restaurants.value.push(result.data); emit('update:modelValue', result.data.id); adding.value = false; name.value = ''; branch.value = ''
  } catch { if (current === generation) error.value = 'Chưa thêm được quán. Kiểm tra tên quán rồi thử lại.' }
  finally { if (current === generation) busy.value = false }
}
</script>
<template><div class="stack-sm restaurant-picker">
  <div class="picker-fields"><label v-if="!disabled" class="field">Tìm quán<input v-model="query" class="input" type="search" placeholder="Tên quán hoặc chi nhánh…" /></label><label class="field">Quán cho menu này<select class="input" :value="modelValue" :disabled="disabled || busy" @change="emit('update:modelValue', $event.target.value)"><option value="">Chưa xác định quán</option><option v-for="r in filtered" :key="r.id" :value="r.id">{{ r.name }}{{ r.branch ? ` · ${r.branch}` : '' }}</option></select></label></div>
  <p v-if="disabled && lockReason" class="meta">{{ lockReason }}</p>
  <p v-else-if="selection" class="meta">Đã chọn {{ selection.name }}{{ selection.branch ? ` · ${selection.branch}` : '' }}. Món và đánh giá sẽ thuộc quán này.</p>
  <p v-else class="meta">Chọn quán để ghi nhận đánh giá.</p>
  <div v-if="!disabled && !adding" class="row-wrap"><p v-if="query && !filtered.length" class="meta" role="status">Chưa tìm thấy quán phù hợp.</p><AppButton variant="ghost" @click="adding = true">+ Thêm quán mới</AppButton></div>
  <div v-if="adding" class="stack-sm add-restaurant"><h3 class="section-title">Quán mới</h3><label class="field">Tên quán<input v-model="name" class="input" maxlength="240" :disabled="busy || disabled" placeholder="Ví dụ: Cơm Nhà" /></label><label class="field">Chi nhánh (tùy chọn)<input v-model="branch" class="input" maxlength="120" :disabled="busy || disabled" placeholder="Địa chỉ hoặc tên chi nhánh" /></label><div class="row-wrap"><AppButton :loading="busy" :disabled="!name.trim() || disabled" @click="add">Thêm và chọn quán</AppButton><AppButton variant="ghost" :disabled="busy" @click="adding = false">Hủy</AppButton></div></div>
  <p v-if="error" class="alert" role="alert">{{ error }}</p>
</div></template>
<style scoped>
.picker-fields { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: .75rem; }
.add-restaurant { padding: 1rem; background: var(--bg-tint); border: 1px solid var(--line); border-radius: var(--radius-sm); }
@media (max-width: 600px) { .picker-fields { grid-template-columns: minmax(0, 1fr); } }
</style>

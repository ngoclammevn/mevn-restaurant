<script setup>
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import { useUser } from '@clerk/vue'
import { useRoute } from 'vue-router'
import { useMenus } from '../composables/useMenus'
import { useCatalog } from '../composables/useCatalog'
import { todayInVN, formatVNDate } from '../lib/date'
import { menuDishes, parseMenuNote, serializeMenu } from '../lib/menu'
import { compressImage, extractStructuredMenu } from '../lib/gemini'
import RestaurantPicker from '../components/RestaurantPicker.vue'
import PostMenuPreviewDialog from '../components/PostMenuPreviewDialog.vue'
import { AppButton, PageHeader, FileUpload, MenuBoard, SignInModal, FormErrorSummary } from '../components/ui'
const { user } = useUser()
const route = useRoute()
const { createMenu, getMenu } = useMenus()
const { listDishes } = useCatalog()
const catalog = ref([])
let catalogGeneration = 0
const menuDate = ref(todayInVN()), restaurantId = ref(''), note = ref(''), dishes = ref(null), imageFile = ref(null), imagePreview = ref(''), imageData = ref(''), useOcr = ref(true)
const title = computed(() => `Đặt cơm trưa ngày ${formatVNDate(menuDate.value)}`)
const posting = ref(false), error = ref(''), status = ref(''), createdId = ref(''), copied = ref(false), showSignIn = ref(false), reuseId = ref(''), showPreview = ref(false), restaurantName = ref(''), formErrors = ref([]), errorSummary = ref(null)
const draftKey = computed(() => user.value?.id ? `lunch-post-v2:${user.value.id}` : null)
let ready = false, generation = 0, imageGeneration = 0, reuseController

function reset() { menuDate.value = todayInVN(); restaurantId.value = ''; note.value = ''; dishes.value = null; imageFile.value = null; imageData.value = ''; useOcr.value = true }
watch(() => user.value?.id, async (accountId, previousAccountId) => {
  const guestDraft = accountId && !previousAccountId && (note.value.trim() || imageFile.value || dishes.value !== null) ? {date:menuDate.value,restaurant:restaurantId.value,note:note.value,dishes:dishes.value,ocr:useOcr.value,image:imageData.value,imageFile:imageFile.value} : null
  const current = ++generation; imageGeneration++; reuseController?.abort(); ready = false; reset(); posting.value = false; status.value = ''; reuseId.value = ''; createdId.value = ''; showPreview.value = false; formErrors.value = []; error.value = ''
  if (!draftKey.value) return
  try {
    const saved = guestDraft || JSON.parse(sessionStorage.getItem(draftKey.value) || 'null')
    if (saved) {
      menuDate.value = saved.date || todayInVN(); restaurantId.value = saved.restaurant || ''; note.value = saved.note || ''; dishes.value = saved.dishes ?? null; useOcr.value = saved.ocr ?? true
      if (saved.imageFile) imageFile.value = saved.imageFile
      else if (saved.image) {
        const [header, body] = saved.image.split(','); const bytes = Uint8Array.from(atob(body), c => c.charCodeAt(0))
        imageFile.value = new File([bytes], saved.imageName || 'menu.jpg', {type: header.match(/:(.*?);/)?.[1] || 'image/jpeg'})
      }
    }
  } catch { /* An expired draft can be replaced. */ }
  await nextTick()
  if (current !== generation) return
  ready = true
  if (route.query.reuse) await reuse(String(route.query.reuse))
}, { immediate: true })
watch([menuDate, restaurantId, note, dishes, useOcr, imageData], () => {
  if (!ready || !draftKey.value) return
  try { sessionStorage.setItem(draftKey.value, JSON.stringify({date:menuDate.value, restaurant:restaurantId.value, note:note.value, dishes:dishes.value, ocr:useOcr.value, image:imageData.value, imageName:imageFile.value?.name})) }
  catch { /* Keep the live form when session storage is full. */ }
}, { deep: true })
watch(restaurantId, async (id, old) => {
  const current = ++catalogGeneration; catalog.value = []
  if (ready && id !== old && dishes.value) dishes.value = dishes.value.map(({restaurant_dish_id, ...dish}) => dish)
  if (!id || !user.value) return
  const result = await listDishes(id)
  if (current === catalogGeneration) catalog.value = result.data ?? []
})
watch(imageFile, file => {
  const current = ++imageGeneration
  if (imagePreview.value) URL.revokeObjectURL(imagePreview.value)
  imagePreview.value = file ? URL.createObjectURL(file) : ''; imageData.value = ''
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => { if (current === imageGeneration) imageData.value = String(reader.result) }
  reader.readAsDataURL(file)
})
onUnmounted(() => { generation++; imageGeneration++; catalogGeneration++; reuseController?.abort(); if (imagePreview.value) URL.revokeObjectURL(imagePreview.value) })
async function reuse(id) {
  if (!id || posting.value) return
  const current = generation; posting.value = true; error.value = ''
  const result = await getMenu(id)
  if (current !== generation) return
  if (result.error || !result.data) error.value = 'Chưa tải được menu cũ. Thử lại nhé.'
  else {
    const menu = result.data; ready = false; reset(); restaurantId.value = menu.restaurant_id || ''
    const parsed = parseMenuNote(menu.note)
    note.value = parsed?.notes ?? menu.note ?? ''
    dishes.value = parsed ? menuDishes(menu).map(({id, menu_id, position, ...dish}) => ({...dish, available:true})) : null
    if (menu.image_url) {
      const request = new AbortController(); reuseController = request
      const timeout = setTimeout(() => request.abort(), 10000)
      try {
        const response = await fetch(menu.image_url, { signal: request.signal })
        if (!response.ok) throw new Error('image')
        const blob = await response.blob()
        if (current !== generation) return
        imageFile.value = new File([blob], 'menu-dung-lai.jpg', { type: blob.type || 'image/jpeg' })
      } catch { if (current === generation) error.value = 'Nội dung menu đã được dùng lại. Bạn cần chọn lại ảnh thực đơn.' }
      finally { clearTimeout(timeout) }
    }
    if (current !== generation) return
    await nextTick(); ready = true; reuseId.value = id
    try { sessionStorage.setItem(draftKey.value, JSON.stringify({date:menuDate.value, restaurant:restaurantId.value, note:note.value, dishes:dishes.value, ocr:true})) } catch {}
  }
  if (current === generation) posting.value = false
}
async function reviewMenu() {
  if (!user.value) { showSignIn.value = true; return }
  if (posting.value) return
  formErrors.value = []; error.value = ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(menuDate.value)) formErrors.value.push({fieldId:'post-date', message:'Chọn ngày nhận đơn.'})
  if (!imageFile.value && !note.value.trim() && dishes.value === null) formErrors.value.push({fieldId:'post-content', message:'Thêm ảnh hoặc nội dung menu.'})
  if (dishes.value !== null && (!dishes.value.length || dishes.value.some(d => !d.name?.trim()))) formErrors.value.push({fieldId:'post-content', message:'Thêm ít nhất một món có tên hợp lệ.'})
  if (dishes.value?.some(d => d.price != null && (typeof d.price !== 'number' || !Number.isFinite(d.price) || d.price < 0))) formErrors.value.push({fieldId:'post-content', message:'Giá món phải từ 0 đồng; giá chưa rõ có thể để trống.'})
  if (formErrors.value.length) { await nextTick(); errorSummary.value?.focus(); return }
  if (imageFile.value && useOcr.value && dishes.value === null) { await readImage(); return }
  showPreview.value = true
}
async function readImage() {
  const account = user.value?.id, current = generation
  posting.value = true; status.value = 'Đang đọc món trong ảnh…'; error.value = ''
  let timeout
  try {
    const compressed = await compressImage(imageFile.value)
    const parsed = await Promise.race([extractStructuredMenu(compressed), new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('timeout')), 35000) })])
    if (current !== generation || user.value?.id !== account) return
    if (!parsed?.length) throw new Error('empty')
    dishes.value = parsed.map(d => ({ ...d, available: true }))
    await nextTick(); document.getElementById('post-content')?.focus()
  } catch { if (current === generation && user.value?.id === account) error.value = 'Chưa đọc được ảnh. Thử lại hoặc bỏ chọn đọc ảnh để đăng ảnh và nội dung chữ.' }
  finally { clearTimeout(timeout); if (current === generation && user.value?.id === account) { posting.value = false; status.value = '' } }
}
async function publishMenu() {
  if (!showPreview.value || posting.value || !user.value) return
  const account = user.value.id, current = generation
  posting.value = true; error.value = ''; status.value = imageFile.value ? 'Đang tải ảnh và đăng menu…' : 'Đang đăng menu…'
  try {
    const result = await createMenu({ title:title.value, menu_date:menuDate.value, restaurant_id:restaurantId.value || null, note:dishes.value !== null ? serializeMenu(dishes.value, note.value.trim()) : note.value.trim() || null, imageFile:imageFile.value })
    if (current !== generation || user.value?.id !== account) return
    if (result.error || !result.data?.id) throw result.error || new Error('missing_menu')
    createdId.value = result.data.id; showPreview.value = false; ready = false
    try { sessionStorage.removeItem(draftKey.value) } catch {}
    reset(); await nextTick(); ready = true
  } catch { if (current === generation && user.value?.id === account) error.value = 'Chưa đăng được menu hoặc tải ảnh. Bản nháp được giữ để bạn thử lại.' }
  finally { if (current === generation && user.value?.id === account) { posting.value = false; status.value = '' } }
}
function closePreview() { if (!posting.value) showPreview.value = false }
async function copyLink() {
  try { await navigator.clipboard.writeText(`${location.origin}/share/${createdId.value}`); copied.value = true }
  catch { error.value = 'Trình duyệt chưa cho phép sao chép đường dẫn.' }
}
</script>
<template><div class="stack post-page"><PageHeader title="Đăng menu" sub="Chọn quán, thêm thực đơn và kiểm tra trước khi đăng." />
  <section v-if="createdId" class="card stack" role="status"><span class="badge badge--paid">Đã đăng thành công</span><h2 class="section-title">Menu đã sẵn sàng nhận đơn</h2><p class="meta">Gửi đường dẫn cho nhóm để mọi người chọn món.</p><p v-if="error" class="alert" role="alert">{{ error }}</p><div class="row-wrap"><AppButton :to="`/menu/${createdId}`">Xem menu</AppButton><AppButton variant="ghost" :to="{path:'/manage',query:{menu_id:createdId}}">Quản lý</AppButton><AppButton variant="ghost" @click="copyLink">{{ copied ? 'Đã chép link' : 'Sao chép link' }}</AppButton><AppButton variant="ghost" @click="createdId = ''; copied = false">Đăng menu khác</AppButton></div></section>
  <form v-else class="card stack post-form" :aria-busy="posting" @submit.prevent="reviewMenu" novalidate>
    <FormErrorSummary ref="errorSummary" :errors="formErrors" /><section class="stack post-section"><div class="step-heading"><span class="step-number" aria-hidden="true">1</span><div><h2 class="section-title">Quán và ngày nhận đơn</h2><p class="meta">Bạn là người thu tiền cho menu này.</p></div></div><RestaurantPicker v-model="restaurantId" :disabled="posting" @selection="restaurantName = $event?.name || ''" /><label class="field date-field">Ngày nhận đơn<input id="post-date" v-model="menuDate" type="date" class="input" required :aria-invalid="formErrors.some(e => e.fieldId === 'post-date')" :disabled="posting" /><span v-if="formErrors.some(e => e.fieldId === 'post-date')" class="field-error">Chọn ngày nhận đơn.</span></label></section>
    <section id="post-content" tabindex="-1" class="stack post-section"><div class="step-heading"><span class="step-number" aria-hidden="true">2</span><div><h2 class="section-title">{{ dishes === null ? 'Thêm thực đơn' : 'Kiểm tra danh sách món' }}</h2><p class="meta">{{ dishes === null ? 'Dùng ảnh, nhập nội dung hoặc tạo danh sách món.' : 'Sửa tên và giá nếu cần. Giá chưa rõ có thể để trống.' }}</p></div></div>
      <template v-if="dishes === null"><FileUpload v-model="imageFile" :disabled="posting" /><label v-if="imageFile" class="ocr-option"><input v-model="useOcr" type="checkbox" :disabled="posting" /><span><strong>Đọc danh sách món từ ảnh</strong><span class="meta">Bạn sẽ kiểm tra tên món và giá trước khi đăng.</span></span></label><label class="field">Nội dung menu / ghi chú<textarea v-model="note" class="textarea" rows="4" placeholder="Nhập thực đơn bằng chữ hoặc thêm ghi chú cho ảnh…" :disabled="posting" /></label><div class="manual-option"><div><strong>Muốn mọi người chọn món từ danh sách?</strong><p class="meta">Tự nhập tên món và giá, không cần đọc ảnh.</p></div><AppButton variant="ghost" :disabled="posting" @click="dishes = []">Tạo danh sách món</AppButton></div></template>
      <template v-else><details v-if="imagePreview" class="reuse-panel" open><summary>Đối chiếu ảnh thực đơn</summary><img :src="imagePreview" alt="Ảnh thực đơn gốc để kiểm tra tên món và giá" class="post-image" /></details><MenuBoard v-model:dishes="dishes" v-model:notes="note" mode="edit" :disabled="posting" /><details v-if="restaurantId && catalog.length && dishes.length" class="reuse-panel"><summary>Liên kết món với danh mục quán</summary><p class="meta">Chọn đúng món để các đánh giá được ghi nhận cùng một món của quán.</p><div class="stack-sm"><label v-for="(dish, index) in dishes" :key="index" class="field">{{ dish.name || `Món ${index + 1}` }}<select v-model="dish.restaurant_dish_id" class="input" :disabled="posting"><option :value="null">Ghi nhận theo tên món</option><option v-for="entry in catalog" :key="entry.id" :value="entry.id">{{ entry.name }}{{ entry.variant ? ` · ${entry.variant}` : '' }}</option></select></label></div></details><AppButton class="back-to-content" variant="ghost" :disabled="posting" @click="dishes = null">Quay về ảnh / nội dung</AppButton></template>
      <p v-for="entry in formErrors.filter(e => e.fieldId === 'post-content')" :key="entry.message" class="field-error">{{ entry.message }}</p>
    </section>
    <footer class="stack-sm post-footer"><div v-if="!(imageFile && useOcr && dishes === null)" class="publish-summary"><strong>{{ title }}</strong><p class="meta">{{ dishes !== null ? `${dishes.length} món trong danh sách` : 'Menu ảnh / nội dung chữ' }} · Người đặt tự xác nhận đã trả</p></div><p v-if="user" class="meta">Bản nháp được giữ trong phiên đăng nhập này.</p><p v-if="status" class="progress-note" role="status">{{ status }}</p><p v-if="error" class="alert" role="alert">{{ error }}</p><AppButton type="submit" :loading="posting">{{ imageFile && useOcr && dishes === null ? 'Đọc ảnh và kiểm tra món' : 'Xem lại menu' }}</AppButton></footer>
  </form><PostMenuPreviewDialog :open="showPreview" :restaurant-name="restaurantName" :menu-date="menuDate" :dishes="dishes" :note="note" :image-preview="imagePreview" :posting="posting" :errors="error" @close="closePreview" @publish="publishMenu" /><SignInModal v-if="showSignIn" @close="showSignIn = false" />
</div></template>
<style scoped>
.field-error { color: var(--unpaid-ink); font-size: .875rem; }
.post-form { max-width: 860px; }
.post-section + .post-section, .post-footer { border-top: 1px solid var(--line); padding-top: 1.25rem; }
.step-heading { display: flex; align-items: flex-start; gap: .75rem; }
.step-number { display: grid; place-items: center; flex: 0 0 30px; height: 30px; background: var(--bg-tint); color: var(--ink); border-radius: 50%; font-size: .875rem; font-weight: 700; }
.date-field { max-width: 260px; }
.reuse-panel { border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 0 .875rem; }
.reuse-panel summary { min-height: 44px; display: list-item; align-content: center; cursor: pointer; font-weight: 600; }
.reuse-panel[open] { padding-bottom: .875rem; }
.reuse-panel .field, .reuse-panel .meta { margin-top: .5rem; }
.ocr-option { display: flex; align-items: center; gap: .75rem; min-height: 44px; padding: .75rem; background: var(--bg-tint); border-radius: var(--radius-sm); cursor: pointer; }
.ocr-option input { width: 20px; height: 20px; flex-shrink: 0; accent-color: var(--primary); }
.ocr-option .meta { display: block; margin-top: .25rem; }
.manual-option { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding-top: .5rem; }
.manual-option strong { font-size: .875rem; }
.back-to-content { align-self: flex-start; }
.post-image { width: 100%; max-height: 440px; object-fit: contain; margin-top: .5rem; background: var(--bg-tint); border-radius: var(--radius-sm); }
.progress-note { color: var(--primary-ink); font-weight: 600; }
@media (max-width: 600px) { .manual-option { align-items: flex-start; flex-direction: column; gap: .5rem; } .date-field { max-width: none; } }
</style>

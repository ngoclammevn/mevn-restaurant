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
import { AppButton, PageHeader, FileUpload, SignInModal, FormErrorSummary } from '../components/ui'
const { user } = useUser()
const route = useRoute()
const { createMenu, getMenu } = useMenus()
const { listDishes } = useCatalog()
const catalog = ref([])
let catalogGeneration = 0
const menuDate = ref(todayInVN()), restaurantId = ref(''), note = ref(''), dishes = ref([]), imageFile = ref(null), imagePreview = ref(''), imageData = ref(''), useOcr = ref(true)
const title = computed(() => `Đặt cơm trưa ngày ${formatVNDate(menuDate.value)}`)
const posting = ref(false), error = ref(''), status = ref(''), createdId = ref(''), copied = ref(false), showSignIn = ref(false), reuseId = ref(''), showPreview = ref(false), restaurantName = ref(''), formErrors = ref([]), errorSummary = ref(null)
const postMode = ref('structured'), postSource = ref('manual'), keptDishes = ref([])
const draftKey = computed(() => user.value?.id ? `lunch-post-v2:${user.value.id}` : null)
let ready = false, generation = 0, imageGeneration = 0, reuseController

function reset() { menuDate.value = todayInVN(); restaurantId.value = ''; note.value = ''; dishes.value = []; keptDishes.value = []; postMode.value = 'structured'; postSource.value = 'manual'; imageFile.value = null; imageData.value = ''; useOcr.value = true }
watch(() => user.value?.id, async (accountId, previousAccountId) => {
  const guestDraft = accountId && !previousAccountId && (note.value.trim() || imageFile.value || dishes.value?.length) ? {date:menuDate.value,restaurant:restaurantId.value,note:note.value,dishes:dishes.value,ocr:useOcr.value,image:imageData.value,imageFile:imageFile.value} : null
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
  postMode.value = dishes.value !== null || (imageFile.value && useOcr.value) ? 'structured' : 'plain'
  postSource.value = imageFile.value ? 'image' : 'manual'
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
    postMode.value = parsed ? 'structured' : 'plain'
    dishes.value = parsed ? menuDishes(menu).map(({id, menu_id, position, ...dish}) => ({...dish, available:true})) : null
    if (menu.image_url) {
      const request = new AbortController(); reuseController = request
      const timeout = setTimeout(() => request.abort(), 10000)
      try {
        const response = await fetch(menu.image_url, { signal: request.signal })
        if (!response.ok) throw new Error('image')
        const blob = await response.blob()
        if (current !== generation) return
        imageFile.value = new File([blob], 'menu-dung-lai.jpg', { type: blob.type || 'image/jpeg' }); postSource.value = 'image'
      } catch { if (current === generation) error.value = 'Nội dung menu đã được dùng lại. Bạn cần chọn lại ảnh thực đơn.' }
      finally { clearTimeout(timeout) }
    }
    if (current !== generation) return
    await nextTick(); ready = true; reuseId.value = id
    try { sessionStorage.setItem(draftKey.value, JSON.stringify({date:menuDate.value, restaurant:restaurantId.value, note:note.value, dishes:dishes.value, ocr:true})) } catch {}
  }
  if (current === generation) posting.value = false
}
function changeMode(value) {
  if (posting.value || postMode.value === value) return
  postMode.value = value; formErrors.value=[]
  if (value === 'plain') { keptDishes.value = dishes.value || []; dishes.value=null; useOcr.value=false }
  else { dishes.value=keptDishes.value; useOcr.value=true }
}
function changeSource(value) { if (posting.value) return; postSource.value=value; if (value === 'image' && !dishes.value?.length) dishes.value=null; else if (value === 'manual' && dishes.value===null) dishes.value=[] }
function addDish() { dishes.value=[...(dishes.value || []),{name:'',price:null,available:true}]; nextTick(()=>document.getElementById(`post-dish-name-${dishes.value.length-1}`)?.focus()) }
function setDishPrice(index,value) { dishes.value=dishes.value.map((dish,i)=>i===index ? {...dish,price:value === '' ? null : Number(value)} : dish) }
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
  if (!user.value) { showSignIn.value=true; return }
  if (posting.value || !imageFile.value) return
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
<template>
  <div class="post-page">
    <PageHeader eyebrow="Dành cho người đăng" title="Đăng menu" />
    <section v-if="createdId" class="card post-success" role="status"><div class="post-success-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6" /></svg></div><span class="eyebrow">Đã đăng thành công</span><h2>Đã đăng menu</h2><p class="meta">Bạn thu tiền cho menu này.</p><p v-if="error" class="alert" role="alert">{{ error }}</p><div class="post-actions"><AppButton :to="`/menu/${createdId}`">Xem menu</AppButton><AppButton variant="ghost" :to="{path:'/manage',query:{menu_id:createdId}}">Xem quản lý menu</AppButton><AppButton variant="ghost" @click="copyLink">{{ copied ? 'Đã chép link' : 'Sao chép link' }}</AppButton><AppButton variant="ghost" @click="createdId = ''; copied = false">Đăng menu khác</AppButton></div></section>
    <form v-else :aria-busy="posting" @submit.prevent="reviewMenu" novalidate>
      <FormErrorSummary ref="errorSummary" :errors="formErrors" />
      <div class="post-grid">
        <div class="post-stack">
          <section class="card post-card"><h2><span class="post-step">1</span>Quán &amp; ngày nhận đơn</h2><RestaurantPicker compact v-model="restaurantId" :disabled="posting" @selection="restaurantName=$event?.name || ''" /><div class="post-two-fields"><label class="field">Ngày ăn<input id="post-date" v-model="menuDate" type="date" class="input" required :aria-invalid="formErrors.some(e=>e.fieldId==='post-date')" :disabled="posting" /><span v-if="formErrors.some(e=>e.fieldId==='post-date')" class="field-error">Chọn ngày nhận đơn.</span></label><div class="manual-close-note"><span class="field-label">Chốt đơn</span><p class="meta">Chốt thủ công trong Quản lý</p><p class="post-help">Ngày ăn theo giờ Việt Nam</p></div></div></section>
          <section id="post-content" tabindex="-1" class="card post-card"><h2><span class="post-step">2</span>Nội dung menu</h2><div class="post-tabs" role="group" aria-label="Loại thực đơn"><AppButton variant="ghost" :aria-pressed="postMode==='structured'" :disabled="posting" @click="changeMode('structured')">Danh sách món</AppButton><AppButton variant="ghost" :aria-pressed="postMode==='plain'" :disabled="posting" @click="changeMode('plain')">Menu viết tay</AppButton></div>
            <template v-if="postMode==='structured'"><div class="post-tabs" role="group" aria-label="Cách tạo danh sách"><AppButton variant="ghost" :aria-pressed="postSource==='manual'" :disabled="posting" @click="changeSource('manual')">Nhập món</AppButton><AppButton variant="ghost" :aria-pressed="postSource==='image'" :disabled="posting" @click="changeSource('image')">Từ ảnh menu</AppButton></div><div v-if="postSource==='image'" class="post-upload"><FileUpload v-model="imageFile" :disabled="posting" :label="`Ảnh thực đơn${restaurantName ? ' của ' + restaurantName : ''}`" /><AppButton class="read-image" :disabled="!imageFile || posting" :loading="posting && !!status" @click="readImage">{{ dishes?.length ? 'Đọc lại món từ ảnh' : 'Đọc món từ ảnh' }}</AppButton><label v-if="imageFile && dishes===null" class="ocr-option"><input v-model="useOcr" type="checkbox" :disabled="posting" /> Đọc danh sách món trước khi đăng</label></div><p class="post-help">{{ postSource==='image' && dishes?.length ? 'Kiểm tra tên món và giá trước khi đăng.' : 'Tên món và giá bán. Giá chưa rõ có thể để trống.' }}</p><div v-for="(dish,index) in dishes || []" :key="dish.id || index" class="post-edit-row"><label class="field"><span>Món {{ index+1 }}</span><input :id="`post-dish-name-${index}`" v-model="dish.name" class="input" maxlength="240" :disabled="posting" /></label><label class="field"><span>Giá (đồng)</span><input :value="dish.price ?? ''" class="input" type="number" min="0" inputmode="numeric" :disabled="posting" @input="setDishPrice(index,$event.target.value)" /></label><AppButton class="delete-row" variant="ghost" :disabled="posting" :aria-label="`Xóa món ${dish.name || index+1}`" @click="dishes=dishes.filter((_,i)=>i!==index)">×</AppButton></div><AppButton id="post-add-row" variant="ghost" :disabled="posting" @click="addDish">+ Thêm món</AppButton><details v-if="restaurantId && catalog.length && dishes?.length" class="catalog-links"><summary>Liên kết món với danh mục quán</summary><p class="post-help">Đánh giá được ghi nhận tại đúng món của quán.</p><label v-for="(dish,index) in dishes" :key="index" class="field">{{ dish.name || `Món ${index+1}` }}<select v-model="dish.restaurant_dish_id" class="input" :disabled="posting"><option :value="null">Ghi nhận theo tên món</option><option v-for="entry in catalog" :key="entry.id" :value="entry.id">{{ entry.name }}{{ entry.variant ? ' · '+entry.variant : '' }}</option></select></label></details><label class="field post-note-field">Lưu ý của người đăng · Không bắt buộc<textarea v-model="note" class="textarea" rows="3" :disabled="posting" placeholder="Ví dụ: nhận cơm tại sảnh…" /></label></template>
            <template v-else><label class="field post-note-field">Nội dung menu<textarea v-model="note" class="textarea" rows="6" :disabled="posting" /></label><p class="post-help">Người đặt nhập tên món tự do. App không tự tính tiền từ nội dung này.</p><details class="catalog-links"><summary>Thêm ảnh thực đơn</summary><FileUpload v-model="imageFile" :disabled="posting" /></details></template>
            <p v-for="entry in formErrors.filter(e=>e.fieldId==='post-content')" :key="entry.message" class="field-error">{{ entry.message }}</p>
          </section>
        </div>
        <aside><section class="card post-card post-summary"><h2><span class="post-step">3</span>Trước khi đăng</h2><h3>{{ restaurantName || 'Chưa chọn quán' }}</h3><p class="meta">{{ formatVNDate(menuDate) }}</p><div class="post-summary-line"><span>Nội dung</span><strong>{{ dishes!==null ? (dishes.length+' món') : postMode==='plain' ? 'Menu viết tay' : 'Ảnh thực đơn' }}</strong></div><div class="post-summary-line"><span>Người thu tiền</span><strong>{{ user?.fullName || user?.firstName || 'Bạn' }}</strong></div><p class="post-note">{{ dishes!==null ? 'Người đặt chọn món trong danh sách.' : postMode==='plain' ? 'Người đặt nhập tên món. Không tự tính tiền.' : 'Kiểm tra món đọc từ ảnh trước khi đăng.' }}</p><p class="meta">Thông tin chuyển khoản lấy từ Hồ sơ.</p><p v-if="status" class="progress-note" role="status">{{ status }}</p><p v-if="error" class="alert" role="alert">{{ error }}</p><AppButton class="post-wide" type="submit" :loading="posting">{{ imageFile && useOcr && dishes===null ? 'Đọc ảnh và kiểm tra món' : 'Xem lại menu' }}</AppButton><p class="post-help post-fixed-hint">Nháp được giữ khi đổi trang.</p></section></aside>
      </div>
    </form>
    <PostMenuPreviewDialog :open="showPreview" :restaurant-name="restaurantName" :collector-name="user?.fullName || user?.firstName || 'Bạn'" :menu-date="menuDate" :dishes="dishes" :note="note" :image-preview="imagePreview" :posting="posting" :errors="error" @close="closePreview" @publish="publishMenu" /><SignInModal v-if="showSignIn" @close="showSignIn=false" />
  </div>
</template>
<style scoped>
.post-page :deep(.btn){font-size:14px;border-radius:11px;padding:10px 14px;}
.post-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(270px,1fr);gap:22px}.post-stack{display:grid;gap:20px}.post-card{padding:24px;min-width:0}.post-card h2{display:flex;align-items:center;font-size:21px;margin:0 0 17px;line-height:1.35}.post-step{display:inline-grid;place-items:center;flex:none;width:28px;height:28px;border-radius:50%;background:var(--bg-tint);color:var(--muted);font-size:13px;margin-right:9px}.post-two-fields{display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-top:17px}.manual-close-note{display:grid;align-content:start;gap:7px}.field-label{font-size:14px;font-weight:650}.post-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}.post-tabs :deep(.btn){font-size:14px;padding:10px 14px;border-radius:12px}.post-tabs :deep([aria-pressed=true]){background:var(--bg-tint);color:var(--ink);border-color:var(--line-strong)}.post-help{font-size:12px;color:var(--muted);margin:4px 0;line-height:1.6}.post-edit-row{display:grid;grid-template-columns:minmax(0,1fr) 105px 44px;gap:9px;margin:12px 0;align-items:start}.post-edit-row .field{font-size:12px;color:var(--muted);gap:5px}.post-edit-row .delete-row{margin-top:23px;padding:9px;font-size:22px}.post-edit-row .input{min-height:46px;padding:11px 12px;border-radius:12px}.post-upload{border:1px dashed var(--line-strong);border-radius:15px;background:var(--bg);padding:21px;margin:16px 0}.post-upload :deep(.upload-well){border:0;padding:12px 0;background:transparent}.post-upload :deep(.post-image){width:100%;max-height:280px;object-fit:contain}.read-image{margin-top:12px}.ocr-option{display:flex;align-items:center;gap:8px;min-height:44px;font-size:13px;margin-top:8px}.ocr-option input{width:20px;height:20px;accent-color:var(--primary)}.post-note-field{margin-top:17px}.post-summary{position:sticky;top:22px}.post-summary h3{font-size:18px;line-height:1.4;margin:0}.post-summary>.meta{font-size:13px;margin:7px 0}.post-summary-line{display:flex;justify-content:space-between;gap:16px;border-top:1px solid var(--line);padding:13px 0;font-size:14px}.post-summary-line:first-of-type{margin-top:18px}.post-summary-line strong{overflow-wrap:anywhere;text-align:right}.post-note{font-size:12px;color:var(--muted);border-left:3px solid var(--line-strong);padding-left:11px;margin:17px 0;line-height:1.7}.post-wide{width:100%;margin-top:17px}.post-fixed-hint{margin-top:18px}.catalog-links{margin-top:17px;border-top:1px solid var(--line)}.catalog-links summary{min-height:44px;align-content:center;cursor:pointer;font-size:13px}.catalog-links .field{margin:12px 0}.field-error{font-size:13px;color:var(--unpaid-ink);margin:5px 0}.progress-note{font-size:13px;color:var(--muted);margin-top:12px}.post-success{max-width:720px;margin:auto;text-align:center;padding:30px}.post-success h2{font-size:30px;margin:10px 0}.post-success-mark{height:50px;width:50px;margin:0 auto 15px;border-radius:50%;background:var(--primary-soft);color:var(--primary);display:grid;place-items:center}.post-success-mark svg{width:27px;height:27px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.post-actions{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:22px}@media(max-width:640px){.post-grid{grid-template-columns:1fr;gap:19px}.post-summary{position:static}.post-card{padding:20px}.post-two-fields{grid-template-columns:1fr}.post-edit-row{grid-template-columns:minmax(0,1fr) 84px 44px;gap:7px}.post-edit-row .input{padding:10px 8px;font-size:16px}.post-tabs :deep(.btn){flex:1;padding:10px 11px}.post-upload{padding:17px}.post-success{padding:26px 20px}.post-actions :deep(.btn){width:100%}}
</style>

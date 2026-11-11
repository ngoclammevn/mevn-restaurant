<script setup>
import AppDatePicker from '../components/ui/AppDatePicker.vue'
import GlassSelect from '../components/ui/liquid/GlassSelect.vue'
import GlassSwitch from '../components/ui/liquid/GlassSwitch.vue'
import GlassInput from '../components/ui/liquid/GlassInput.vue'
import GlassSegmented from '../components/ui/liquid/GlassSegmented.vue'
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
import SponsorshipField from '../components/SponsorshipField.vue'
import MenuReminderField from '../components/MenuReminderField.vue'
import SlackDeliveryStatus from '../components/SlackDeliveryStatus.vue'
import { useSlackNotifications } from '../composables/useSlackNotifications'
import { useSupabaseClient } from '../lib/supabase'
import { AppButton, PageHeader, FileUpload, SignInModal, FormErrorSummary } from '../components/ui'
const { user } = useUser()
const route = useRoute()
const { createMenu, getMenu } = useMenus()
const { listDishes } = useCatalog()
const slack=useSlackNotifications(),sb=useSupabaseClient(),paymentMode=ref('self'),sponsorReason=ref(''),reminderAt=ref(null),notificationWarning=ref('')
const catalog = ref([])
let catalogGeneration = 0
const menuDate = ref(todayInVN()), restaurantId = ref(''), note = ref(''), dishes = ref([]), imageFile = ref(null), imagePreview = ref(''), imageData = ref(''), useOcr = ref(true)
const title = computed(() => `Đặt cơm trưa ngày ${formatVNDate(menuDate.value)}`)
const posting = ref(false), error = ref(''), status = ref(''), createdId = ref(''), copied = ref(false), showSignIn = ref(false), reuseId = ref(''), showPreview = ref(false), restaurantName = ref(''), formErrors = ref([]), errorSummary = ref(null)
const postMode = ref('structured'), postSource = ref('manual'), keptDishes = ref([]), priceDrafts = ref({})
const postMethodIndex = computed(() => postMode.value === 'plain' ? 2 : postSource.value === 'image' ? 1 : 0)
const postMethodOptions = ['Nhập món', 'Đọc từ ảnh', 'Menu chữ']
const draftKey = computed(() => user.value?.id ? `lunch-post-v2:${user.value.id}` : null)
let ready = false, generation = 0, imageGeneration = 0, reuseController

function reset() { priceDrafts.value={}; paymentMode.value='self';sponsorReason.value='';reminderAt.value=null; menuDate.value = todayInVN(); restaurantId.value = ''; note.value = ''; dishes.value = []; keptDishes.value = []; postMode.value = 'structured'; postSource.value = 'manual'; imageFile.value = null; imageData.value = ''; useOcr.value = true }
watch(() => user.value?.id, async (accountId, previousAccountId) => {
  const guestDraft = accountId && !previousAccountId && (note.value.trim() || imageFile.value || dishes.value?.length) ? {date:menuDate.value,restaurant:restaurantId.value,note:note.value,dishes:dishes.value,ocr:useOcr.value,image:imageData.value,imageFile:imageFile.value} : null
  const current = ++generation; imageGeneration++; reuseController?.abort(); ready = false; reset(); posting.value = false; status.value = ''; reuseId.value = ''; createdId.value = ''; showPreview.value = false; formErrors.value = []; error.value = ''
  if (!draftKey.value) return
  try {
    const saved = guestDraft || JSON.parse(sessionStorage.getItem(draftKey.value) || 'null')
    if (saved) {
      paymentMode.value=saved.paymentMode || 'self';sponsorReason.value=saved.sponsorReason || '';reminderAt.value=saved.reminderAt || null
      menuDate.value = saved.date || todayInVN(); restaurantId.value = saved.restaurant || ''; note.value = saved.note || ''; dishes.value = saved.dishes ?? null; useOcr.value = saved.ocr ?? true
      if (saved.imageFile) imageFile.value = saved.imageFile
      else if (saved.image) {
        const [header, body] = saved.image.split(','); const bytes = Uint8Array.from(atob(body), c => c.charCodeAt(0))
        imageFile.value = new File([bytes], saved.imageName || 'menu.jpg', {type: header.match(/:(.*?);/)?.[1] || 'image/jpeg'})
      }
    }
  } catch { /* An expired draft can be replaced. */ }
  postMode.value = dishes.value !== null || (imageFile.value && useOcr.value) ? 'structured' : 'plain'
  // Mặc định đọc từ ảnh; chỉ giữ "Nhập món" khi bản nháp đã có món tự nhập.
  if (imageFile.value || (postMode.value === 'structured' && !dishes.value?.length)) changeSource('image')
  else postSource.value = 'manual'
  await nextTick()
  if (current !== generation) return
  ready = true
  if (route.query.reuse) await reuse(String(route.query.reuse))
}, { immediate: true })
watch([menuDate, restaurantId, note, dishes, useOcr, imageData,paymentMode,sponsorReason,reminderAt], () => {
  if (!ready || !draftKey.value) return
  try { sessionStorage.setItem(draftKey.value, JSON.stringify({date:menuDate.value,paymentMode:paymentMode.value,sponsorReason:sponsorReason.value,reminderAt:reminderAt.value, restaurant:restaurantId.value, note:note.value, dishes:dishes.value, ocr:useOcr.value, image:imageData.value, imageName:imageFile.value?.name})) }
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
      } catch { if (current === generation) error.value = 'Đã dùng lại nội dung menu. Bạn chọn lại ảnh thực đơn nhé.' }
      finally { clearTimeout(timeout) }
    }
    if (current !== generation) return
    await nextTick(); ready = true; reuseId.value = id
    try { sessionStorage.setItem(draftKey.value, JSON.stringify({date:menuDate.value,paymentMode:paymentMode.value,sponsorReason:sponsorReason.value,reminderAt:reminderAt.value, restaurant:restaurantId.value, note:note.value, dishes:dishes.value, ocr:true})) } catch {}
  }
  if (current === generation) posting.value = false
}
function changeMode(value) {
  if (posting.value || postMode.value === value) return
  postMode.value = value; formErrors.value=[]; priceDrafts.value={}
  if (value === 'plain') { keptDishes.value = dishes.value || []; dishes.value=null; useOcr.value=false }
  else { dishes.value=keptDishes.value; useOcr.value=true }
}
function choosePostMethod(index) {
  if (index === 2) { changeMode('plain'); return }
  if (postMode.value !== 'structured') changeMode('structured')
  changeSource(index === 1 ? 'image' : 'manual')
}
function changeSource(value) { if (posting.value) return; postSource.value=value; if (value === 'image' && !dishes.value?.length) dishes.value=null; else if (value === 'manual' && dishes.value===null) dishes.value=[] }
function addDish() { dishes.value=[...(dishes.value || []),{name:'',price:null,available:true}]; nextTick(()=>document.getElementById(`post-dish-name-${dishes.value.length-1}`)?.focus()) }
function removeDish(index) { dishes.value=dishes.value.filter((_,i)=>i!==index); priceDrafts.value={} }
const formatDishPrice = value => value == null || value === '' ? '' : new Intl.NumberFormat('vi-VN').format(value)
function dishPriceText(dish,index) { return Object.prototype.hasOwnProperty.call(priceDrafts.value,index) ? priceDrafts.value[index] : formatDishPrice(dish.price) }
function setDishPrice(index,value) {
  const digits=String(value).replace(/\D/g,'')
  priceDrafts.value={...priceDrafts.value,[index]:digits}
  const price=digits ? Number(digits) : null
  dishes.value=dishes.value.map((dish,i)=>i===index ? {...dish,price} : dish)
}
function finishDishPrice(index) { const next={...priceDrafts.value}; delete next[index]; priceDrafts.value=next }
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
    dishes.value = parsed.map(d => ({ ...d, available: true })); priceDrafts.value={}
    await nextTick(); document.getElementById('post-content')?.focus()
  } catch { if (current === generation && user.value?.id === account) error.value = 'Chưa đọc được ảnh. Thử lại hoặc bỏ chọn đọc ảnh để đăng ảnh và nội dung chữ.' }
  finally { clearTimeout(timeout); if (current === generation && user.value?.id === account) { posting.value = false; status.value = '' } }
}
async function publishMenu() {
  if (!showPreview.value || posting.value || !user.value) return
  const account = user.value.id, current = generation, requestedReminder=reminderAt.value
  posting.value = true; error.value = ''; status.value = imageFile.value ? 'Đang tải ảnh và đăng menu…' : 'Đang đăng menu…'
  try {
    const result = await createMenu({ title:title.value, menu_date:menuDate.value, restaurant_id:restaurantId.value || null, note:dishes.value !== null ? serializeMenu(dishes.value, note.value.trim()) : note.value.trim() || null, imageFile:imageFile.value,payment_mode:paymentMode.value,sponsor_reason:sponsorReason.value.trim() || null })
    if (current !== generation || user.value?.id !== account) return
    if (result.error || !result.data?.id) throw result.error || new Error('missing_menu')
    createdId.value = result.data.id; showPreview.value = false; ready = false;notificationWarning.value=''
    // The menu is committed already: ancillary delivery failures must never invite a duplicate post.
    try { sessionStorage.removeItem(draftKey.value) } catch {}
    try {
      await slack.publishMenu(result.data.id)
      if(current!==generation || user.value?.id!==account)return
      if(requestedReminder){
        const reminderResult=await sb.rpc('set_lunch_reminder',{p_menu_id:result.data.id,p_at:requestedReminder})
        if(current!==generation || user.value?.id!==account)return
        if(reminderResult.error)throw reminderResult.error
        await slack.syncReminder(result.data.id)
      }
    } catch {
      if(current===generation && user.value?.id===account)notificationWarning.value='Menu đã đăng. Chưa hoàn tất thông báo hoặc lịch nhắc; bạn có thể thử lại trong Quản lý.'
    }
    if(current!==generation || user.value?.id!==account)return
    reset(); postSource.value = 'image'; dishes.value = null; await nextTick(); ready = true
  } catch { if (current === generation && user.value?.id === account) error.value = 'Chưa đăng được menu hoặc tải ảnh. Bạn vẫn còn bản nháp để thử lại.' }
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
    <section v-if="createdId" class="card post-success" role="status"><div class="post-success-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6" /></svg></div><span class="eyebrow">Đã đăng thành công</span><h2>Đã đăng menu</h2><p class="meta">Bạn quản lý đơn cho menu này.</p><p v-if="notificationWarning" class="alert" role="status">{{ notificationWarning }}</p><SlackDeliveryStatus v-if="slack.states.value[createdId]" :state="slack.states.value[createdId]" @retry="slack.retryPending(createdId)" @resolve="slack.resolveEvent(slack.states.value[createdId]?.eventId,$event,createdId)" /><p v-if="error" class="alert" role="alert">{{ error }}</p><div class="post-actions"><AppButton :to="`/menu/${createdId}`">Xem menu</AppButton><AppButton variant="ghost" :to="{path:'/manage',query:{menu_id:createdId}}">Quản lý đơn</AppButton><AppButton variant="ghost" @click="copyLink">{{ copied ? 'Đã chép link' : 'Sao chép link' }}</AppButton><AppButton variant="ghost" @click="createdId = ''; copied = false">Đăng menu khác</AppButton></div></section>
    <form v-else :aria-busy="posting" @submit.prevent="reviewMenu" novalidate>
      <FormErrorSummary ref="errorSummary" :errors="formErrors" />
      <div class="post-grid">
        <div class="post-stack">
          <section id="post-content" tabindex="-1" class="card post-card">
            <h2><span class="post-step">1</span>Nội dung menu</h2>
            <GlassSegmented v-if="!posting" class="post-method" label="Cách thêm menu" :options="postMethodOptions" :model-value="postMethodIndex" @update:model-value="choosePostMethod" />
            <p v-else class="post-method-readonly" role="status">{{ postMethodOptions[postMethodIndex] }}</p>
            <template v-if="postMode==='structured'">
              <div v-if="postSource==='image'" class="post-upload" :class="{'post-upload--compact': imageFile && dishes?.length}">
                <div v-if="imageFile && dishes?.length" class="ocr-image-summary"><img v-if="imagePreview" :src="imagePreview" alt="" /><div><strong>Đã đọc {{ dishes.length }} món</strong><span class="meta">{{ imageFile.name }}</span></div></div>
                <FileUpload v-model="imageFile" :disabled="posting" :label="`Ảnh thực đơn${restaurantName ? ' của ' + restaurantName : ''}`" />
                <AppButton class="read-image" :disabled="!imageFile || posting" :loading="posting && !!status" @click="readImage">{{ dishes?.length ? 'Đọc lại từ ảnh' : 'Đọc món từ ảnh' }}</AppButton>
                <div v-if="imageFile && dishes===null" class="ocr-option"><GlassSwitch v-model="useOcr" :disabled="posting" aria-label="Đọc danh sách món trước khi đăng" /><span>Đọc danh sách món trước khi đăng</span></div>
              </div>
              <p class="post-help">{{ postSource==='image' && dishes?.length ? 'Kiểm tra tên món và giá trước khi đăng.' : 'Tên món và giá bán. Giá chưa rõ có thể để trống.' }}</p>
              <div class="post-dish-table">
                <div class="post-dish-head" aria-hidden="true"><span>Tên món</span><span>Giá / suất (đồng)</span><span></span></div>
                <div v-for="(dish,index) in dishes || []" :key="dish.id || index" class="post-edit-row">
                  <div class="field dish-name-field"><GlassInput :label="`Món ${index+1}`" :id="`post-dish-name-${index}`" v-model="dish.name" placeholder="Tên món" maxlength="240" :disabled="posting" /></div>
                  <div class="field dish-price-field"><GlassInput :label="`Giá / suất · món ${index+1}`" :id="`post-dish-price-${index}`" :model-value="dishPriceText(dish,index)" placeholder="Chưa rõ" inputmode="numeric" autocomplete="off" :disabled="posting" @update:model-value="setDishPrice(index,$event)" @blur="finishDishPrice(index)" /></div>
                  <AppButton class="delete-row" variant="ghost" :disabled="posting" :aria-label="`Xóa món ${dish.name || index+1}`" @click="removeDish(index)">×</AppButton>
                </div>
                <div class="post-add-row"><AppButton id="post-add-row" variant="ghost" :disabled="posting" @click="addDish">+ Thêm món</AppButton></div>
              </div>
              <details v-if="restaurantId && catalog.length && dishes?.length" class="catalog-links">
                <summary>Gắn món với danh sách của quán <span>Không bắt buộc</span></summary>
                <p class="post-help">Chỉ chọn khi món trong thực đơn khớp món đã lưu ở quán. Việc này giúp gom đánh giá đúng món; không ảnh hưởng đơn đặt hay giá tiền.</p>
                <div v-for="(dish,index) in dishes" :key="index" class="field"><GlassSelect :label="`Món tương ứng với ${dish.name || `món ${index+1}`}`" v-model="dish.restaurant_dish_id" :disabled="posting" :options="[{value:null,label:'Không liên kết'},...catalog.map(p=>({value:p.id,label:p.name+(p.variant?' · '+p.variant:'')}))]" /></div>
              </details>
              <label class="field post-note-field">Lưu ý của người đăng · Không bắt buộc<textarea v-model="note" class="textarea" rows="3" :disabled="posting" placeholder="Ví dụ: nhận cơm tại sảnh…" /></label>
            </template>
            <template v-else><label class="field post-note-field">Nội dung menu<textarea v-model="note" class="textarea" rows="6" :disabled="posting" /></label><p class="post-help">Người đặt nhập tên món tự do. Bạn tự xác nhận giá với quán.</p><section class="catalog-links"><h3>Ảnh thực đơn</h3><FileUpload v-model="imageFile" :disabled="posting" /></section></template>
            <p v-for="entry in formErrors.filter(e=>e.fieldId==='post-content')" :key="entry.message" class="field-error">{{ entry.message }}</p>
          </section>
          <section class="card post-card post-options"><h2><span class="post-step">2</span>Thanh toán &amp; nhắc đặt cơm</h2><SponsorshipField v-model="paymentMode" v-model:reason="sponsorReason" :disabled="posting" /><MenuReminderField v-model="reminderAt" :menu-date="menuDate" :disabled="posting" /></section>
        </div>
        <aside>
          <section class="card post-card"><h2><span class="post-step">3</span>Quán và ngày ăn</h2><RestaurantPicker compact v-model="restaurantId" :disabled="posting" @selection="restaurantName=$event?.name || ''" /><div class="post-two-fields"><div class="field"><AppDatePicker id="post-date" label="Ngày ăn" v-model="menuDate" required :aria-invalid="formErrors.some(e=>e.fieldId==='post-date')" :disabled="posting" /><span v-if="formErrors.some(e=>e.fieldId==='post-date')" class="field-error">Chọn ngày nhận đơn.</span></div></div></section>
          <section class="card post-card post-summary"><h2><span class="post-step">4</span>Trước khi đăng</h2><h3>{{ restaurantName || 'Chưa chọn quán' }}</h3><p class="meta">{{ formatVNDate(menuDate) }}</p><div class="post-summary-line"><span>Nội dung</span><strong>{{ dishes!==null ? (dishes.length+' món') : postMode==='plain' ? 'Nội dung tự nhập' : 'Ảnh thực đơn' }}</strong></div><div class="post-summary-line"><span>Người thu tiền</span><strong>{{ user?.fullName || user?.firstName || 'Bạn' }}</strong></div><p class="post-note">{{ dishes!==null ? 'Người đặt chọn món trong danh sách.' : postMode==='plain' ? 'Người đặt nhập tên món. Không tự tính tiền.' : 'Kiểm tra món đọc từ ảnh trước khi đăng.' }}</p><p class="meta">Thông tin chuyển khoản theo trang Cá nhân.</p><p v-if="status" class="progress-note" role="status">{{ status }}</p><p v-if="error" class="alert" role="alert">{{ error }}</p><AppButton class="post-wide" type="submit" :loading="posting">{{ imageFile && useOcr && dishes===null ? 'Đọc ảnh và kiểm tra món' : 'Xem lại menu' }}</AppButton><p class="post-help post-fixed-hint">Bạn có thể đổi trang rồi quay lại viết tiếp.</p></section></aside>
      </div>
    </form>
    <PostMenuPreviewDialog :open="showPreview" :restaurant-name="restaurantName" :collector-name="user?.fullName || user?.firstName || 'Bạn'" :menu-date="menuDate" :dishes="dishes" :note="note" :image-preview="imagePreview" :posting="posting" :errors="error" @close="closePreview" @publish="publishMenu" /><SignInModal v-if="showSignIn" @close="showSignIn=false" />
  </div>
</template>
<style scoped>
.post-page { min-width:0; }
.post-page :deep(.btn) { min-height:48px; font-size:16px; font-weight:600;  padding:11px 16px; }
.post-grid { display:grid; grid-template-columns:minmax(0,1fr) 360px; gap:24px; align-items:start; }
.post-stack { display:grid; gap:20px; min-width:0; }
.post-card { padding:28px; min-width:0; border-radius:24px; }
.post-card h2 { display:flex; align-items:center; gap:10px; font-size:20px; font-weight:750; margin:0 0 20px; line-height:1.4; }
.post-step { display:inline-grid; place-items:center; flex:none; width:28px; height:28px; border-radius:8px; background:var(--primary-soft); color:var(--primary); font-size:14px; font-weight:750; }
.post-card .field { font-size:16px; font-weight:650; color:var(--ink); }
.post-card .input,.post-card .textarea { min-width:0; font-size:16px; font-weight:500; }
.post-two-fields { display:grid; grid-template-columns:1fr; gap:16px; margin-top:20px; }
.field-label { font-size:14px; font-weight:700; }
.post-method { margin:0 0 18px; max-width:620px; }
.post-method-readonly { margin:0 0 18px; padding:12px 14px; border-radius:var(--radius-control); background:var(--bg-tint); color:var(--ink); font-weight:650; }
.post-help { font-size:14px; color:var(--ink-soft); margin:6px 0; line-height:1.6; font-weight:400; overflow-wrap:anywhere; }
.post-dish-table { margin:18px 0; border:1px solid var(--line); border-radius:10px; overflow:hidden; }
.post-dish-head,.post-edit-row { display:grid; grid-template-columns:minmax(0,1fr) minmax(150px,190px) 44px; align-items:center; gap:12px; padding:12px; }
.post-dish-head { background:var(--bg-tint); font-size:14px; font-weight:750; color:var(--ink); }
.post-edit-row { border-top:1px solid var(--line); }
.post-edit-row .field { position:relative; min-width:0; margin:0; }
.post-edit-row .dish-name-field :deep(.lg-input__label),.post-edit-row .dish-price-field :deep(.lg-input__label) { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; }
.post-edit-row .dish-price-field :deep(input) { text-align:right; font-variant-numeric:tabular-nums; }
.post-edit-row .glass-input-host :deep(input) { min-height:46px; }
.post-edit-row .delete-row { width:44px; height:44px; padding:0; font-size:25px; font-weight:500; border-color:transparent; color:var(--ink-soft); }
.post-edit-row .delete-row:hover:not(:disabled) { color:var(--unpaid-ink,var(--accent)); background:var(--accent-soft); }
.post-add-row { border-top:1px solid var(--line); padding:10px 12px; }
.post-add-row :deep(.btn) { color:var(--primary-ink); border-color:transparent; padding:8px 10px; }
.post-upload { border:1px solid var(--line); border-radius:10px; background:var(--bg-tint); padding:18px; margin:18px 0; min-width:0; }
.post-upload :deep(.upload-well) { background:var(--card); }
.post-upload--compact { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:8px 16px; padding:12px 14px; margin:14px 0; }
.post-upload--compact :deep(.upload-well) { display:none; }
.post-upload--compact :deep(.upload-label) { display:flex; align-items:center; justify-content:space-between; gap:12px; margin:0; }
.post-upload--compact :deep(.upload-label .row-wrap) { margin:0; flex:none; }
.ocr-image-summary { display:flex; align-items:center; gap:10px; min-width:0; }
.ocr-image-summary img { width:44px; height:44px; flex:none; object-fit:cover; border-radius:8px; background:var(--bg-tint); }
.ocr-image-summary div { min-width:0; display:grid; gap:3px; }
.ocr-image-summary strong { font-size:14px; }
.ocr-image-summary .meta { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:13px; }
.read-image { margin-top:14px; }
.ocr-option { display:flex; align-items:center; gap:10px; min-height:44px; font-size:14px; margin-top:8px; color:var(--ink); }
.ocr-option input { width:20px; height:20px; flex:none; accent-color:var(--primary); }
.post-note-field { margin-top:20px; }
.post-grid>aside { display:grid; gap:24px; align-self:stretch; align-content:start; min-width:0; }
.post-grid>aside>.post-summary { position:sticky; top:90px; }
.post-summary { background:var(--card); }
.post-summary h3 { font-size:21px; font-weight:750; line-height:1.45; margin:0; overflow-wrap:anywhere; }
.post-summary>.meta { font-size:14px; color:var(--ink-soft); margin:8px 0; }
.post-summary-line { display:flex; justify-content:space-between; gap:16px; border-top:1px solid var(--line); padding:14px 0; font-size:14px; }
.post-summary-line:first-of-type { margin-top:20px; }
.post-summary-line span { flex:none; color:var(--ink-soft); }
.post-summary-line strong { min-width:0; overflow-wrap:anywhere; text-align:right; font-weight:750; }
.post-note { font-size:14px; color:var(--ink-soft); background:var(--bg-tint); border-radius:8px; padding:12px; margin:8px 0 16px; line-height:1.65; }
.post-wide { width:100%; margin-top:20px; }
.post-fixed-hint { margin-top:12px; }
.catalog-links { margin-top:18px; border-top:1px solid var(--line); }
.catalog-links summary { display:flex; align-items:center; justify-content:space-between; gap:12px; min-height:48px; padding:8px 0; color:var(--ink); font-size:15px; font-weight:650; cursor:pointer; }
.catalog-links summary span { flex:none; color:var(--ink-soft); font-size:13px; font-weight:500; }
.catalog-links[open] summary { margin-bottom:8px; }
.catalog-links h3 { margin:20px 0 12px; font-size:18px; font-weight:650; color:var(--ink); }
.catalog-links .field { margin:14px 0; }
.field-error { font-size:14px; color:var(--unpaid-ink); margin:6px 0; font-weight:500; }
.progress-note { font-size:14px; color:var(--ink-soft); margin-top:12px; }
.post-options { display:grid; gap:20px; }
.post-options h2 { margin:0; }
.post-options :deep(.sponsorship-field) { min-width:0; margin:0; padding:0 0 24px; border-bottom:1px solid var(--line); }
.post-options :deep(.sponsorship-field legend) { font-size:16px; font-weight:700; }
.post-options :deep(.sponsorship-field>label) { color:var(--ink); }
.post-options :deep(.sponsorship-field p),.post-options :deep(.menu-reminder-field small) { font-size:14px; line-height:1.6; color:var(--ink-soft); overflow-wrap:anywhere; }
.post-options :deep(input[type=radio]) { width:18px; height:18px; flex:none; accent-color:var(--primary); }
.post-options :deep(.menu-reminder-field>label) { font-size:14px; font-weight:700; }
.post-options :deep(.menu-reminder-field>div) { min-width:0; }
.post-options :deep(.menu-reminder-field input),.post-options :deep(.menu-reminder-field button) { min-width:0; min-height:44px; max-width:100%; border-color:var(--line-strong); font-size:16px; }
.post-success { max-width:720px; margin:auto; text-align:center; padding:32px; }
.post-success h2 { font-size:30px; font-weight:750; margin:10px 0; }
.post-success-mark { height:50px; width:50px; margin:0 auto 16px; border-radius:50%; background:var(--primary-soft); color:var(--primary); display:grid; place-items:center; }
.post-success-mark svg { width:27px; height:27px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
.post-actions { display:flex; justify-content:center; gap:10px; flex-wrap:wrap; margin-top:24px; }
@media(max-width:1000px) {
  .post-grid { grid-template-columns:minmax(0,1fr) 300px; gap:20px; }
  .post-card { padding:20px; }
  .post-dish-head,.post-edit-row { grid-template-columns:minmax(0,1fr) 112px 44px; gap:8px; padding:10px; }
}
@media(max-width:850px) {
  .post-grid { grid-template-columns:1fr; }
  .post-grid>aside>.post-summary { position:static; }
}
@media(max-width:540px) {
  .post-stack { gap:16px; }
  .post-card { padding:18px; }
  .post-card h2 { font-size:19px; gap:9px; }
  .post-two-fields { grid-template-columns:1fr; gap:16px; }
  .post-method { max-width:none; }
  .post-method :deep(.lg-track__item) { min-height:48px; font-size:14px; }
  .post-dish-head { display:none; }
  .post-edit-row { grid-template-columns:minmax(0,1fr) 44px; gap:10px 12px; padding:12px; }
  .post-edit-row .dish-name-field,.post-edit-row .dish-price-field { grid-column:1 / 2; }
  .post-edit-row .dish-name-field :deep(.lg-input__label),.post-edit-row .dish-price-field :deep(.lg-input__label) { position:static; width:auto; height:auto; margin:0 0 6px; clip-path:none; white-space:normal; font-size:14px; }
  .post-edit-row .delete-row { grid-column:2; grid-row:1 / span 2; align-self:center; margin:0; }
  .post-upload { padding:14px; }
  .post-upload--compact { grid-template-columns:1fr; gap:10px; }
  .post-upload--compact :deep(.upload-label) { align-items:flex-start; }
  .post-upload--compact .read-image { width:auto; }
  .ocr-image-summary img { width:40px; height:40px; }
  .read-image { width:100%; }
  .post-summary-line { gap:12px; }
  .post-success { padding:26px 20px; }
  .post-actions :deep(.btn) { width:100%; }
}
</style>

<script setup>
import { ref, computed, nextTick, watch, onMounted } from 'vue'
import { useUser } from '@clerk/vue'
import { gsap } from 'gsap'
import { useMenus } from '../composables/useMenus'
import { todayInVN, formatVNDate } from '../lib/date'
import { compressImage, extractStructuredMenu } from '../lib/gemini'
import { useSettings } from '../composables/useSettings'
import { AppCard, AppButton, TextArea, TextField, PageHeader, FileUpload, DateField, MenuBoard, SignInModal } from '../components/ui'

const { user } = useUser()
const isGuest = computed(() => !user.value)
const showSignIn = ref(false)

const { createMenu } = useMenus()
const { showCalories, setShowCalories } = useSettings()

const menuDate = ref(todayInVN())
const title = computed(() => `Đặt cơm trưa ngày ${formatVNDate(menuDate.value)}`)
const note = ref('')
const imageFile = ref(null)
const imagePreview = ref(null)

const posting = ref(false)
const errorMsg = ref('')
const posted = ref(false)
const createdMenuId = ref(null)
const slackCopied   = ref(false)

function copySlackLink() {
  if (!createdMenuId.value) return
  const url = `${window.location.origin}/api/share?id=${createdMenuId.value}`
  navigator.clipboard.writeText(url).then(() => {
    slackCopied.value = true
    setTimeout(() => { slackCopied.value = false }, 2000)
  }).catch(() => {})
}

// OCR / AI State
const useOcr = ref(true)
const parsedDishes = ref(null)
const ocrNotes = ref('')
const statusMsg = ref('')
const displayStatusMsg = ref('')

// OCR Layout State
const showImage = ref(true)
const showCategories = ref(true)
const showLightbox = ref(false)

// Watch imageFile to automatically manage imagePreview URL for OCR reference
watch(imageFile, (newFile) => {
  if (imagePreview.value) {
    URL.revokeObjectURL(imagePreview.value)
    imagePreview.value = null
  }
  if (newFile) {
    imagePreview.value = URL.createObjectURL(newFile)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        sessionStorage.setItem('post_menu_image_base64', e.target.result)
        sessionStorage.setItem('post_menu_image_name', newFile.name)
      } catch (err) {
        console.error('Failed to save image to sessionStorage:', err)
      }
    }
    reader.readAsDataURL(newFile)
  } else {
    sessionStorage.removeItem('post_menu_image_base64')
    sessionStorage.removeItem('post_menu_image_name')
  }
})

function saveFormState() {
  try {
    sessionStorage.setItem('post_menu_date', menuDate.value || '')
    sessionStorage.setItem('post_menu_note', note.value || '')
    sessionStorage.setItem('post_menu_use_ocr', String(useOcr.value))
    sessionStorage.setItem('post_menu_ocr_notes', ocrNotes.value || '')
    if (parsedDishes.value) {
      sessionStorage.setItem('post_menu_parsed_dishes', JSON.stringify(parsedDishes.value))
    } else {
      sessionStorage.removeItem('post_menu_parsed_dishes')
    }
  } catch (e) {
    console.error('Failed to save post form state:', e)
  }
}

function restoreFormState() {
  try {
    const savedDate = sessionStorage.getItem('post_menu_date')
    if (savedDate) menuDate.value = savedDate

    const savedNote = sessionStorage.getItem('post_menu_note')
    if (savedNote) note.value = savedNote

    const savedUseOcr = sessionStorage.getItem('post_menu_use_ocr')
    if (savedUseOcr) useOcr.value = savedUseOcr === 'true'

    const savedOcrNotes = sessionStorage.getItem('post_menu_ocr_notes')
    if (savedOcrNotes) ocrNotes.value = savedOcrNotes

    const savedParsed = sessionStorage.getItem('post_menu_parsed_dishes')
    if (savedParsed) parsedDishes.value = JSON.parse(savedParsed)

    const savedImageBase64 = sessionStorage.getItem('post_menu_image_base64')
    const savedImageName = sessionStorage.getItem('post_menu_image_name') || 'menu.png'
    if (savedImageBase64) {
      imageFile.value = dataURLtoFile(savedImageBase64, savedImageName)
    }
  } catch (e) {
    console.error('Failed to restore post form state:', e)
  }
}

function clearFormState() {
  try {
    sessionStorage.removeItem('post_menu_date')
    sessionStorage.removeItem('post_menu_note')
    sessionStorage.removeItem('post_menu_use_ocr')
    sessionStorage.removeItem('post_menu_ocr_notes')
    sessionStorage.removeItem('post_menu_parsed_dishes')
    sessionStorage.removeItem('post_menu_image_base64')
    sessionStorage.removeItem('post_menu_image_name')
  } catch (e) {}
}

function dataURLtoFile(dataurl, filename) {
  const arr = dataurl.split(',')
  const mime = arr[0].match(/:(.*?);/)[1]
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new File([u8arr], filename, { type: mime })
}

watch([menuDate, note, useOcr, ocrNotes, parsedDishes], () => {
  saveFormState()
}, { deep: true })

onMounted(restoreFormState)

function resetForm() {
  note.value = ''
  menuDate.value = todayInVN()
  imageFile.value = null
  parsedDishes.value = null
  ocrNotes.value = ''
  statusMsg.value = ''
  clearFormState()
}

function cancelPreview() {
  parsedDishes.value = null
}

async function submit() {
  if (isGuest.value) {
    showSignIn.value = true
    return
  }

  errorMsg.value = ''

  if (!imageFile.value && !note.value.trim() && parsedDishes.value === null) {
    errorMsg.value = 'Menu cần có ít nhất ảnh hoặc mô tả món ăn.'
    return
  }

  // If OCR is enabled and not yet processed
  if (imageFile.value && useOcr.value && parsedDishes.value === null) {
    posting.value = true
    try {
      statusMsg.value = 'Đang nén ảnh thực đơn...'
      const compressedBase64 = await compressImage(imageFile.value)

      statusMsg.value = 'AI đang quét món ăn (5-10 giây)...'
      const ocrPromise = extractStructuredMenu(compressedBase64)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('TIMEOUT')), 35000)
      })

      const dishes = await Promise.race([ocrPromise, timeoutPromise])

      if (!dishes || dishes.length === 0) {
        throw new Error('Ảnh tải lên không phải là thực đơn hoặc không có thông tin món ăn nào nhận diện được.')
      }

      parsedDishes.value = dishes
      statusMsg.value = ''
      posting.value = false
    } catch (err) {
      console.error(err)
      if (err.message === 'TIMEOUT') {
        errorMsg.value = 'Quá thời gian phản hồi từ Google AI Studio (35 giây). Vui lòng thử lại.'
      } else {
        errorMsg.value = `Lỗi trích xuất AI: ${err.message || err}. Bạn vẫn có thể bỏ chọn AI để đăng menu thủ công.`
      }
      statusMsg.value = ''
      posting.value = false
    }
    return
  }

  posting.value = true
  let finalNote = note.value.trim() || null

  // If parsedDishes exists, serialize it as JSON
  if (parsedDishes.value !== null) {
    const sanitizedDishes = parsedDishes.value.map(d => ({
      ...d,
      price: typeof d.price === 'number' ? d.price : (parseInt(String(d.price).replace(/[^0-9-]/g, ''), 10) || 0)
    }))
    finalNote = JSON.stringify({
      notes: ocrNotes.value.trim(),
      dishes: sanitizedDishes
    })
  }

  const { data: createdMenu, error } = await createMenu({
    title: title.value.trim(),
    menu_date: menuDate.value || todayInVN(),
    note: finalNote,
    imageFile: imageFile.value,
  })
  posting.value = false

  if (error) {
    errorMsg.value = 'Đăng menu không thành công. Kiểm tra kết nối rồi thử lại.'
    return
  }

  posted.value = true
  createdMenuId.value = createdMenu?.id ?? null
  // Pre-warm og-image so Vercel CDN caches it before user shares to Slack
  if (createdMenu?.id) fetch(`/api/og-image?id=${createdMenu.id}`).catch(() => {})
  resetForm()
}

function animateMenuBoard() {
  gsap.set(['.menu-board', '.ocr-image-panel', '.mb-group', '.mb-dish-row'], { clearProps: 'all' })
  gsap.from('.menu-board',    { opacity: 0, y: 35, scale: 0.98, duration: 0.65, ease: 'back.out(1.1)', clearProps: 'all' })
  gsap.from('.ocr-image-panel', { opacity: 0, x: -20, duration: 0.6, ease: 'power2.out', delay: 0.1, clearProps: 'all' })
  gsap.from('.mb-group',      { opacity: 0, y: 12, duration: 0.5, ease: 'power2.out', stagger: 0.05, delay: 0.2, clearProps: 'all' })
  gsap.from('.mb-dish-row',   { opacity: 0, x: -8, duration: 0.35, ease: 'power2.out', stagger: 0.012, delay: 0.3, clearProps: 'all' })
}

// Watch parsedDishes to trigger transition animation when it loads
watch(parsedDishes, (newVal, oldVal) => {
  if (newVal && !oldVal) {
    nextTick(() => animateMenuBoard())
  }
})

// Watch statusMsg to trigger fade transitions on the scanning screen
watch(statusMsg, (newVal) => {
  if (newVal) {
    gsap.to('.ocr-scan-status-text', {
      opacity: 0,
      y: -5,
      duration: 0.2,
      onComplete: () => {
        displayStatusMsg.value = newVal
        gsap.fromTo('.ocr-scan-status-text',
          { opacity: 0, y: 5 },
          { opacity: 1, y: 0, duration: 0.25 }
        )
      }
    })
  } else {
    displayStatusMsg.value = ''
  }
}, { immediate: true })
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Đăng cơm"
      title="Đăng menu hôm nay"
      sub="Đăng ảnh hoặc gõ mô tả món — mọi người sẽ đặt theo."
    />

    <AppCard>
      <div class="stack">

        <!-- Success state -->
        <template v-if="posted">
          <div class="stack-sm">
            <span class="badge badge--paid">Đã đăng ✓</span>
            <p class="meta">Menu của bạn đã được đăng thành công.</p>
          </div>
          <div class="row" style="flex-wrap: wrap; gap: 0.5rem;">
            <AppButton :to="'/'">Xem menu hôm nay</AppButton>
            <AppButton variant="ghost" @click="copySlackLink" :disabled="!createdMenuId">
              {{ slackCopied ? '✓ Đã copy!' : '📋 Copy link Slack' }}
            </AppButton>
            <AppButton variant="ghost" @click="posted = false; createdMenuId = null">Đăng thêm menu</AppButton>
          </div>
        </template>

        <!-- Form state -->
        <form v-else class="stack" @submit.prevent="submit" style="position: relative;" :class="{ 'form-posting': posting && useOcr && parsedDishes === null }">
          <!-- Normal Form State -->
          <template v-if="parsedDishes === null">
            <fieldset :disabled="posting" style="border: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 1rem; width: 100%;">
              <!-- Date -->
              <DateField v-model="menuDate" label="Ngày" />

              <!-- Title (auto-generated from date) -->
              <div class="field">
                <label>Tiêu đề</label>
                <p class="title-preview">{{ title }}</p>
              </div>

              <!-- Note / text menu -->
              <TextArea
                v-model="note"
                label="Mô tả món ăn"
                placeholder="Cơm tấm sườn bì chả — 45k&#10;Bún bò Huế — 40k&#10;..."
                hint="Gõ menu dạng text nếu không có ảnh, hoặc bổ sung thêm ảnh bên dưới."
                :rows="5"
              />

              <!-- Image upload -->
              <FileUpload
                v-model="imageFile"
                label="Ảnh thực đơn"
                hint="Kéo thả ảnh hoặc click để chọn thực đơn"
                :disabled="posting"
              />

              <!-- OCR Options Checkbox -->
              <div v-if="imageFile" class="ocr-checkbox-field">
                <div class="ocr-toggle-row">
                  <span class="ocr-toggle-label">Tự động trích xuất món bằng AI ✨</span>
                  <label class="switch">
                    <input v-model="useOcr" type="checkbox" />
                    <span class="slider"></span>
                  </label>
                </div>
                <div v-if="useOcr" class="ocr-provider-selector-row stack-sm" style="margin-top: 0.4rem;">
                  <div style="font-size: var(--fs-xs); color: var(--ink-soft); font-weight: 600;">
                    🚀 Model: Gemini 3.1 Flash Lite (Miễn phí)
                  </div>
                </div>
              </div>
            </fieldset>

            <!-- Validation error -->
            <p v-if="errorMsg" class="alert">{{ errorMsg }}</p>

            <div class="row">
              <AppButton type="submit" :loading="posting">
                <span v-if="posting && statusMsg">{{ statusMsg }}</span>
                <span v-else>{{ isGuest ? 'Đăng nhập để đăng menu' : 'Đăng menu' }}</span>
              </AppButton>
            </div>
          </template>

          <!-- OCR Preview & Edit State -->
          <template v-else>
            <div class="section-header" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
              <div>
                <h3 class="section-title">Xem trước & Hiệu chỉnh Thực đơn từ AI ✨</h3>
                <p class="meta">Vui lòng kiểm tra và sửa lại các món AI đã quét trước khi lưu chính thức.</p>
              </div>
              <div class="ocr-toggle-row" style="background: rgba(220, 180, 100, 0.05); border: 1px solid var(--line); padding: 0.35rem 0.75rem; border-radius: 20px; display: inline-flex; align-items: center; gap: 0.8rem; margin-bottom: 0.5rem;">
                 <div style="display: flex; align-items: center; gap: 0.35rem;">
                   <span style="font-size: var(--fs-xs); font-weight: 600; color: var(--primary-ink);">Hiện phân loại 📁</span>
                   <label class="switch" style="transform: scale(0.8); margin: 0; display: inline-block;">
                     <input v-model="showCategories" type="checkbox" />
                     <span class="slider"></span>
                   </label>
                 </div>
                 <div style="width: 1px; height: 16px; background: var(--line);"></div>
                 <div style="display: flex; align-items: center; gap: 0.35rem;">
                   <span style="font-size: var(--fs-xs); font-weight: 600; color: var(--primary-ink);">Chế độ Heo-thì 🥗</span>
                   <label class="switch" style="transform: scale(0.8); margin: 0; display: inline-block;">
                     <input :checked="showCalories" @change="setShowCalories($event.target.checked)" type="checkbox" />
                     <span class="slider"></span>
                   </label>
                 </div>
              </div>
            </div>

            <div class="ocr-split-container" :class="{ 'ocr-split--wide': showImage }">
              <!-- Left Column: Image for reference -->
              <div v-if="imagePreview && showImage" class="ocr-image-panel">
                <div class="ocr-image-card" @click="showLightbox = true" title="Nhấp để phóng to ảnh">
                  <img :src="imagePreview" alt="Ảnh thực đơn gốc" class="ocr-reference-img" />
                  <div class="ocr-image-zoom-overlay">
                    <span>Nhấp để phóng to</span>
                  </div>
                </div>
                <p class="ocr-image-tip">Bạn có thể đối chiếu trực tiếp với ảnh thực đơn gốc ở đây.</p>
              </div>

              <!-- Right Column: Edit form -->
              <div class="ocr-form-panel stack">
                <!-- Toolbar: chỉ còn nút ẩn/hiện ảnh -->
                <div v-if="imagePreview" class="ocr-toolbar">
                  <button type="button" class="ocr-toolbar-btn" @click="showImage = !showImage">
                    {{ showImage ? 'Ẩn ảnh đối chiếu' : 'Hiện ảnh đối chiếu' }}
                  </button>
                </div>

                <!-- Menu Board (shared component) -->
                <MenuBoard
                  mode="edit"
                  :dishes="parsedDishes ?? []"
                  :notes="ocrNotes"
                  :show-calories="showCalories"
                  :show-categories="showCategories"
                  @update:dishes="parsedDishes = $event"
                  @update:notes="ocrNotes = $event"
                />

                <!-- Validation error -->
                <p v-if="errorMsg" class="alert">{{ errorMsg }}</p>

                <div class="row" style="margin-top: 1rem;">
                  <AppButton type="submit" :loading="posting">
                    {{ isGuest ? 'Đăng nhập để đăng menu' : 'Xác nhận & Đăng menu' }}
                  </AppButton>
                  <AppButton type="button" variant="ghost" @click="cancelPreview">Quay lại</AppButton>
                </div>
              </div>
            </div>

            <!-- Fullscreen Lightbox Modal -->
            <div v-if="showLightbox" class="ocr-lightbox-modal" @click="showLightbox = false">
              <div class="ocr-lightbox-content" @click.stop>
                <img :src="imagePreview" alt="Thực đơn phóng to" class="ocr-lightbox-img" />
                <button type="button" class="ocr-lightbox-close" @click="showLightbox = false">✕</button>
              </div>
            </div>
          </template>

        </form>
      </div>
    </AppCard>
    <SignInModal v-if="showSignIn" @close="showSignIn = false" />
  </div>
</template>

<style scoped>
.title-preview {
  font-weight: 700;
  font-size: var(--fs-base);
  color: var(--ink);
}
/* Interactive focus glow for form fields */
:deep(.input), :deep(.textarea) {
  transition: all 0.25s ease-in-out;
}

:deep(.input:hover), :deep(.textarea:hover) {
  border-color: var(--primary-ink);
  background-color: var(--bg-tint);
}

:deep(.input:focus), :deep(.textarea:focus) {
  outline: none;
  border-color: var(--primary);
  background-color: #fff;
  box-shadow: 
    0 0 0 3px rgba(31, 110, 69, 0.12),
    0 4px 12px rgba(31, 110, 69, 0.04);
}

.ocr-checkbox-field {
  padding: 1.15rem;
  background: var(--card); /* Match card */
  border-radius: var(--radius-sm);
  border: 1px solid var(--line-strong);
  position: relative;
  box-shadow: var(--shadow);
  overflow: hidden;
  transition: border-color 0.25s, box-shadow 0.25s;
}

.ocr-checkbox-field:hover {
  border-color: var(--primary);
  box-shadow: 0 4px 15px -4px rgba(31, 110, 69, 0.1);
}

/* Sub-ticket teeth edge decoration for AI card */
.ocr-checkbox-field::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: radial-gradient(circle at 0px 4px, var(--bg) 1.5px, transparent 2px) 0 0 / 4px 8px repeat-y;
  opacity: 0.7;
}

/* Custom Toggle Switch */
.ocr-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.ocr-toggle-label {
  font-weight: 700;
  font-size: var(--fs-sm);
  color: var(--ink);
}

.switch {
  position: relative;
  display: inline-block;
  width: 42px;
  height: 22px;
  flex-shrink: 0;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background-color: var(--line-strong);
  transition: .3s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 22px;
  border: 1px solid var(--line);
}

.slider:before {
  position: absolute;
  content: "";
  height: 14px;
  width: 14px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .3s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(35, 39, 31, 0.2);
}

input:checked + .slider {
  background-color: var(--primary);
  border-color: var(--primary-ink);
}

input:focus + .slider {
  box-shadow: 0 0 1px var(--primary);
}

input:checked + .slider:before {
  transform: translateX(20px);
}

input:disabled + .slider {
  opacity: 0.5;
  cursor: not-allowed;
}
.alert-hint {
  color: var(--accent) !important;
  margin-top: 0.25rem;
  font-weight: 500;
}
.empty-dishes {
  padding: 2.5rem 1.5rem;
  text-align: center;
  color: var(--muted);
  border: 1px dashed var(--line);
  border-radius: var(--radius-sm);
  font-style: italic;
}

/* Global Container Width Animation when Preview is Active */
:global(.app-main) {
  transition: max-width 0.4s cubic-bezier(0.25, 0.8, 0.25, 1) !important;
}
:global(.app-main:has(.ocr-split--wide)) {
  max-width: 1180px !important;
}

/* 2-Column OCR Split Layout */
.ocr-split-container {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2.5rem;
  align-items: start;
  margin-top: 1rem;
  transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.ocr-split--wide {
  grid-template-columns: 380px 1fr;
}

.ocr-image-panel {
  position: sticky;
  top: 5.5rem; /* Frozen below the sticky app header */
  align-self: start;
  width: 100%;
  max-height: calc(100vh - 7rem); /* Completely visible in screen height */
  display: flex;
  flex-direction: column;
  animation: fadeIn 0.3s ease-out;
  z-index: 10;
}

.ocr-image-card {
  border-radius: var(--radius-sm);
  border: 1px solid var(--line-strong);
  overflow: hidden;
  background: var(--bg-tint);
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1;
  max-height: calc(100vh - 9rem);
  cursor: zoom-in;
  position: relative;
  box-shadow: var(--shadow);
  transition: transform 0.2s, box-shadow 0.2s;
}

.ocr-image-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lift);
}

.ocr-reference-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  display: block;
}

.ocr-image-zoom-overlay {
  position: absolute;
  inset: 0;
  background: rgba(35, 39, 31, 0.45);
  color: #fff;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: var(--fs-xs);
  font-weight: 600;
  opacity: 0;
  transition: opacity 0.2s ease;
  backdrop-filter: blur(1.5px);
  letter-spacing: 0.05em;
}

.ocr-image-card:hover .ocr-image-zoom-overlay {
  opacity: 1;
}

.ocr-image-tip {
  font-size: var(--fs-xs);
  color: var(--muted);
  text-align: center;
  margin-top: 0.5rem;
  font-style: italic;
}

.ocr-form-panel {
  display: flex;
  flex-direction: column;
  animation: fadeIn 0.4s ease-out;
}

/* Toolbar & Buttons */
.ocr-toolbar {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-bottom: 1.2rem;
  gap: 0.75rem;
}

.ocr-toolbar-btn {
  background: #fff;
  border: 1px solid #e2dac7;
  color: var(--ink-soft);
  padding: 0.5rem 1rem;
  border-radius: var(--radius-sm);
  font-size: var(--fs-xs);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 2px rgba(0,0,0,0.02);
}

.ocr-toolbar-btn:hover {
  background: var(--bg-tint);
  border-color: var(--line-strong);
  color: var(--primary-ink);
  transform: translateY(-1px);
}

.ocr-toolbar-btn:active {
  transform: translateY(0);
}

/* Premium Menu Board Aesthetic */
.ocr-menu-board {
  background: radial-gradient(circle at top left, #fffdfa 0%, #faf5e6 100%); /* Warm champagne paper */
  border: 1px solid #e2dac7;
  border-radius: 8px;
  padding: 3.5rem 3rem;
  box-shadow: 
    0 12px 35px -12px rgba(86, 81, 74, 0.18),
    0 2px 4px rgba(86, 81, 74, 0.03);
  position: relative;
  overflow: hidden;
}

/* Classic Double Frame border design */
.ocr-menu-board::after {
  content: '';
  position: absolute;
  inset: 12px;
  border: 1px solid rgba(140, 110, 51, 0.22);
  border-radius: 6px;
  pointer-events: none;
}

.ocr-menu-board::before {
  content: '';
  position: absolute;
  inset: 16px;
  border: 1px solid rgba(140, 110, 51, 0.09);
  border-radius: 4px;
  pointer-events: none;
}

.ocr-menu-header {
  text-align: center;
  margin-bottom: 2.5rem;
  position: relative;
  z-index: 2;
}

.ocr-menu-title-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.8rem;
  margin-bottom: 0.5rem;
}

.ocr-menu-title-line {
  height: 1px;
  width: 50px;
  background: linear-gradient(to right, transparent, rgba(140, 110, 51, 0.45), transparent);
}

.ocr-menu-title-ornament {
  font-size: 0.8rem;
  color: #be9a5b;
  user-select: none;
}

.ocr-menu-title {
  font-size: var(--fs-sm);
  font-weight: 700;
  letter-spacing: 0.3em;
  color: #8c6e33;
  margin: 0;
  text-transform: uppercase;
  text-shadow: 0 0 8px rgba(220, 180, 100, 0.15);
  animation: warmTitleGlow 4s infinite ease-in-out;
}

.ocr-menu-notes-container {
  display: flex;
  justify-content: center;
  min-height: 1.8rem;
}

.ocr-menu-notes-display {
  font-size: var(--fs-sm);
  color: var(--ink-soft);
  font-style: italic;
  padding: 0.15rem 0.5rem;
  border-bottom: 1px dashed transparent;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  transition: all 0.2s;
}

.ocr-menu-notes-display:hover {
  color: var(--primary);
  border-bottom-color: var(--primary);
}

.placeholder-text {
  color: var(--muted);
  font-style: italic;
}

/* Menu Content & Group sections */
.ocr-menu-body {
  position: relative;
  z-index: 2;
  gap: 2rem;
}

.ocr-menu-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.ocr-menu-group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(140, 110, 51, 0.15);
  padding-bottom: 0.45rem;
  margin-bottom: 0.4rem;
}

.ocr-menu-group-title {
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--primary-ink);
  letter-spacing: 0.02em;
  cursor: pointer;
  padding: 0.1rem 0;
  border-bottom: 1px dashed transparent;
  transition: all 0.2s;
  margin: 0;
  text-transform: uppercase;
}

.ocr-menu-group-title:hover {
  color: var(--primary);
  border-bottom-color: var(--primary);
}

.ocr-add-dish-btn {
  background: transparent;
  border: 1px solid rgba(140, 110, 51, 0.25);
  color: #8c6e33;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  transition: all 0.15s;
}

.ocr-add-dish-btn:hover {
  background: rgba(140, 110, 51, 0.08);
  border-color: #8c6e33;
  transform: translateY(-1px);
}

.ocr-add-dish-btn:active {
  transform: translateY(0);
}

.ocr-menu-group-dishes {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding-left: 0.25rem;
}

.ocr-dish-row-item {
  display: flex;
  align-items: baseline;
  position: relative;
  padding: 0.35rem 0.5rem;
  border-radius: var(--radius-sm);
  transition: background-color 0.15s ease;
}

.ocr-dish-row-item:hover {
  background-color: rgba(190, 154, 91, 0.05);
}

.ocr-dish-name-cell {
  flex: 0 1 auto;
  max-width: 70%;
  display: flex;
  align-items: center;
}

.ocr-dish-name-text {
  font-family: 'Be Vietnam Pro', system-ui, sans-serif;
  font-weight: 500;
  font-size: 0.95rem;
  color: var(--ink);
  cursor: pointer;
  border-bottom: 1px dashed transparent;
  transition: all 0.15s;
  line-height: 1.4;
}

.ocr-dish-row-item:hover .ocr-dish-name-text {
  color: var(--primary-ink);
}

.ocr-dish-dot-leader {
  flex: 1;
  height: 1px;
  border-bottom: 1px dashed rgba(140, 110, 51, 0.35);
  margin: 0 0.6rem;
  align-self: baseline;
}

.ocr-dish-price-cell {
  flex: 0 0 auto;
  text-align: right;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.ocr-dish-price-text {
  font-weight: 600;
  font-size: var(--fs-sm);
  color: var(--ink);
  font-family: var(--font);
  cursor: pointer;
  padding: 0.1rem 0.3rem;
  border-bottom: 1px dashed transparent;
  transition: all 0.15s;
}

.ocr-dish-row-item:hover .ocr-dish-price-text {
  color: var(--primary-ink);
}

.ocr-dish-delete-btn {
  position: absolute;
  right: -24px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font-size: 10px;
  opacity: 0;
  transition: all 0.2s ease;
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  z-index: 3;
}

.ocr-dish-row-item:hover .ocr-dish-delete-btn {
  opacity: 0.6;
}

.ocr-dish-row-item:hover .ocr-dish-delete-btn:hover {
  opacity: 1;
  color: var(--accent);
  background: var(--accent-soft);
}

/* Seamless Inline Edit Wrappers */
.ocr-inline-edit-wrap {
  display: inline-flex;
  align-items: center;
  width: 100%;
  animation: scaleUp 0.12s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.ocr-inline-input {
  background: transparent !important;
  border: none !important;
  border-bottom: 1px dashed var(--primary) !important;
  border-radius: 0 !important;
  padding: 0 !important;
  font-size: inherit !important;
  font-family: inherit !important;
  font-weight: inherit !important;
  color: inherit !important;
  height: auto !important;
  box-shadow: none !important;
  width: 100%;
  outline: none !important;
}

.ocr-inline-input:focus {
  border-bottom-color: #8c6e33 !important;
  box-shadow: none !important;
}

.price-edit {
  width: 80px;
}

.price-input {
  font-size: var(--fs-sm) !important;
  font-weight: 600;
  color: #8c6e33 !important;
  border-bottom-color: #8c6e33 !important;
  text-align: right;
}

.name-input {
  font-size: var(--fs-sm) !important;
  font-weight: 550;
  color: var(--primary-ink) !important;
}

.group-edit {
  width: auto;
  flex: 1;
  max-width: 240px;
}

.group-input {
  font-size: var(--fs-sm) !important;
  font-weight: 700;
  text-transform: uppercase;
  color: #8c6e33 !important;
  border-bottom-color: #8c6e33 !important;
}

.notes-edit {
  width: 100%;
  max-width: 320px;
}

.notes-input {
  font-size: var(--fs-sm) !important;
  font-style: italic;
  color: #8c6e33 !important;
  border-bottom-color: #8c6e33 !important;
  text-align: center;
}

/* Fullscreen Lightbox Modal */
.ocr-lightbox-modal {
  position: fixed;
  inset: 0;
  background: rgba(23, 25, 21, 0.85);
  backdrop-filter: blur(5px);
  z-index: 9999;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: zoom-out;
  animation: fadeIn 0.2s ease-out;
}

.ocr-lightbox-content {
  position: relative;
  max-width: 90%;
  max-height: 90%;
  display: flex;
  justify-content: center;
  align-items: center;
  animation: scaleUp 0.25s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.ocr-lightbox-img {
  max-width: 100%;
  max-height: 85vh;
  object-fit: contain;
  border-radius: var(--radius-sm);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}

.ocr-lightbox-close {
  position: absolute;
  top: -40px;
  right: 0;
  background: transparent;
  border: none;
  color: #fff;
  font-size: 1.8rem;
  cursor: pointer;
  padding: 0.5rem;
  line-height: 1;
  transition: transform 0.2s;
}

.ocr-lightbox-close:hover {
  transform: scale(1.1);
}

/* Animations */
@keyframes slideUpFade {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleUp {
  from {
    opacity: 0;
    transform: scale(0.97);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* AI Scanning Inline Overlay */
.ocr-inline-scanning-overlay {
  position: absolute;
  inset: 0;
  background: rgba(250, 246, 239, 0.85);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  animation: fadeIn 0.2s ease-out forwards;
}

.ocr-inline-status-card {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.85rem 1.25rem;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  max-width: 92%;
}

.ocr-inline-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(220, 180, 100, 0.2);
  border-top-color: #dcb464;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex: none;
}

.ocr-inline-text-wrap {
  display: flex;
  flex-direction: column;
  text-align: left;
}

.ocr-inline-title {
  font-weight: 700;
  font-size: var(--fs-sm);
  color: var(--primary-ink);
  margin: 0;
}

.ocr-inline-desc {
  font-size: var(--fs-xs);
  color: var(--ink-soft);
  margin-top: 0.15rem;
  line-height: 1.2;
}

.img-scanning {
  filter: blur(2.5px) brightness(0.9);
  transition: filter 0.3s ease;
}

.form-posting {
  opacity: 0.85;
  transition: opacity 0.3s ease;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Steam Lines Animation above THỰC ĐƠN */
/* Elegant warm text glow animation for THỰC ĐƠN */
@keyframes warmTitleGlow {
  0%, 100% {
    text-shadow: 0 0 8px rgba(220, 180, 100, 0.2), 0 0 2px rgba(220, 180, 100, 0.05);
    color: #8c6e33;
  }
  50% {
    text-shadow: 0 0 16px rgba(220, 180, 100, 0.65), 0 0 8px rgba(220, 180, 100, 0.25);
    color: #b08e49;
  }
}

/* Ornament gold pulse */
.ocr-menu-title-ornament {
  animation: pulseGold 2s infinite ease-in-out alternate;
  display: inline-block;
}

@keyframes pulseGold {
  0% { transform: scale(1); opacity: 0.7; }
  100% { transform: scale(1.25); opacity: 1; }
}

/* Responsive adjustments for 2-column layout */
@media (max-width: 850px) {
  .ocr-split-container {
    grid-template-columns: 1fr !important;
    gap: 1.5rem;
  }
  .ocr-image-panel {
    position: static;
    max-height: none;
  }
  .ocr-image-card {
    max-height: 320px;
  }
  .ocr-reference-img {
    max-height: 320px;
  }
  .ocr-dish-delete-btn {
    right: 4px;
    opacity: 1;
    background: var(--bg-tint);
    border: 1px solid var(--line);
  }
  .ocr-menu-board {
    padding: 2rem 1.5rem;
  }
}

/* Calorie Badges and Styling */
.ocr-dish-calo-badge {
  font-size: 0.75rem;
  background: var(--primary-soft);
  color: var(--primary);
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  margin-left: 0.5rem;
  cursor: pointer;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  transition: all 0.2s;
  border: 1px dashed rgba(31, 110, 69, 0.2);
}
.ocr-dish-calo-badge:hover {
  background: rgba(31, 110, 69, 0.15);
  border-color: rgba(31, 110, 69, 0.4);
}
.calo-input {
  text-align: center;
  font-weight: 600;
  color: var(--primary);
}
</style>

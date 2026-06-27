<script setup>
import { ref, watch, onUnmounted, nextTick } from 'vue'
import { gsap } from 'gsap'

const props = defineProps({
  modelValue: { type: Object, default: null }, // File object
  label: { type: String, default: 'Ảnh thực đơn' },
  hint: { type: String, default: 'Kéo thả ảnh hoặc click để chọn file' },
  accept: { type: String, default: 'image/*' },
  disabled: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])

const fileInput = ref(null)
const cardRef = ref(null)
const isDragOver = ref(false)
const previewUrl = ref(null)
const fileSizeStr = ref('')

// Glow settings
const glowOpacity = ref(0)

// Helper to format file size
function formatBytes(bytes, decimals = 2) {
  if (!bytes) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

// Watch modelValue to sync internal preview URL
watch(() => props.modelValue, (newFile) => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = null
  }
  
  if (newFile) {
    previewUrl.value = URL.createObjectURL(newFile)
    fileSizeStr.value = formatBytes(newFile.size)
    // Animate preview entry
    nextTick(() => {
      gsap.fromTo('.upload-preview-vertical', 
        { opacity: 0, scale: 0.95, y: 15 },
        { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: 'power3.out' }
      )
    })
  } else {
    fileSizeStr.value = ''
    if (fileInput.value) {
      fileInput.value.value = ''
    }
  }
}, { immediate: true })

onUnmounted(() => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }
})

// Trigger click on hidden input file
function triggerSelect() {
  if (props.disabled || props.modelValue) return
  fileInput.value.click()
}

function handleFileChange(e) {
  const file = e.target.files[0] || null
  if (file) {
    emit('update:modelValue', file)
  }
}

// Drag & Drop Handlers
function onDragOver(e) {
  if (props.disabled || props.modelValue) return
  isDragOver.value = true
}

function onDragLeave() {
  isDragOver.value = false
}

function onDrop(e) {
  if (props.disabled || props.modelValue) return
  isDragOver.value = false
  const file = e.dataTransfer.files[0] || null
  if (file && file.type.startsWith('image/')) {
    emit('update:modelValue', file)
  }
}

// 3D Tilt & Cursor Glow Interactions (GSAP)
function onMouseMove(e) {
  if (props.disabled || props.modelValue || !cardRef.value) return
  
  const card = cardRef.value
  const rect = card.getBoundingClientRect()
  
  // Calculate cursor offset relative to card center
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  
  const px = (x / rect.width) - 0.5
  const py = (y / rect.height) - 0.5
  
  // Update CSS custom properties for hover glow grid masking
  card.style.setProperty('--mouse-x', `${x}px`)
  card.style.setProperty('--mouse-y', `${y}px`)
  
  // Tilting calculations (max 10 degrees)
  const tiltX = -py * 10
  const tiltY = px * 10
  
  gsap.to(card, {
    rotateX: tiltX,
    rotateY: tiltY,
    transformPerspective: 1000,
    duration: 0.2,
    ease: 'power1.out'
  })
}

function onMouseEnter() {
  if (props.disabled || props.modelValue) return
  glowOpacity.value = 1
}

function onMouseLeave() {
  glowOpacity.value = 0
  if (!cardRef.value) return
  
  // Smoothly animate back to normal state
  gsap.to(cardRef.value, {
    rotateX: 0,
    rotateY: 0,
    duration: 0.5,
    ease: 'power2.out'
  })
}

function removeFile(e) {
  e.stopPropagation() // Prevent click from triggering dropzone select
  
  gsap.to('.upload-preview-vertical', {
    opacity: 0,
    scale: 0.95,
    y: 10,
    duration: 0.25,
    ease: 'power2.in',
    onComplete: () => {
      emit('update:modelValue', null)
    }
  })
}
</script>

<template>
  <div class="file-upload-field">
    <label v-if="label" class="file-upload-label">{{ label }}</label>
    
    <div class="file-upload-container">
      <!-- Animated Liquid Blobs Background -->
      <div class="liquid-blob liquid-blob-1"></div>
      <div class="liquid-blob liquid-blob-2"></div>

      <!-- Glassmorphism Card -->
      <div 
        ref="cardRef"
        class="file-upload-card liquid-glass-card"
        :class="{ 
          'drag-over': isDragOver, 
          'has-file': modelValue,
          'is-disabled': disabled 
        }"
        @click="triggerSelect"
        @dragover.prevent="onDragOver"
        @dragenter.prevent="onDragOver"
        @dragleave.prevent="onDragLeave"
        @drop.prevent="onDrop"
        @mousemove="onMouseMove"
        @mouseenter="onMouseEnter"
        @mouseleave="onMouseLeave"
      >
        <!-- Interactive Grid Pattern -->
        <div 
          v-if="!modelValue" 
          class="interactive-grid-mask"
          :style="{ '--glow-opacity': glowOpacity }"
        ></div>

        <!-- Laser Scanner / Radial Cursor Glow -->
        <div 
          v-if="!modelValue" 
          class="interactive-radial-glow"
          :style="{ '--glow-opacity': glowOpacity }"
        ></div>

        <!-- Hidden Input -->
        <input
          ref="fileInput"
          type="file"
          :accept="accept"
          style="display: none;"
          :disabled="disabled"
          @change="handleFileChange"
        />

        <!-- Content State: Empty Dropzone -->
        <div v-if="!modelValue" class="upload-dropzone-content">
          <div class="upload-icon-container">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="upload-icon">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
          </div>
          <p class="upload-primary-text">{{ hint }}</p>
          <p class="upload-secondary-text">Định dạng hỗ trợ: JPG, PNG, WEBP (Tối đa 5MB)</p>
        </div>

        <!-- Content State: Selected File Preview (Vertical Layout) -->
        <div v-else class="upload-preview-vertical" @click.stop>
          <!-- Large Image Preview -->
          <div class="preview-image-wrapper">
            <img :src="previewUrl" alt="Thực đơn xem trước" class="preview-large-image" />
            <!-- Inner glass gradient overlay for sleek transition -->
            <div class="preview-image-glass-gradient"></div>
          </div>
          
          <!-- Glassmorphism Toolbar below image -->
          <div class="preview-glass-toolbar">
            <div class="preview-info-wrap">
              <div class="preview-filename">{{ modelValue.name }}</div>
              <div class="preview-meta">
                <span class="preview-size">{{ fileSizeStr }}</span>
                <span class="preview-badge">Đã tải lên ✓</span>
              </div>
            </div>

            <button 
              type="button" 
              class="preview-remove-btn" 
              title="Xóa ảnh" 
              @click="removeFile"
              :disabled="disabled"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.file-upload-field {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  width: 100%;
}

.file-upload-label {
  font-weight: 600;
  font-size: var(--fs-sm);
  color: var(--ink-soft);
  margin-left: 2px;
}

/* Container for relative positioning of blobs and glass card */
.file-upload-container {
  position: relative;
  width: 100%;
  border-radius: var(--radius-lg);
  isolation: isolate;
  overflow: hidden;
}

/* --- Animated Liquid Blobs --- */
.liquid-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(40px);
  z-index: -1;
  opacity: 0.6;
  animation: blobFloat 12s infinite ease-in-out alternate;
  pointer-events: none;
}

.liquid-blob-1 {
  width: 160px;
  height: 160px;
  background: rgba(31, 110, 69, 0.45); /* Herbal Green */
  top: -20px;
  left: 10%;
  animation-delay: 0s;
}

.liquid-blob-2 {
  width: 140px;
  height: 140px;
  background: rgba(220, 160, 90, 0.4); /* Warm Champagne / Accent */
  bottom: -10px;
  right: 5%;
  animation-duration: 15s;
  animation-direction: alternate-reverse;
}

@keyframes blobFloat {
  0% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(30px, -20px) scale(1.1); }
  66% { transform: translate(-20px, 20px) scale(0.9); }
  100% { transform: translate(0, 0) scale(1); }
}

/* --- Liquid Glass Card --- */
.liquid-glass-card {
  position: relative;
  width: 100%;
  min-width: 0;
  min-height: 200px;
  border-radius: var(--radius-lg);
  
  /* Glassmorphism core properties */
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.7);
  box-shadow: 
    0 8px 32px -8px rgba(35, 39, 31, 0.08),
    inset 0 0 0 1px rgba(255, 255, 255, 0.4);
  
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 1.5rem;
  cursor: pointer;
  overflow: hidden;
  transition: 
    border-color 0.3s ease, 
    background-color 0.3s ease, 
    box-shadow 0.3s ease,
    transform 0.2s ease;
  transform-style: preserve-3d;
}

/* Hover & Active States for Empty Card */
.liquid-glass-card:hover:not(.has-file):not(.is-disabled) {
  border-color: rgba(31, 110, 69, 0.4); /* Primary subtle */
  background: rgba(255, 255, 255, 0.65);
  box-shadow: 
    0 12px 40px -12px rgba(31, 110, 69, 0.15),
    inset 0 0 0 1px rgba(255, 255, 255, 0.5);
}

.liquid-glass-card.drag-over:not(.is-disabled) {
  border-color: var(--primary);
  background: rgba(31, 110, 69, 0.08);
  box-shadow: 
    0 0 0 4px rgba(31, 110, 69, 0.1),
    0 12px 40px rgba(31, 110, 69, 0.2);
  transform: scale(1.02);
}

/* Selected File State */
.liquid-glass-card.has-file {
  cursor: default;
  padding: 0.6rem; /* Thin padding around the image for premium frame look */
  background: rgba(255, 255, 255, 0.35); /* Slightly more transparent to let blobs bleed through */
  transform-style: flat;
}

.liquid-glass-card.is-disabled {
  opacity: 0.6;
  cursor: not-allowed;
  pointer-events: none;
}

/* Interactive Grid Pattern Masked by Cursor Glow */
.interactive-grid-mask {
  position: absolute;
  inset: 0;
  background-image: 
    linear-gradient(to right, rgba(140, 110, 51, 0.08) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(140, 110, 51, 0.08) 1px, transparent 1px);
  background-size: 24px 24px;
  mask-image: radial-gradient(circle 140px at var(--mouse-x, 50%) var(--mouse-y, 50%), black 40%, transparent 100%);
  -webkit-mask-image: radial-gradient(circle 140px at var(--mouse-x, 50%) var(--mouse-y, 50%), black 40%, transparent 100%);
  opacity: var(--glow-opacity, 0);
  pointer-events: none;
  z-index: 1;
  transition: opacity 0.4s ease;
}

/* Cursor Glow Overlay */
.interactive-radial-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle 160px at var(--mouse-x, 50%) var(--mouse-y, 50%),
    rgba(31, 110, 69, 0.08) 0%,
    rgba(196, 154, 91, 0.04) 50%,
    transparent 100%
  );
  opacity: var(--glow-opacity, 0);
  pointer-events: none;
  z-index: 2;
  transition: opacity 0.4s ease;
}

/* Dropzone Inner Content */
.upload-dropzone-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.8rem;
  z-index: 3;
  transform: translateZ(25px); /* 3D pop effect */
  pointer-events: none;
  min-width: 0;
}

.upload-icon-container {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.9);
  display: grid;
  place-items: center;
  color: var(--primary);
  box-shadow: 0 4px 12px rgba(35, 39, 31, 0.06);
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.liquid-glass-card:hover .upload-icon-container {
  transform: translateY(-4px) scale(1.08);
  box-shadow: 0 8px 20px rgba(31, 110, 69, 0.15);
  background: #fff;
}

.upload-icon {
  width: 24px;
  height: 24px;
}

.upload-primary-text {
  font-size: var(--fs-base);
  font-weight: 700;
  color: var(--ink);
  margin: 0;
  text-shadow: 0 1px 2px rgba(255,255,255,0.8);
}

.upload-secondary-text {
  font-size: var(--fs-xs);
  color: var(--ink-soft);
  margin: 0;
}

/* --- Vertical Preview State --- */
.upload-preview-vertical {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  /* Remove flex constraints so image can dictate height */
  height: auto;
  border-radius: calc(var(--radius-lg) - 4px);
  overflow: hidden;
  position: relative;
  z-index: 5;
  background: var(--bg); /* Fallback base inside the glass */
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}

.preview-image-wrapper {
  width: 100%;
  min-width: 0;
  position: relative;
  /* Min height to look good, max height to not break page */
  min-height: 240px;
  max-height: 400px;
  display: flex;
  background: #f0ede6; /* slightly darker to show image bounds */
}

.preview-large-image {
  width: 100%;
  max-width: 100%;
  height: auto;
  max-height: 400px;
  object-fit: contain; /* Contain to show full menu clearly without cropping */
  object-position: center;
}

/* Inner shadow/gradient over image to blend with toolbar */
.preview-image-glass-gradient {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 40px;
  background: linear-gradient(to top, rgba(255, 255, 255, 0.9) 0%, transparent 100%);
  pointer-events: none;
}

.preview-glass-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-width: 0;
  padding: 0.85rem 1.25rem;
  background: rgba(255, 255, 255, 0.95);
  border-top: 1px solid var(--line);
  backdrop-filter: blur(10px);
}

.preview-info-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
  flex-grow: 1;
}

.preview-filename {
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: 1rem;
}

.preview-meta {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.preview-size {
  font-size: var(--fs-xs);
  color: var(--muted);
  font-weight: 500;
}

.preview-badge {
  font-size: 10px;
  font-weight: 700;
  color: var(--primary);
  background: var(--primary-soft);
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
}

.preview-remove-btn {
  background: #fff;
  border: 1px solid var(--line-strong);
  color: var(--accent); /* Chili red */
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(0,0,0,0.05);
}

.preview-remove-btn:hover {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
  transform: scale(1.1) rotate(90deg);
  box-shadow: 0 4px 12px rgba(217, 72, 15, 0.3); /* Accent shadow */
}

.preview-remove-btn:active {
  transform: scale(0.95);
}
</style>

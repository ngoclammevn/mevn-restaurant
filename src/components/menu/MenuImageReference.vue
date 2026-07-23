<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'

const props = defineProps({
  src: { type: String, default: '' },
  alt: { type: String, default: 'Ảnh menu gốc' },
})

const failed = ref(false)
const retryKey = ref(0)
const isZoomed = ref(false)
const triggerRef = ref(null)
const closeButtonRef = ref(null)

const imageSrc = computed(() => {
  if (!retryKey.value) return props.src

  const [path, hash] = props.src.split('#', 2)
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}menu-image-retry=${retryKey.value}${hash ? `#${hash}` : ''}`
})

function handleImageError() {
  failed.value = true
}

function retryImage() {
  retryKey.value += 1
  failed.value = false
}

function openZoom() {
  isZoomed.value = true
  window.addEventListener('keydown', handleEsc)
  nextTick(() => closeButtonRef.value?.focus())
}

function closeZoom() {
  if (!isZoomed.value) return
  isZoomed.value = false
  window.removeEventListener('keydown', handleEsc)
  nextTick(() => triggerRef.value?.focus())
}

function handleEsc(event) {
  if (event.key === 'Escape') closeZoom()
}

onBeforeUnmount(() => window.removeEventListener('keydown', handleEsc))
</script>

<template>
  <section v-if="src" class="menu-reference" aria-label="Ảnh menu gốc">
    <div v-if="failed" class="menu-reference__error" role="status">
      <p>Không tải được ảnh menu</p>
      <button type="button" class="menu-reference__retry" @click="retryImage">Thử tải lại ảnh</button>
    </div>

    <div v-else class="menu-reference__panel">
      <button
        ref="triggerRef"
        type="button"
        class="menu-reference__trigger"
        :aria-label="`Phóng to ${alt}`"
        @click="openZoom"
      >
        <img class="menu-reference__image" :src="imageSrc" :alt="alt" @error="handleImageError" />
      </button>
    </div>

    <div v-if="isZoomed" class="menu-reference__lightbox" role="presentation" @click.self="closeZoom">
      <section class="menu-reference__dialog" role="dialog" aria-modal="true" :aria-label="`Ảnh menu phóng to: ${alt}`">
        <button ref="closeButtonRef" type="button" class="menu-reference__close" aria-label="Đóng ảnh menu" @click="closeZoom">×</button>
        <img class="menu-reference__lightbox-image" :src="imageSrc" :alt="alt" @error="handleImageError" />
      </section>
    </div>
  </section>
</template>

<style scoped>
.menu-reference { min-width: 0; }
.menu-reference__panel { display: grid; place-items: center; padding: clamp(.75rem, 2vw, 1.5rem); border: 1px solid var(--line); border-radius: var(--radius-lg); background: var(--bg-tint); }
.menu-reference__trigger { display: block; max-width: 100%; padding: 0; border: 0; border-radius: var(--radius-md); background: transparent; cursor: zoom-in; }
.menu-reference__trigger:focus-visible { outline: 3px solid var(--primary); outline-offset: 4px; }
.menu-reference__image { display: block; width: auto; height: auto; max-width: 100%; max-height: min(55vh, 560px); margin: 0 auto; object-fit: contain; }
.menu-reference__error { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem; border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--bg-tint); color: var(--ink-soft); }
.menu-reference__error p { margin: 0; }
.menu-reference__retry, .menu-reference__close { border: 0; cursor: pointer; }
.menu-reference__retry { padding: .55rem .8rem; border-radius: var(--radius-sm); background: var(--card); color: var(--ink); font-weight: 700; box-shadow: var(--shadow-sm); }
.menu-reference__lightbox { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 1.5rem; background: rgba(24, 22, 18, .84); }
.menu-reference__dialog { position: relative; display: grid; place-items: center; max-width: 100%; max-height: 100%; }
.menu-reference__lightbox-image { display: block; max-width: min(92vw, 1200px); max-height: 88vh; object-fit: contain; border-radius: var(--radius-md); box-shadow: 0 24px 64px rgba(0, 0, 0, .4); }
.menu-reference__close { position: absolute; top: .65rem; right: .65rem; width: 2.5rem; height: 2.5rem; border-radius: 999px; background: rgba(0, 0, 0, .6); color: white; font-size: 1.5rem; line-height: 1; }

@media (max-width: 520px) {
  .menu-reference__error { align-items: flex-start; flex-direction: column; }
}
</style>

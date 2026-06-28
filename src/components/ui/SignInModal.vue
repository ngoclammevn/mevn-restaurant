<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { SignIn, useUser } from '@clerk/vue'

const emit = defineEmits(['close'])

const { isSignedIn } = useUser()

const redirectUrl = ref('')

function handleKeyDown(e) {
  if (e.key === 'Escape') {
    emit('close')
  }
}

// Watch isSignedIn state to auto-close modal on success
watch(isSignedIn, (signedIn) => {
  if (signedIn) {
    emit('close')
  }
})

onMounted(() => {
  redirectUrl.value = window.location.href
  window.addEventListener('keydown', handleKeyDown)
  document.body.style.overflow = 'hidden' // Lock scroll behind modal
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  document.body.style.overflow = '' // Restore scroll
})
</script>

<template>
  <div class="signin-overlay" @click.self="$emit('close')">
    <div class="signin-modal">
      <button class="signin-close-btn" @click="$emit('close')" aria-label="Đóng">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      <div class="signin-content">
        <SignIn oauth-flow="popup" :force-redirect-url="redirectUrl" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.signin-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  animation: fade-in 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.signin-modal {
  background: transparent;
  position: relative;
  animation: slide-up 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.signin-close-btn {
  position: absolute;
  top: -12px;
  right: -12px;
  z-index: 10000;
  background: var(--bg-paper, #ffffff);
  border: 1px solid var(--border-soft, rgba(148, 163, 184, 0.12));
  color: var(--ink-soft, #64748b);
  cursor: pointer;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 
    0 4px 6px -1px rgba(0, 0, 0, 0.08), 
    0 2px 4px -1px rgba(0, 0, 0, 0.04);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.signin-close-btn:hover {
  color: var(--ink, #0f172a);
  transform: scale(1.1) rotate(90deg);
  box-shadow: 
    0 10px 15px -3px rgba(0, 0, 0, 0.1), 
    0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

.signin-content {
  display: flex;
  align-items: center;
  justify-content: center;
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(24px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>

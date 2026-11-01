import { onMounted, onUnmounted, ref } from 'vue'
import { MASCOT_EGG_UNLOCKED_EVENT } from '../lib/mascot-events'

export function useMascotEggUnlockPulse() {
  const active = ref(false)
  let timer

  function showPulse() {
    active.value = true
    clearTimeout(timer)
    timer = setTimeout(() => {
      active.value = false
      timer = undefined
    }, 1500)
  }

  onMounted(() => window.addEventListener(MASCOT_EGG_UNLOCKED_EVENT, showPulse))
  onUnmounted(() => {
    window.removeEventListener(MASCOT_EGG_UNLOCKED_EVENT, showPulse)
    clearTimeout(timer)
  })

  return active
}

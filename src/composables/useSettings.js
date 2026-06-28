import { ref } from 'vue'

const showCalories = ref(localStorage.getItem('show_calories') === 'true')

export function useSettings() {
  function setShowCalories(val) {
    showCalories.value = !!val
    localStorage.setItem('show_calories', String(showCalories.value))
  }

  return { showCalories, setShowCalories }
}

<script setup>
import { TransitionPresets, useElementVisibility, useTransition } from '@vueuse/core'
import { computed, ref, watch, onMounted } from 'vue'

const props = withDefaults(defineProps(), {
  value: 0,
  direction: 'up',
  duration: 600,
  delay: 0,
  decimalPlaces: 0,
})

const spanRef = ref(null)
const transitionValue = ref(props.direction === 'down' ? props.value : 0)

const transitionOutput = useTransition(transitionValue, {
  delay: props.delay,
  duration: props.duration,
  transition: TransitionPresets.easeOutCubic,
})

const output = computed(() =>
  new Intl.NumberFormat('vi-VN').format(
    Number(transitionOutput.value.toFixed(props.decimalPlaces))
  )
)

const isInView = useElementVisibility(spanRef, { threshold: 0 })
const hasBeenInView = ref(false)

const stopWatcher = watch(isInView, (visible) => {
  if (visible && !hasBeenInView.value) {
    hasBeenInView.value = true
    transitionValue.value = props.direction === 'down' ? 0 : props.value
    stopWatcher()
  }
}, { immediate: true })

watch(() => props.value, (newVal) => {
  if (hasBeenInView.value) {
    transitionValue.value = props.direction === 'down' ? 0 : newVal
  }
})

onMounted(() => {
  setTimeout(() => {
    if (!hasBeenInView.value) {
      hasBeenInView.value = true
      transitionValue.value = props.direction === 'down' ? 0 : props.value
      if (typeof stopWatcher === 'function') stopWatcher()
    }
  }, 400)
})

</script>

<template>
  <span ref="spanRef" class="number-ticker">{{ output }}</span>
</template>

<style scoped>
.number-ticker {
  display: inline-block;
  font-variant-numeric: tabular-nums;
}
</style>

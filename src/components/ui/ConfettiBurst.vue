<script setup>
import confetti from 'canvas-confetti'

const props = withDefaults(defineProps(), {
  colors: () => ['#1f6e45', '#dcb464', '#4ade80', '#fbbf24', '#34d399'],
  particleCount: 80,
  spread: 70,
  origin: () => ({ x: 0.5, y: 0.6 }),
})

function fire(originOverride) {
  confetti({
    particleCount: props.particleCount,
    spread: props.spread,
    colors: props.colors,
    origin: originOverride ?? props.origin,
    zIndex: 9999,
  })
}

defineExpose({ fire })
</script>

<template>
  <span @click="fire()"><slot /></span>
</template>

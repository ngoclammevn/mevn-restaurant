<script setup>
import { Motion } from 'motion-v'

const props = withDefaults(defineProps(), {
  duration: 0.55,
  delay: 0,
  blur: '10px',
  y: 14,
})
</script>

<template>
  <Motion
    :initial="{ opacity: 0, filter: `blur(${props.blur})`, y: props.y }"
    :animate="{ opacity: 1, filter: 'blur(0px)', y: 0 }"
    :transition="{ duration: props.duration, delay: props.delay, ease: 'easeOut' }"
  >
    <slot />
  </Motion>
</template>

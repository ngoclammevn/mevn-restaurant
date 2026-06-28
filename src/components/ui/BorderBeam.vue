<script setup>
import { computed } from 'vue'

const props = withDefaults(defineProps(), {
  size: 140,
  duration: 10,
  borderWidth: 1.5,
  colorFrom: '#dcb464',
  colorTo: '#1f6e45',
  delay: 0,
})

const durationS = computed(() => `${props.duration}s`)
const delayS = computed(() => `-${props.delay}s`)
</script>

<template>
  <div class="border-beam" />
</template>

<style scoped>
.border-beam {
  pointer-events: none;
  position: absolute;
  inset: 0;
  border-radius: inherit;
  border: v-bind('`${props.borderWidth}px`') solid transparent;
  mask:
    linear-gradient(transparent, transparent),
    linear-gradient(white, white);
  mask-clip: padding-box, border-box;
  mask-composite: intersect;
}

.border-beam::after {
  content: '';
  position: absolute;
  aspect-ratio: 1;
  width: v-bind('`${props.size}px`');
  background: linear-gradient(to left, v-bind(colorFrom), v-bind(colorTo), transparent);
  offset-anchor: 90% 50%;
  offset-path: rect(0 auto auto 0 round v-bind('`${props.size}px`'));
  animation: border-beam v-bind(durationS) v-bind(delayS) linear infinite;
}

@keyframes border-beam {
  to { offset-distance: 100%; }
}
</style>

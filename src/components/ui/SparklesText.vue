<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  text: { type: String, required: true },
  count: { type: Number, default: 7 },
  colors: { type: Object, default: () => ({ first: '#f59e0b', second: '#fb923c' }) }
})

const sparkles = ref([])

function make() {
  return {
    id: Math.random().toString(36).slice(2),
    x: `${Math.random() * 100}%`,
    y: `${Math.random() * 100}%`,
    color: Math.random() > 0.5 ? props.colors.first : props.colors.second,
    delay: Math.random() * 1.8,
    scale: 0.4 + Math.random() * 0.9,
    ttl: 5 + Math.random() * 10
  }
}

function tick() {
  sparkles.value = sparkles.value.map(s =>
    s.ttl <= 0 ? make() : { ...s, ttl: s.ttl - 0.1 }
  )
}

let timer
onMounted(() => {
  sparkles.value = Array.from({ length: props.count }, make)
  timer = setInterval(tick, 100)
})
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <span class="sparkles-root">
    <svg
      v-for="s in sparkles"
      :key="s.id"
      class="sparkle"
      :style="{ left: s.x, top: s.y, '--d': `${s.delay}s`, '--sc': s.scale, '--c': s.color }"
      width="14" height="14" viewBox="0 0 21 21"
    >
      <path
        d="M9.83 0.84C10.06 0.22 10.95 0.22 11.17 0.84L11.86 2.72C12.4 4.19 12.39 6.39 13.5 7.5C14.61 8.61 16.81 8.6 18.28 9.14L20.16 9.83C20.79 10.06 20.79 10.94 20.16 11.17L18.28 11.86C16.81 12.4 14.61 12.39 13.5 13.5C12.39 14.61 12.4 16.81 11.86 18.28L11.17 20.16C10.95 20.79 10.06 20.79 9.83 20.16L9.14 18.28C8.6 16.81 8.61 14.61 7.5 13.5C6.39 12.39 4.19 12.4 2.72 11.86L0.84 11.17C0.22 10.94 0.22 10.06 0.84 9.83L2.72 9.14C4.19 8.6 6.39 8.61 7.5 7.5C8.61 6.39 8.6 4.19 9.14 2.72L9.83 0.84Z"
        :fill="s.color"
      />
    </svg>
    <span class="sparkles-text"><slot>{{ text }}</slot></span>
  </span>
</template>

<style scoped>
.sparkles-root {
  position: relative;
  display: inline-block;
}
.sparkle {
  position: absolute;
  pointer-events: none;
  z-index: 2;
  opacity: 0;
  animation: sparkle-pop 0.9s ease-out infinite;
  animation-delay: var(--d);
  transform: translate(-50%, -50%);
}
@keyframes sparkle-pop {
  0%   { opacity: 0; transform: translate(-50%, -50%) scale(0) rotate(75deg); }
  40%  { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(var(--sc)) rotate(150deg); }
}
.sparkles-text {
  position: relative;
  z-index: 1;
}
</style>

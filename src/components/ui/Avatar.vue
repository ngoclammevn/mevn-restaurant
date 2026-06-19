<script setup>
import { computed } from 'vue'

const props = defineProps({
  src: { type: String, default: '' },
  name: { type: String, default: '' },
  size: { type: [Number, String], default: null },
})

const initials = computed(() => {
  const n = (props.name || '').trim()
  if (!n) return '🙂'
  return n.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
})

const style = computed(() =>
  props.size ? { width: `${props.size}px`, height: `${props.size}px` } : {},
)
</script>

<template>
  <img v-if="src" :src="src" :alt="name" class="avatar" :style="style" />
  <span v-else class="avatar" :style="style" :title="name">{{ initials }}</span>
</template>

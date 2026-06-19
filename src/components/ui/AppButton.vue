<script setup>
import { computed } from 'vue'

const props = defineProps({
  variant: { type: String, default: 'primary' }, // primary | ghost | danger
  block: Boolean,
  size: { type: String, default: '' }, // '' | 'sm'
  loading: Boolean,
  disabled: Boolean,
  to: { type: [String, Object], default: null },
  type: { type: String, default: 'button' },
})

const cls = computed(() => [
  'btn',
  props.variant === 'ghost' && 'btn--ghost',
  props.variant === 'danger' && 'btn--danger',
  props.block && 'btn--block',
  props.size === 'sm' && 'btn--sm',
])
</script>

<template>
  <router-link v-if="to" :to="to" :class="cls"><slot /></router-link>
  <button v-else :class="cls" :type="type" :disabled="disabled || loading">
    <span v-if="loading" class="spinner" aria-hidden="true" />
    <slot />
  </button>
</template>

<script setup>
import AppButton from './AppButton.vue'
import EmptyState from './EmptyState.vue'

defineProps({
  description: { type: String, default: 'Đăng nhập để tiếp tục.' },
  icon: { type: String, default: '🔒' },
})
defineEmits(['sign-in'])
</script>

<template>
  <EmptyState
    title="Chưa đăng nhập"
    :description="description"
    :icon="icon"
  >
    <AppButton @click="$emit('sign-in')">Đăng nhập</AppButton>
  </EmptyState>
</template>

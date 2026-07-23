<script setup>
import AppButton from './AppButton.vue'
import EmptyState from './EmptyState.vue'
import Spinner from './Spinner.vue'

defineProps({
  loading: Boolean,
  loadingLabel: { type: String, default: 'Đang tải…' },
  error: { type: String, default: '' },
  empty: Boolean,
  emptyTitle: { type: String, default: 'Chưa có dữ liệu' },
  emptyDescription: { type: String, default: '' },
  emptyIcon: { type: String, default: '🍚' },
})
defineEmits(['retry'])
</script>

<template>
  <Spinner v-if="loading" :label="loadingLabel" />
  <div v-else-if="error" class="stack-sm" role="alert">
    <p class="alert">{{ error }}</p>
    <div>
      <AppButton variant="ghost" size="sm" @click="$emit('retry')">
        Thử lại
      </AppButton>
    </div>
  </div>
  <EmptyState
    v-else-if="empty"
    :title="emptyTitle"
    :description="emptyDescription"
    :icon="emptyIcon"
  >
    <slot name="empty-action" />
  </EmptyState>
  <slot v-else />
</template>

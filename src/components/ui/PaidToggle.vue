<script setup>
// Interactive self-tick for the order OWNER only. Emits the new
// desired paid state. RLS guarantees a user can only flip own orders.
defineProps({ paid: Boolean, loading: Boolean })
const emit = defineEmits(['toggle'])
</script>

<template>
  <button
    class="btn btn--sm"
    :class="{ 'btn--ghost': paid }"
    :disabled="loading"
    @click="emit('toggle', !paid)"
  >
    <span v-if="loading" class="spinner" aria-hidden="true" />
    {{ paid ? 'Bỏ đánh dấu đã trả' : 'Tôi đã chuyển khoản' }}
  </button>
</template>

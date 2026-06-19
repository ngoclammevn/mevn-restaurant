<script setup>
// Display-only payment status. The signature element: a rotated
// rubber stamp when paid, a quiet chili badge when not.
defineProps({ paid: Boolean })
</script>

<template>
  <span v-if="paid" class="stamp">✓ Đã trả</span>
  <span v-else class="badge badge--unpaid">● Chưa trả</span>
</template>

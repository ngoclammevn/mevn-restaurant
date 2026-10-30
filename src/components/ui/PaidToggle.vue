<script setup>
defineProps({ paid: Boolean, loading: Boolean })
const emit = defineEmits(['toggle'])
</script>
<template><button type="button" class="btn" :class="{ 'btn--ghost': paid }" :disabled="loading" :aria-busy="loading" @click="emit('toggle', !paid)"><span v-if="loading" class="spinner" aria-hidden="true" />{{ paid ? 'Bỏ đánh dấu đã trả' : 'Tôi đã chuyển tiền' }}</button></template>

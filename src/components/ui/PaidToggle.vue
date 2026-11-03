<script setup>
import AppButton from './AppButton.vue'
defineProps({ paid: Boolean, loading: Boolean })
const emit = defineEmits(['toggle'])
</script>
<template><AppButton :variant="paid ? 'ghost' : 'primary'" :loading="loading" @click="emit('toggle', !paid)">{{ paid ? 'Bỏ đánh dấu đã trả' : 'Tôi đã chuyển tiền' }}</AppButton></template>

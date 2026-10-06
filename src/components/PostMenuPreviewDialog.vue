<script setup>
import { formatVNDate } from '../lib/date'
import { AppDialog, AppButton } from './ui'
defineProps({ open:Boolean, restaurantName:String, menuDate:String, dishes:Array, note:String, imagePreview:String, posting:Boolean, errors:String })
const emit = defineEmits(['close','publish'])
const money = value => value == null ? 'Chưa có giá' : new Intl.NumberFormat('vi-VN').format(value) + 'đ'
</script>
<template><AppDialog :open="open" title="Xem lại menu" @close="emit('close')"><section class="stack"><div><h3 class="section-title">{{ restaurantName || 'Chưa ghi nhận quán' }}</h3><p class="meta">{{ formatVNDate(menuDate) }} · Bạn thu tiền cho menu này</p></div><div v-if="dishes !== null" class="stack-sm"><div v-for="(dish,index) in dishes" :key="index" class="row-wrap preview-dish"><strong>{{ dish.name }}</strong><span class="spacer">{{ money(dish.price) }}</span></div></div><img v-if="imagePreview" :src="imagePreview" alt="Ảnh thực đơn sẽ đăng" class="preview-image" /><p v-if="note" class="note">{{ note }}</p><p class="meta">Mọi người tự xác nhận đã trả. Bạn có thể chốt đơn trong Quản lý.</p><p v-if="errors" class="alert" role="alert">{{ errors }}</p></section><template #footer><AppButton variant="ghost" :disabled="posting" @click="emit('close')">Quay lại sửa</AppButton><AppButton :loading="posting" @click="emit('publish')">Đăng menu</AppButton></template></AppDialog></template>
<style scoped>.preview-dish{padding:.75rem 0;border-bottom:1px solid var(--line)}.preview-dish strong{overflow-wrap:anywhere}.preview-image{width:100%;max-height:300px;object-fit:contain}.note{white-space:pre-line;overflow-wrap:anywhere}</style>

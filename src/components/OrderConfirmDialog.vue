<script setup>
import { AppButton, AppDialog } from './ui'
defineProps({ open: Boolean, menu: Object, dishes: { type: Array, default: () => [] }, itemText: { type: String, default: '' }, note: { type: String, default: '' }, recipientName: { type: String, default: 'Tôi' }, total: { type: Number, default: null }, busy: Boolean, error: { type: String, default: '' }, editing: Boolean })
const emit = defineEmits(['close', 'confirm'])
</script>
<template>
  <AppDialog :open="open" :title="editing ? 'Xem lại thay đổi' : 'Xem lại đơn'" @close="!busy && emit('close')">
    <div class="stack confirm-order">
      <p class="meta">{{ menu?.restaurant?.name || menu?.title }} · Đặt cho {{ recipientName }}</p>
      <ul v-if="dishes.length" class="confirm-dishes"><li v-for="dish in dishes" :key="dish.id || dish.name"><strong>{{ dish.name }}</strong><span class="meta">{{ dish.price == null || dish.price === '' ? 'Chưa có giá' : `${Number(dish.price).toLocaleString('vi-VN')}đ` }}</span></li></ul>
      <p v-else class="order-lines">{{ itemText }}</p>
      <div v-if="note" class="stack-sm"><strong>Ghi chú</strong><p class="order-lines">{{ note }}</p></div>
      <div class="confirm-total"><strong>Tổng tiền</strong><strong>{{ total == null ? 'Chưa xác định' : `${Number(total).toLocaleString('vi-VN')}đ` }}</strong></div>
      <p v-if="total == null" class="meta">Xác nhận số tiền với người đăng menu.</p>
      <p class="meta">Người nhận đơn tự đánh dấu đã trả sau khi chuyển khoản.</p>
      <p v-if="error" class="alert" role="alert">{{ error }}</p>
    </div>
    <template #footer><AppButton variant="ghost" :disabled="busy" @click="emit('close')">Quay lại</AppButton><AppButton :loading="busy" @click="emit('confirm')">{{ editing ? 'Lưu thay đổi' : 'Đặt món' }}</AppButton></template>
  </AppDialog>
</template>
<style scoped>
.confirm-order { overflow-wrap:anywhere; }
.confirm-dishes { margin:0; padding:0; list-style:none; }
.confirm-dishes li,.confirm-total { display:flex; justify-content:space-between; gap:16px; padding:12px 0; border-bottom:1px solid var(--line); }
.confirm-dishes li strong { min-width:0; }.confirm-dishes li span { flex-shrink:0; }.confirm-total { border-top:1px solid var(--line); border-bottom:0; }
</style>

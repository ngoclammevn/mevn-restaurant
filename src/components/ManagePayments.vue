<script setup>
import { computed } from 'vue'
import { PaidStamp } from './ui'
import { managedOrderAmount } from '../lib/manage-summary'
const props = defineProps({ orders: { type: Array, default: () => [] }, menuNote: String, menu: Object, filter: { type: String, default: 'all' } })
const people = computed(() => {
  const groups = new Map()
  for (const order of props.orders.filter(o => props.filter === 'all' || (props.filter === 'paid' ? o.is_paid : !o.is_paid))) {
    if (!groups.has(order.user_id)) groups.set(order.user_id, { id: order.user_id, name: order.user?.full_name || 'Chưa đặt tên', orders: [] })
    groups.get(order.user_id).orders.push(order)
  }
  return [...groups.values()]
})
const money = value => value == null ? 'Chưa có giá' : new Intl.NumberFormat('vi-VN').format(value) + 'đ'
</script>
<template><section class="payment-list"><p v-if="!people.length" class="empty-payments">Không có đơn trong nhóm này.</p><article v-for="person in people" :key="person.id" class="payment-person"><div class="person-content"><strong>{{ person.name }}</strong><div v-for="order in person.orders" :key="order.id" class="person-order"><p class="order-lines">{{ order.item_text }}</p><p v-if="order.note" class="meta">{{ order.note }}</p></div></div><div class="person-end"><div v-for="order in person.orders" :key="order.id"><strong>{{ money(managedOrderAmount(menu || {note:menuNote},order)) }}</strong><PaidStamp :paid="order.is_paid" /></div></div></article><p class="payment-note">Người nhận đơn tự xác nhận đã trả. Bạn chỉ xem trạng thái.</p></section></template>
<style scoped>.payment-person{display:flex;justify-content:space-between;gap:15px;padding:17px 0;border-top:1px solid var(--line);align-items:flex-start}.payment-person:first-of-type{border-top:0}.person-content{min-width:0}.person-content>strong{font-size:15px}.person-content p{font-size:13px;margin:5px 0}.person-end{text-align:right;flex-shrink:0;display:grid;gap:16px}.person-end strong{display:block;font-size:15px;margin-bottom:5px}.person-end :deep(.badge){padding:4px 8px;border-radius:7px;font-size:11px}.order-lines{white-space:pre-line;overflow-wrap:anywhere}.payment-note{padding:14px 0;font-size:12px;color:var(--muted)}.empty-payments{padding:28px 12px;text-align:center;color:var(--muted)}@media(max-width:640px){.payment-person{gap:10px}.person-end strong{font-size:14px}}</style>

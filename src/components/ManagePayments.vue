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
<template><section class="stack-sm"><p class="meta">Mỗi người tự xác nhận đã trả trong đơn của mình.</p><p v-if="!people.length" class="meta">Chưa có đơn trong nhóm này.</p><article v-for="person in people" :key="person.id" class="payment-person"><h3>{{ person.name }}</h3><div v-for="order in person.orders" :key="order.id" class="row-wrap"><div><p class="order-lines">{{ order.item_text }}</p><p v-if="order.note" class="meta">{{ order.note }}</p><p class="meta">{{ money(managedOrderAmount(menu || {note:menuNote}, order)) }}</p></div><PaidStamp class="spacer" :paid="order.is_paid" /></div></article></section></template>
<style scoped>.payment-person{padding:1rem 0;border-top:1px solid var(--line)}h3{font-size:1rem;margin-bottom:.5rem}.order-lines{white-space:pre-line;overflow-wrap:anywhere}</style>

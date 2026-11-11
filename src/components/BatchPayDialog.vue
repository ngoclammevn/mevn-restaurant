<script setup>
import { ref, computed, watch } from 'vue'
import { useOrders } from '../composables/useOrders'
import { useAppPresence } from '../composables/useAppPresence'
import { batchSummary } from '../lib/batch-pay'
import { formatVNDate } from '../lib/date'
import { AppDialog, PaymentQRModal } from './ui'
// group: một nhóm từ batchGroups() — các đơn chưa trả cho cùng một người đăng menu.
const props = defineProps({ group: { type: Object, default: null } })
const emit = defineEmits(['close', 'changed'])
const { togglePaid } = useOrders()
const { notifyOrderChanged } = useAppPresence()
const selected = ref(new Set()), loading = ref(false), error = ref('')
// Chỉ đặt lại lựa chọn khi mở cho người nhận khác; danh sách tải lại giữa chừng không xoá lựa chọn và lỗi.
watch(() => props.group?.posterId, () => { selected.value = new Set(props.group?.priced.map(entry => entry.order.id)); error.value = '' }, { immediate: true })
const chosen = computed(() => props.group?.priced.filter(entry => selected.value.has(entry.order.id)) ?? [])
const summary = computed(() => chosen.value.length ? batchSummary(chosen.value) : null)
const first = computed(() => chosen.value[0]?.order)
const money = value => `${new Intl.NumberFormat('vi-VN').format(value)} đ`
function toggle(id) {
  const next = new Set(selected.value)
  if (!next.delete(id)) next.add(id)
  selected.value = next
}
async function paid() {
  if (loading.value || !chosen.value.length) return
  const entries = chosen.value
  loading.value = true; error.value = ''
  const results = await Promise.allSettled(entries.map(entry => togglePaid(entry.order.id, true)))
  const done = entries.filter((entry, index) => results[index].status === 'fulfilled' && !results[index].value.error)
  for (const { order } of done) { order.is_paid = true; order.paid_at = new Date().toISOString(); emit('changed', order) }
  for (const menuId of new Set(done.map(entry => entry.order.menu.id))) notifyOrderChanged(menuId)
  loading.value = false
  if (done.length === entries.length) emit('close')
  else error.value = `Đã cập nhật ${done.length}/${entries.length} đơn. Bấm lại để thử các đơn còn lại.`
}
</script>
<template>
  <AppDialog :open="!!group" :title="`Trả gộp cho ${group?.poster?.full_name || 'người đăng menu'}`" @close="!loading && emit('close')">
    <div v-if="group" class="batch-pay">
      <PaymentQRModal v-if="summary" inline :batch="summary" :order="{ id: `batch-${group.posterId}`, user_id: first.user_id, is_paid: false }" :poster="group.poster" :menu="first.menu" :menu-date="summary.to" :loading="loading" :error="error" @paid="paid" />
      <p v-else class="meta">Chọn ít nhất một đơn để trả.</p>
      <fieldset class="batch-pay-list">
        <legend>Đơn được gom</legend>
        <label v-for="entry in group.priced" :key="entry.order.id" class="batch-pay-row">
          <input type="checkbox" :checked="selected.has(entry.order.id)" :disabled="loading" @change="toggle(entry.order.id)" />
          <span><strong>{{ formatVNDate(entry.order.menu.menu_date) }}</strong><span class="meta">{{ entry.order.item_text.split('\n').join(' · ') }}</span></span>
          <span class="batch-pay-amount">{{ money(entry.amount) }}</span>
        </label>
        <p v-for="order in group.unpriced" :key="order.id" class="meta batch-pay-row">{{ formatVNDate(order.menu.menu_date) }}: chưa có giá, trả riêng sau.</p>
      </fieldset>
    </div>
  </AppDialog>
</template>
<style scoped>
.batch-pay { display:grid; gap:16px; min-width:0; }
.batch-pay-list { border:0; margin:0; padding:0; min-width:0; }
.batch-pay-list legend { font-size:17px; font-weight:650; padding:0; margin-bottom:4px; }
.batch-pay-row { display:flex; align-items:flex-start; gap:12px; padding:12px 0; border-top:1px solid var(--line); margin:0; min-width:0; }
.batch-pay-row input { width:22px; height:22px; margin:2px 0 0; flex:none; accent-color:var(--primary); }
.batch-pay-row>span:nth-child(2) { display:grid; flex:1; min-width:0; overflow-wrap:anywhere; }
.batch-pay-row .meta { font-size:14px; color:var(--ink-soft); }
.batch-pay-amount { flex:none; font-variant-numeric:tabular-nums; font-weight:600; }
</style>

<script setup>
import { computed } from 'vue'
const props = defineProps({ state: { type: Object, default: () => ({ status: 'pending' }) } })
defineEmits(['retry', 'resolve'])
const labels = { pending: 'Chưa gửi Slack', sending: 'Đang gửi Slack…', sent: 'Đã gửi Slack', retryable: 'Gửi Slack chưa thành công', unknown: 'Cần kiểm tra trên Slack', cancel_pending: 'Chưa hủy được lịch nhắc', cancelled: 'Đã xử lý' }
const label = computed(() => labels[props.state.status] || labels.pending)
</script>
<template>
  <div class="slack-status" role="status" aria-live="polite">
    <span>{{ label }}</span>
    <a v-if="state.slackUrl" :href="state.slackUrl" target="_blank" rel="noopener noreferrer">Mở Slack ↗</a>
    <button v-if="['retryable','cancel_pending','pending'].includes(state.status)" type="button" @click="$emit('retry')">Thử lại</button>
    <template v-if="state.status === 'unknown'">
      <p>Slack có thể đã nhận tin. Kiểm tra kênh trước khi chọn để tránh gửi trùng.</p>
      <button type="button" @click="$emit('resolve', 'sent')">Đã thấy tin</button>
      <button type="button" @click="$emit('resolve', 'not_sent')">Chưa thấy tin, cho phép gửi lại</button>
    </template>
  </div>
</template>
<style scoped>
.slack-status{display:flex;align-items:center;flex-wrap:wrap;gap:.5rem;font-size:.82rem;color:var(--text-secondary,#64748b)}.slack-status p{width:100%;margin:.2rem 0}.slack-status button,.slack-status a{color:var(--primary,#2563eb);font:inherit}.slack-status button{background:transparent;border:1px solid var(--border,#cbd5e1);border-radius:6px;padding:.3rem .5rem;cursor:pointer}
</style>

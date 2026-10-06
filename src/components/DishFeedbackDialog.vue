<script setup>
import { computed } from 'vue'
import { formatVNDate } from '../lib/date'
import { AppButton, AppDialog, Spinner } from './ui'
const props = defineProps({ open: Boolean, dish: Object, restaurant: Object, stats: Object, reviews: { type: Array, default: () => [] }, loading: Boolean, error: { type: String, default: '' } })
const emit = defineEmits(['close', 'retry'])
const labels = computed(() => {
  const counts = new Map()
  for (const review of props.reviews) for (const label of new Set(review.labels ?? [])) counts.set(label, (counts.get(label) || 0) + 1)
  return [...counts].sort((a,b) => b[1] - a[1]).slice(0, 8)
})
const stars = computed(() => [5,4,3,2,1].map(star => ({ star, count: props.reviews.filter(r => r.rating === star).length })))
</script>
<template>
  <AppDialog :open="open" :title="dish?.name || 'Đánh giá món'" @close="emit('close')">
    <div class="stack feedback-detail">
      <p class="meta">{{ restaurant?.name || 'Chưa ghi nhận quán' }}{{ restaurant?.branch ? ` · ${restaurant.branch}` : '' }}</p>
      <p v-if="stats?.rating_count"><strong class="feedback-score">{{ Number(stats.average_rating).toLocaleString('vi-VN', {maximumFractionDigits:1}) }} / 5</strong> · {{ stats.rating_count }} lượt đánh giá<span v-if="stats.reviewer_count" class="meta"> · {{ stats.reviewer_count }} người</span></p>
      <p v-else class="meta">Chưa có đánh giá</p>
      <Spinner v-if="loading" label="Đang tải đánh giá…" />
      <div v-else-if="error" class="stack-sm"><p class="alert" role="alert">{{ error }}</p><AppButton variant="ghost" @click="emit('retry')">Thử lại</AppButton></div>
      <template v-else-if="reviews.length">
        <section class="stack-sm"><h3 class="section-title">Phản hồi gần đây</h3><p class="meta">{{ reviews.length }} lượt gần nhất. Phân bố sao và cảm nhận bên dưới chỉ tính các lượt này.</p>
          <div v-for="entry in stars" :key="entry.star" class="feedback-star-row"><span>{{ entry.star }} sao</span><meter :value="entry.count" :max="Math.max(1,reviews.length)" min="0" :aria-label="`${entry.star} sao: ${entry.count} lượt gần đây`" /><span>{{ entry.count }}</span></div>
          <div v-if="labels.length" class="row-wrap"><span v-for="[label,count] in labels" :key="label" class="badge">{{ label }} · {{ count }}</span></div>
        </section>
        <section class="stack-sm"><h3 class="section-title">Chi tiết</h3><article v-for="review in reviews" :key="review.id" class="feedback-review stack-sm"><div class="row-wrap"><strong>{{ review.rating }} / 5 sao</strong><span class="meta spacer">{{ review.author_name || 'Thành viên' }}<span v-if="review.menu_date"> · {{ formatVNDate(review.menu_date) }}</span></span></div><div v-if="review.labels?.length" class="row-wrap"><span v-for="label in review.labels" :key="label" class="badge">{{ label }}</span></div><p v-if="review.note" class="order-lines">{{ review.note }}</p><p v-else class="meta">Không có ghi chú thêm</p></article></section>
      </template>
      <p v-else-if="!stats?.rating_count" class="meta">Cảm nhận của mọi người sẽ xuất hiện sau khi đánh giá món này.</p>
      <p v-else class="meta">Chưa tải được chi tiết của các đánh giá.</p>
    </div>
  </AppDialog>
</template>
<style scoped>
.feedback-detail { overflow-wrap:anywhere; }.feedback-score { font-size:1.5rem; }
.feedback-star-row { display:grid; grid-template-columns:48px minmax(0,1fr) 24px; gap:12px; align-items:center; font-size:var(--fs-xs); }
.feedback-star-row meter { width:100%; height:12px; }.feedback-review { padding:16px 0; border-bottom:1px solid var(--line); }
</style>

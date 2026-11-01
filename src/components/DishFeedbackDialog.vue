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
.feedback-detail{overflow-wrap:anywhere;gap:24px;font-size:16px;line-height:1.6}.feedback-detail .meta{font-size:14px;line-height:1.6}.feedback-detail .section-title{font-size:20px;font-weight:650;letter-spacing:-.02em}.feedback-score{font-size:32px;letter-spacing:-.03em;line-height:1.2;font-variant-numeric:tabular-nums}.feedback-star-row{display:grid;grid-template-columns:52px minmax(0,1fr) 32px;gap:12px;align-items:center;min-height:32px;font-size:14px}.feedback-star-row meter{width:100%;height:10px;appearance:none;border:0;border-radius:999px;overflow:hidden;background:var(--bg-tint)}.feedback-star-row meter::-webkit-meter-bar{background:var(--bg-tint);border:0;border-radius:999px}.feedback-star-row meter::-webkit-meter-optimum-value{background:var(--primary);border-radius:999px}.feedback-star-row meter::-moz-meter-bar{background:var(--primary);border-radius:999px}.feedback-detail .badge{font-size:14px;line-height:1.5;padding:8px 12px;border-radius:999px;white-space:normal;background:var(--bg-tint)}.feedback-review{padding:20px;background:var(--bg-tint);border-radius:20px;gap:12px}.feedback-review .badge{background:var(--card)}.feedback-review p{margin:0;font-size:16px;line-height:1.6}.feedback-review p.meta{font-size:14px}.feedback-review .order-lines{white-space:pre-line;overflow-wrap:anywhere}@media(max-width:480px){.feedback-review{padding:16px}.feedback-review .row-wrap{gap:8px}.feedback-review .spacer{margin-left:0;width:100%}}
</style>

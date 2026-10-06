<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useUser } from '@clerk/vue'
import { useAppPresence } from '../composables/useAppPresence'
import { useReviews } from '../composables/useReviews'
import { useFeedbackSuggestions } from '../composables/useFeedbackSuggestions'
import { reviewForItem } from '../lib/menu'
import { todayInVN } from '../lib/date'
import { fallbackLabels, feedbackSections, validateSuggestionLabels } from '../../shared/feedback'
import { AppButton, AppDialog } from './ui'
const props = defineProps({ order: { type: Object, required: true }, menu: { type: Object, required: true } })
const emit = defineEmits(['close', 'saved'])
const { user } = useUser()
const { saveReview, deleteReview } = useReviews()
const { suggest, cancel } = useFeedbackSuggestions()
const presence = useAppPresence()
const account = user.value?.id, orderId = props.order.id, menuId = props.menu.id
const editable = computed(() => props.order.user_id === user.value?.id && props.menu.menu_date <= todayInVN())
const panel = ref(null), activeIndex = ref(0), suggesting = ref(true), status = ref('')
const drafts = ref((props.order.order_items ?? []).map(item => {
  const review = reviewForItem(item)
  return { item, rating: review?.rating ?? null, labels: [...(review?.labels ?? [])], note: review?.note ?? '', options: validateSuggestionLabels([...(review?.labels ?? []), ...fallbackLabels(item.name_snapshot)]), pendingOptions: null, review, saving: false, error: '' }
}))
const activeDraft = computed(() => drafts.value[activeIndex.value])
const completed = computed(() => drafts.value.filter(d => d.review).length)
const ratingNames = ['Rất chưa hài lòng', 'Chưa hài lòng', 'Ổn', 'Hài lòng', 'Rất hài lòng']
function dirty(draft) { return draft.rating !== (draft.review?.rating ?? null) || draft.note.trim() !== (draft.review?.note ?? '') || [...draft.labels].sort().join('\n') !== [...(draft.review?.labels ?? [])].sort().join('\n') }
let alive = true
onMounted(async () => {
  if (!editable.value) { suggesting.value = false; return }
  const suggestions = await suggest(props.order, drafts.value.map(d => d.item))
  if (!alive || user.value?.id !== account || props.order.id !== orderId) return
  for (const draft of drafts.value) {
    const labels = suggestions.find(s => s.order_item_id === draft.item.id)?.labels ?? draft.options
    const options = validateSuggestionLabels([...draft.labels, ...labels])
    if (draft.labels.length) draft.pendingOptions = options
    else draft.options = options
  }
  suggesting.value = false
})
onUnmounted(() => { alive = false; cancel() })
watch([() => user.value?.id, () => props.order.id], () => { alive = false; cancel(); emit('close') })
function toggle(draft, label) {
  status.value = ''
  if (draft.labels.includes(label)) draft.labels = draft.labels.filter(l => l !== label)
  else if (draft.labels.length < 6) draft.labels.push(label)
  else status.value = 'Bạn đã chọn đủ 6 cảm nhận. Bỏ một lựa chọn để chọn cảm nhận khác.'
}
function moreOptions(draft) { draft.options = validateSuggestionLabels([...draft.labels, ...draft.pendingOptions]); draft.pendingOptions = null }
function activate(index) { if (!drafts.value.some(d => d.saving)) { activeIndex.value = index; status.value = ''; panel.value?.scrollTo({top:0}) } }
async function save(draft) {
  if (!alive || user.value?.id !== account || !editable.value || !draft.rating || drafts.value.some(d => d.saving)) return
  draft.saving = true; draft.error = ''
  try {
    const { data, error } = await saveReview({ order_item_id: draft.item.id, rating: draft.rating, labels: draft.labels, note: draft.note.trim() || null })
    if (error || !data) throw error || new Error('missing_review')
    if (!alive || user.value?.id !== account || props.order.id !== orderId || !editable.value) return
    draft.review = data; draft.item.review = data; presence.notifyOrderChanged(menuId); emit('saved')
    status.value = 'Đã lưu đánh giá của bạn.'
    if (activeIndex.value < drafts.value.length - 1) activeIndex.value++
  } catch { if (alive && user.value?.id === account) draft.error = 'Chưa lưu được đánh giá. Thử lại.' }
  finally { draft.saving = false }
}
async function clear(draft) {
  if (!alive || user.value?.id !== account || !editable.value || !draft.review || drafts.value.some(d => d.saving) || !confirm('Xóa đánh giá món này?')) return
  draft.saving = true; draft.error = ''
  try {
    const { error } = await deleteReview(draft.review.id)
    if (error) throw error
    if (!alive || user.value?.id !== account || props.order.id !== orderId || !editable.value) return
    draft.review = null; draft.item.review = null; draft.rating = null; draft.labels = []; draft.note = ''; presence.notifyOrderChanged(menuId); emit('saved')
  } catch { if (alive && user.value?.id === account) draft.error = 'Chưa xóa được đánh giá. Thử lại.' }
  finally { draft.saving = false }
}
function close() { if (drafts.value.some(d => d.saving)) return; if (drafts.value.some(dirty) && !confirm('Bạn có đánh giá chưa lưu. Đóng và bỏ các thay đổi này?')) return; emit('close') }
</script>
<template>
  <AppDialog open title="Đánh giá món" @close="close">
    <section ref="panel" class="review-dialog stack">
      <p class="meta">{{ menu.restaurant?.name || 'Quán chưa được ghi nhận' }} · {{ completed }}/{{ drafts.length }} món đã đánh giá</p>
      <p v-if="!editable" class="alert">Chỉ chủ đơn mới đánh giá được bữa ăn hôm nay hoặc trước đó.</p>
      <nav v-if="drafts.length > 1" class="review-tabs" aria-label="Chọn món để đánh giá"><button v-for="(draft,index) in drafts" :key="draft.item.id" type="button" :class="{active:index === activeIndex}" :aria-current="index === activeIndex ? 'step' : undefined" :disabled="drafts.some(d => d.saving)" @click="activate(index)">{{ index + 1 }}. {{ draft.item.name_snapshot }}{{ draft.review ? ' ✓' : '' }}</button></nav>
      <article v-for="draft in activeDraft ? [activeDraft] : []" :key="draft.item.id" class="review-item stack-sm">
        <span class="meta">Món {{ activeIndex + 1 }} / {{ drafts.length }}</span><h3>{{ draft.item.name_snapshot }}</h3>
        <p class="review-question">Bạn thấy món này thế nào?</p>
        <div class="row" role="group" :aria-label="`Chấm điểm ${draft.item.name_snapshot}`"><button v-for="star in 5" :key="star" type="button" class="star-button" :class="{ selected: draft.rating >= star }" :disabled="!editable || draft.saving" :aria-label="`${star} sao`" :aria-pressed="draft.rating === star" @click="draft.rating = star">★</button></div>
        <p class="rating-caption" aria-live="polite">{{ draft.rating ? `${draft.rating}/5 · ${ratingNames[draft.rating - 1]}` : 'Chạm vào sao để chấm điểm' }}</p>
        <div class="row-wrap"><h4>Điều gì đáng nhớ?</h4><span class="meta spacer">{{ draft.labels.length }}/6 đã chọn</span></div><p class="meta">Chọn những cảm nhận đúng với bữa ăn của bạn.</p>
        <div v-for="group in feedbackSections(draft.options)" :key="group.id" class="review-label-group"><p>{{ group.title }}</p><div class="row-wrap"><button v-for="label in group.labels" :key="label" type="button" class="label-chip" :class="{ selected: draft.labels.includes(label) }" :aria-pressed="draft.labels.includes(label)" :disabled="!editable || draft.saving" @click="toggle(draft, label)"><span v-if="draft.labels.includes(label)" aria-hidden="true">✓ </span>{{ label }}</button></div></div>
        <p v-if="suggesting" class="meta" role="status">Đang thêm cảm nhận sát món… Bạn vẫn có thể chọn ngay.</p><AppButton v-else-if="draft.pendingOptions" variant="ghost" size="sm" :disabled="draft.saving" @click="moreOptions(draft)">Xem thêm lựa chọn cho món này</AppButton>
        <label class="field review-note">Ghi chú thêm (tùy chọn)<textarea v-model="draft.note" class="textarea" maxlength="1000" :disabled="!editable || draft.saving" rows="3" placeholder="Bạn thích hoặc chưa thích điều gì ở món này?" /></label><span class="meta">{{ draft.note.length }}/1.000</span>
        <p v-if="draft.error" class="alert" role="alert">{{ draft.error }}</p>
        <div class="row-wrap review-actions"><AppButton :loading="draft.saving" :disabled="!editable || !draft.rating" @click="save(draft)">{{ activeIndex < drafts.length - 1 ? 'Lưu và món tiếp theo' : draft.review ? 'Cập nhật đánh giá' : 'Lưu đánh giá' }}</AppButton><AppButton v-if="activeIndex < drafts.length - 1" variant="ghost" :disabled="drafts.some(d => d.saving)" @click="activate(activeIndex + 1)">Món tiếp theo</AppButton><AppButton v-if="draft.review" variant="ghost" :disabled="!editable || draft.saving" @click="clear(draft)">Xóa đánh giá</AppButton><span v-if="draft.review" class="meta">Đã lưu</span></div>
      </article>
      <p class="meta" role="status">{{ status }}</p>
      <p v-if="!drafts.length" class="meta">Đơn cũ chưa có từng món để đánh giá.</p>
    </section>
  </AppDialog>
</template>
<style scoped>
.review-dialog { min-width:0; overflow-wrap:anywhere; gap:18px; }.review-dialog > .meta:first-child { margin-top:-10px; font-size:12px; }.review-tabs { display:flex; gap:8px; flex-wrap:wrap; margin:0; padding:0; }.review-tabs button { max-width:100%; min-height:44px; padding:9px 13px; border:1px solid var(--line-strong); border-radius:11px; background:var(--card); font-size:13px; cursor:pointer; }.review-tabs button.active { background:#f2f3ef; color:#35412e; border-color:#d8dcd1; }.review-item { border:0; padding:0; gap:7px; }.review-item > .meta:first-child { display:none; }.review-item h3 { margin:0; font-size:17px; line-height:1.4; }.review-question { font-size:12px; font-weight:400; color:var(--ink-soft); margin-top:8px; }.review-item .star-button { min-width:48px; width:48px; min-height:44px; font-size:30px; padding:3px; border:0; border-radius:11px; background:transparent; color:#737f70; }.review-item .star-button.selected { color:#9a650c; background:#fff4d9; }.review-item > [role=group] { gap:7px; margin-top:9px; }.rating-caption { font-size:12px; color:var(--ink-soft); min-height:18px; }.review-item h4 { margin:12px 0 0; font-size:14px; font-weight:500; }.review-item h4 + .meta { font-size:12px; }.review-label-group { margin:12px 0 0; }.review-label-group > p { font-size:13px; color:var(--ink); font-weight:600; margin:0 0 8px; }.review-label-group .row-wrap { gap:8px; }.review-label-group .label-chip { min-height:44px; padding:8px 11px; border-radius:11px; font-size:13px; background:var(--card); border-color:var(--line-strong); }.review-label-group .label-chip.selected { background:var(--primary-soft); color:var(--primary-ink); border-color:var(--primary); }.review-note { margin:16px 0 0; font-size:14px; font-weight:600; }.review-note textarea { font-size:15px; border-radius:11px; }.review-note + .meta { font-size:12px; }.review-actions { padding-top:18px; margin-top:15px; border-top:1px solid var(--line); gap:9px; }.review-actions > .btn:first-child { margin-left:auto; order:2; }.review-actions > .btn:not(:first-child) { order:1; }.review-dialog button:focus-visible,.review-dialog textarea:focus-visible { outline:3px solid var(--primary); outline-offset:3px; }@media(max-width:640px) { .review-actions > .btn:first-child { flex:1; min-width:160px; }.review-tabs button { white-space:normal; text-align:left; }.review-label-group .label-chip { text-align:left; } }
</style>

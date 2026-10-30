<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useUser } from '@clerk/vue'
import { useCatalog } from '../composables/useCatalog'
import { useReviews } from '../composables/useReviews'
import { formatVNDate } from '../lib/date'
import { AppButton, PageHeader, Spinner, EmptyState, SignInModal } from '../components/ui'
const { user, isSignedIn } = useUser()
const { listRestaurants, listDishes } = useCatalog()
const { listRestaurantReviews } = useReviews()
const restaurants = ref([]), dishes = ref([]), reviews = ref([]), selected = ref(''), query = ref(''), loading = ref(false), error = ref(''), showSignIn = ref(false)
const filtered = computed(() => restaurants.value.filter(r => `${r.name} ${r.branch ?? ''}`.toLocaleLowerCase('vi').includes(query.value.toLocaleLowerCase('vi'))))
const restaurant = computed(() => restaurants.value.find(r => r.id === selected.value))
let listGeneration = 0, detailGeneration = 0
watch(() => user.value?.id, async () => {
  const current = ++listGeneration; detailGeneration++; restaurants.value = []; dishes.value = []; reviews.value = []; selected.value = ''; error.value = ''
  if (!isSignedIn.value) { loading.value = false; return }
  loading.value = true
  const result = await listRestaurants()
  if (current !== listGeneration) return
  if (result.error) error.value = 'Chưa tải được danh sách quán.'
  else { restaurants.value = result.data ?? []; selected.value = restaurants.value[0]?.id ?? '' }
  loading.value = false
}, { immediate: true })
watch(selected, async id => {
  const current = ++detailGeneration; dishes.value = []; reviews.value = []; error.value = ''
  if (!id || !isSignedIn.value) return
  loading.value = true
  const [dishResult, reviewResult] = await Promise.all([listDishes(id), listRestaurantReviews(id)])
  if (current !== detailGeneration) return
  if (dishResult.error || reviewResult.error) error.value = 'Một phần thông tin quán chưa tải được. Chọn lại quán để thử lại.'
  dishes.value = dishResult.data ?? []; reviews.value = reviewResult.data ?? []; loading.value = false
})
onUnmounted(() => { listGeneration++; detailGeneration++ })
function average(value) { return Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) }
</script>
<template><div class="stack"><PageHeader title="Quán và món" sub="Món ăn và đánh giá của nhóm." />
  <EmptyState v-if="!isSignedIn" title="Đăng nhập để xem quán và đánh giá"><AppButton @click="showSignIn = true">Đăng nhập</AppButton></EmptyState>
  <template v-else><label class="field">Tìm quán<input v-model="query" class="input" placeholder="Tên quán hoặc chi nhánh…" /></label><p v-if="error" class="alert">{{ error }}</p><div class="catalog-layout"><aside class="stack-sm"><button v-for="r in filtered" :key="r.id" type="button" class="restaurant-option" :class="{ active: selected === r.id }" :aria-pressed="selected === r.id" @click="selected = r.id"><strong>{{ r.name }}</strong><span v-if="r.branch" class="meta">{{ r.branch }}</span></button><EmptyState v-if="!loading && !filtered.length" title="Chưa tìm thấy quán" /></aside><section class="stack"><Spinner v-if="loading" /><template v-else-if="restaurant"><div><h2 class="section-title">{{ restaurant.name }}</h2><p class="meta">{{ restaurant.branch }}</p></div><div class="stack-sm"><h3 class="section-title">Món của quán</h3><article v-for="dish in dishes" :key="dish.id" class="card row-wrap"><div><strong>{{ dish.name }}</strong><p v-if="dish.variant" class="meta">{{ dish.variant }}</p></div><div class="spacer"><p v-if="dish.rating_count" class="rating-line">★ {{ average(dish.average_rating) }} <span class="meta">· {{ dish.rating_count }} đánh giá · {{ dish.reviewer_count }} người</span></p><p v-else class="meta">Chưa có đánh giá</p></div></article><p v-if="!dishes.length" class="meta">Chưa có món liên kết với quán này.</p></div><div class="stack-sm"><h3 class="section-title">Cảm nhận gần đây</h3><article v-for="review in reviews.slice(0, 20)" :key="review.id" class="card stack-sm"><div class="row-wrap"><strong>{{ review.item_name }}</strong><span class="rating-line">{{ '★'.repeat(review.rating) }}</span></div><p class="meta">{{ review.author_name }} · {{ formatVNDate(review.menu_date) }}</p><div class="row-wrap"><span v-for="label in review.labels" :key="label" class="badge">{{ label }}</span></div><p v-if="review.note" class="order-lines">{{ review.note }}</p></article><p v-if="!reviews.length" class="meta">Nhóm chưa đánh giá món ở quán này.</p></div></template></section></div></template><SignInModal v-if="showSignIn" @close="showSignIn = false" />
</div></template>

<style scoped>.restaurant-option.active { background:var(--card); border-color:var(--ink); box-shadow:inset 3px 0 var(--ink); }.restaurant-option { min-height:44px; }.rating-line { color:var(--ink); }</style>

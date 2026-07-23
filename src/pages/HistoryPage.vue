<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useUser } from '@clerk/vue'
import { useOrders } from '../composables/useOrders'
import { formatVNDate } from '../lib/date'
import {
  PageHeader,
  AsyncState,
  SignedOutState,
  AppButton,
  PaidStamp,
  SignInModal,
} from '../components/ui'

const { listMyOrders } = useOrders()
const { user, isLoaded, isSignedIn } = useUser()
const showSignIn = ref(false)

const loading = ref(true)
const errorMsg = ref('')
const orders = ref([])

onMounted(load)
watch(user, () => {
  load()
})

async function load() {
  if (!isLoaded.value || !isSignedIn.value) {
    loading.value = false
    orders.value = []
    return
  }
  loading.value = true
  errorMsg.value = ''
  const { data, error } = await listMyOrders()
  if (error) {
    errorMsg.value = 'Không thể tải lịch sử đơn. Kiểm tra kết nối rồi thử lại.'
  } else {
    orders.value = data ?? []
  }
  loading.value = false
}

// Count of orders the user still owes money for.
const unpaidCount = computed(() => orders.value.filter((o) => !o.is_paid).length)

// Group by menu.menu_date, descending (newest day first).
// Orders without a menu are skipped defensively.
const groupedByDay = computed(() => {
  const map = new Map()
  for (const order of orders.value) {
    const menuDate = order.menu?.menu_date
    if (!menuDate) continue // guard: skip orphaned orders
    if (!map.has(menuDate)) map.set(menuDate, [])
    map.get(menuDate).push(order)
  }
  // Convert to sorted array: newest date first
  return Array.from(map.entries())
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, dayOrders]) => ({ date, orders: dayOrders }))
})

// ---- Display Helpers ----
function formatPrice(value) {
  if (value === undefined || value === null) return ''
  return new Intl.NumberFormat('vi-VN').format(value) + 'đ'
}

function displayOrderNote(note) {
  if (!note) return ''
  try {
    const parsed = JSON.parse(note)
    if (parsed && typeof parsed === 'object') {
      return parsed.user_note || ''
    }
  } catch (e) {}
  return note
}

function displayOrderItemText(order) {
  let suffix = ''
  if (order.note) {
    try {
      const parsed = JSON.parse(order.note)
      if (parsed?.selected_dish?.price) {
        suffix = ` [${formatPrice(parsed.selected_dish.price)}]`
      }
    } catch (e) {}
  }
  return `${order.item_text}${suffix}`
}
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Lịch sử"
      title="Đơn của tôi"
      sub="Toàn bộ các đơn bạn đã đặt, mới nhất trước."
    />

    <SignedOutState
      v-if="isLoaded && !isSignedIn"
      description="Đăng nhập để xem lịch sử đặt cơm của bạn."
      @sign-in="showSignIn = true"
    />

    <AsyncState
      v-else
      :loading="!isLoaded || loading"
      loading-label="Đang tải đơn…"
      :error="errorMsg"
      :empty="groupedByDay.length === 0"
      empty-icon="🍱"
      empty-title="Bạn chưa đặt món nào"
      empty-description="Vào màn hình Hôm nay để đặt cơm trưa đầu tiên của bạn."
      @retry="load"
    >
      <template #empty-action>
        <AppButton :to="'/'">Đến Hôm nay</AppButton>
      </template>

    <div class="stack">
      <p v-if="unpaidCount > 0" class="unpaid-banner">
        Bạn còn {{ unpaidCount }} đơn chưa trả
      </p>
      <section
        v-for="group in groupedByDay"
        :key="group.date"
        class="stack-sm"
      >
        <!-- Day header -->
        <div class="day-header row">
          <span class="eyebrow">{{ formatVNDate(group.date) }}</span>
          <hr class="divider day-divider" />
        </div>

        <!-- Ticket per order -->
        <router-link
          v-for="order in group.orders"
          :key="order.id"
          :to="`/menu/${order.menu_id}`"
          class="ticket clickable-ticket"
        >
          <div class="stack-sm">
            <!-- Menu title + stamp -->
            <div class="row row-wrap">
              <span class="section-title order-menu-title">{{ order.menu?.title ?? '—' }}</span>
              <span class="spacer" />
              <PaidStamp :paid="order.is_paid" />
            </div>

            <!-- Item text -->
            <p class="order-item">{{ displayOrderItemText(order) }}</p>

            <!-- Optional note -->
            <p v-if="order.note" class="meta">{{ displayOrderNote(order.note) }}</p>
          </div>
        </router-link>
      </section>
    </div>
    </AsyncState>
    <SignInModal v-if="showSignIn" @close="showSignIn = false" />
  </div>
</template>

<style scoped>
.unpaid-banner {
  padding: 0.7rem 0.9rem;
  border-radius: var(--radius-sm);
  background: var(--bg-tint);
  color: var(--ink);
  font-size: var(--fs-sm);
  font-weight: 600;
}
.day-header {
  gap: 0.7rem;
  align-items: center;
  margin-top: 0.5rem;
}
.day-divider {
  flex: 1;
}
.order-menu-title {
  font-size: var(--fs-base);
}
.order-item {
  font-weight: 600;
  color: var(--ink);
  font-size: var(--fs-base);
}
.clickable-ticket {
  display: block;
  text-decoration: none;
  color: inherit;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}
.clickable-ticket:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lift);
  border-color: var(--line-strong);
}
</style>

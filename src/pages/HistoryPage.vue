<script setup>
import { ref, onMounted, computed } from 'vue'
import { useOrders } from '../composables/useOrders'
import { formatVNDate } from '../lib/date'
import {
  PageHeader,
  Spinner,
  EmptyState,
  AppButton,
  PaidStamp,
} from '../components/ui'

const { listMyOrders } = useOrders()

const loading = ref(true)
const errorMsg = ref('')
const orders = ref([])

onMounted(load)

async function load() {
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
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Lịch sử"
      title="Đơn của tôi"
      sub="Toàn bộ các đơn bạn đã đặt, mới nhất trước."
    />

    <Spinner v-if="loading" label="Đang tải đơn…" />

    <p v-else-if="errorMsg" class="alert">{{ errorMsg }}</p>

    <EmptyState
      v-else-if="groupedByDay.length === 0"
      icon="🍱"
      title="Bạn chưa đặt món nào"
      description="Vào màn hình Hôm nay để đặt cơm trưa đầu tiên của bạn."
    >
      <AppButton :to="'/'">Đến Hôm nay</AppButton>
    </EmptyState>

    <div v-else class="stack">
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
        <div
          v-for="order in group.orders"
          :key="order.id"
          class="ticket"
        >
          <div class="stack-sm">
            <!-- Menu title + stamp -->
            <div class="row row-wrap">
              <span class="section-title order-menu-title">{{ order.menu?.title ?? '—' }}</span>
              <span class="spacer" />
              <PaidStamp :paid="order.is_paid" />
            </div>

            <!-- Item text -->
            <p class="order-item">{{ order.item_text }}</p>

            <!-- Optional note -->
            <p v-if="order.note" class="meta">{{ order.note }}</p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
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
</style>

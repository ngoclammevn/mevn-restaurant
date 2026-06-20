<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useUser } from '@clerk/vue'
import { useMenus } from '../composables/useMenus'
import { useOrders } from '../composables/useOrders'
import { todayInVN, formatVNDate } from '../lib/date'
import { autolink } from '../lib/autolink'
import {
  AppCard,
  AppButton,
  Avatar,
  TextField,
  PageHeader,
  EmptyState,
  PaidStamp,
  PaidToggle,
  Spinner,
} from '../components/ui'

const { user } = useUser()
const { listMenusByDate } = useMenus()
const { createOrder, togglePaid, listProfiles } = useOrders()

// Reactive current user id — Clerk may not be hydrated at setup time
const myId = computed(() => user.value?.id)

const todayStr = todayInVN()
const todayDisplay = formatVNDate(todayStr)

// ---- page state ----
const loading = ref(true)
const errorMsg = ref('')
const menus = ref([])
const profiles = ref([])

// Per-menu form drafts keyed by menu.id
// drafts[menuId] = { item_text, note, orderFor, submitting, submitError }
const drafts = reactive({})

// Per-order toggle loading and error keyed by order.id
const toggleLoading = reactive({})
const toggleError = reactive({})

function initDraft(menuId) {
  if (!drafts[menuId]) {
    drafts[menuId] = { item_text: '', note: '', orderFor: '', submitting: false, submitError: '' }
  }
}

onMounted(load)

async function load() {
  loading.value = true
  errorMsg.value = ''
  const { data, error } = await listMenusByDate()
  if (error) {
    errorMsg.value = 'Không tải được menu hôm nay. Kiểm tra kết nối rồi thử lại.'
  } else {
    menus.value = data ?? []
    // Initialise drafts for each menu
    for (const m of menus.value) {
      initDraft(m.id)
    }
  }
  // Load people for the "order on behalf" picker; failure is non-blocking.
  const { data: profileData } = await listProfiles()
  profiles.value = profileData ?? []
  loading.value = false
}

async function submitOrder(menu) {
  const draft = drafts[menu.id]
  if (!draft || !draft.item_text.trim()) return
  draft.submitting = true
  draft.submitError = ''

  const { data, error } = await createOrder({
    menu_id: menu.id,
    item_text: draft.item_text.trim(),
    note: draft.note.trim() || null,
    user_id: draft.orderFor || null,
  })

  if (error) {
    draft.submitError = 'Đặt món không thành công. Thử lại nhé.'
  } else {
    // Resolve who the order is for, so the list renders immediately.
    const orderedFor = draft.orderFor
      ? profiles.value.find((p) => p.id === draft.orderFor)
      : null
    const newOrder = {
      ...data,
      user: orderedFor ?? {
        id: user.value?.id,
        full_name: user.value?.fullName ?? '',
        avatar_url: user.value?.imageUrl ?? '',
      },
    }
    menu.orders = [...(menu.orders ?? []), newOrder]
    draft.item_text = ''
    draft.note = ''
    draft.orderFor = ''
  }
  draft.submitting = false
}

async function handleToggle(menu, order, newVal) {
  toggleLoading[order.id] = true
  toggleError[order.id] = ''
  const { data, error } = await togglePaid(order.id, newVal)
  if (error) {
    toggleError[order.id] = 'Cập nhật trạng thái không thành công. Thử lại nhé.'
  } else if (data) {
    // Update the order in the local orders array
    const idx = menu.orders.findIndex((o) => o.id === order.id)
    if (idx !== -1) {
      menu.orders[idx] = { ...menu.orders[idx], is_paid: data.is_paid }
    }
  }
  toggleLoading[order.id] = false
}
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Hôm nay"
      :title="`Menu ngày ${todayDisplay}`"
      sub="Đặt món bằng cách gõ vào form bên dưới mỗi menu."
    />

    <!-- Loading -->
    <Spinner v-if="loading" />

    <!-- Load error -->
    <p v-else-if="errorMsg" class="alert">{{ errorMsg }}</p>

    <!-- Empty state -->
    <EmptyState
      v-else-if="menus.length === 0"
      title="Chưa có menu nào hôm nay"
      description="Bạn có thể đăng menu để mọi người đặt cơm."
      icon="🍱"
    >
      <AppButton :to="'/post'">Đăng cơm</AppButton>
    </EmptyState>

    <!-- Menu list -->
    <div v-else class="stack">
      <AppCard
        v-for="menu in menus"
        :key="menu.id"
        ticket
      >
        <div class="stack">
          <!-- Poster header -->
          <div class="row row-wrap">
            <Avatar
              :src="menu.poster?.avatar_url"
              :name="menu.poster?.full_name"
              :size="40"
            />
            <div>
              <div class="poster-name">{{ menu.poster?.full_name }}</div>
              <div class="meta">Người đăng</div>
            </div>
          </div>

          <!-- Payment info (shown only when set) -->
          <div v-if="menu.poster?.payment_info" class="payment-info-block">
            <span class="eyebrow">Thông tin chuyển khoản</span>
            <p class="payment-info">{{ menu.poster.payment_info }}</p>
          </div>

          <hr class="divider" />

          <!-- Menu title -->
          <h2 class="section-title">{{ menu.title }}</h2>

          <!-- Image or note -->
          <img
            v-if="menu.image_url"
            :src="menu.image_url"
            :alt="menu.title"
            class="menu-image"
          />
          <!-- eslint-disable-next-line vue/no-v-html -- autolink() escapes all input; only generated <a> tags are emitted -->
          <p v-else-if="menu.note" class="menu-note" v-html="autolink(menu.note)"></p>

          <!-- Orders list -->
          <div v-if="menu.orders && menu.orders.length > 0" class="stack-sm orders-section">
            <div class="eyebrow">Đơn đặt ({{ menu.orders.length }})</div>
            <div
              v-for="order in menu.orders"
              :key="order.id"
              class="order-row"
            >
              <div class="row row-wrap order-header">
                <Avatar
                  :src="order.user?.avatar_url"
                  :name="order.user?.full_name"
                  :size="32"
                />
                <span class="order-name">{{ order.user?.full_name }}</span>
                <span class="spacer" />
                <PaidStamp :paid="order.is_paid" />
              </div>
              <p class="order-item">{{ order.item_text }}</p>
              <p v-if="order.note" class="meta order-user-note">{{ order.note }}</p>

              <!-- Self-tick: only for own order -->
              <PaidToggle
                v-if="order.user_id === myId"
                :paid="order.is_paid"
                :loading="!!toggleLoading[order.id]"
                @toggle="(val) => handleToggle(menu, order, val)"
              />
              <p v-if="order.user_id === myId && toggleError[order.id]" class="alert">
                {{ toggleError[order.id] }}
              </p>
            </div>
          </div>

          <div v-else class="meta no-orders">Chưa có ai đặt món.</div>

          <hr class="divider" />

          <!-- Order form -->
          <form class="stack-sm" @submit.prevent="submitOrder(menu)">
            <div class="eyebrow">Đặt món</div>
            <div v-if="drafts[menu.id]" class="field">
              <label>Đặt cho</label>
              <select v-model="drafts[menu.id].orderFor" class="input">
                <option value="">Tôi (chính mình)</option>
                <option v-for="p in profiles" :key="p.id" :value="p.id">
                  {{ p.full_name }}
                </option>
              </select>
            </div>
            <TextField
              v-if="drafts[menu.id]"
              v-model="drafts[menu.id].item_text"
              label="Món bạn muốn đặt"
              placeholder="Ví dụ: cơm tấm sườn bì chả"
            />
            <TextField
              v-if="drafts[menu.id]"
              v-model="drafts[menu.id].note"
              label="Ghi chú (tuỳ chọn)"
              placeholder="Ví dụ: ít cay, không hành"
            />
            <p v-if="drafts[menu.id]?.submitError" class="alert">
              {{ drafts[menu.id].submitError }}
            </p>
            <AppButton
              type="submit"
              :loading="drafts[menu.id]?.submitting"
              :disabled="!drafts[menu.id]?.item_text?.trim()"
            >
              Đặt món
            </AppButton>
          </form>
        </div>
      </AppCard>
    </div>
  </div>
</template>

<style scoped>
.poster-name {
  font-weight: 700;
}

.payment-info-block {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  background: var(--bg-tint);
  border-radius: var(--radius-sm);
  padding: 0.65rem 0.8rem;
}

.payment-info {
  white-space: pre-line;
  font-size: var(--fs-sm);
  color: var(--ink-soft);
}

.menu-image {
  width: 100%;
  border-radius: var(--radius-sm);
  object-fit: cover;
  max-height: 260px;
}

.menu-note {
  white-space: pre-line;
  color: var(--ink-soft);
  font-size: var(--fs-sm);
}

.orders-section {
  background: var(--bg-tint);
  border-radius: var(--radius-sm);
  padding: 0.7rem 0.8rem;
}

.order-row {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding-bottom: 0.6rem;
  border-bottom: 1px solid var(--line);
}

.order-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.order-header {
  align-items: center;
}

.order-name {
  font-weight: 600;
  font-size: var(--fs-sm);
}

.order-item {
  font-size: var(--fs-sm);
  color: var(--ink);
  padding-left: 0.2rem;
}

.order-user-note {
  padding-left: 0.2rem;
}

.no-orders {
  padding: 0.4rem 0;
}
</style>

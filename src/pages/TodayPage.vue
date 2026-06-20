<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
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
const { listMenusByDate, deleteMenu } = useMenus()
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

const deletingMenus = reactive({})
const deleteErrors = reactive({})

async function confirmDeleteMenu(menu) {
  const message = menu.orders?.length > 0
    ? `Bạn có chắc chắn muốn xoá menu "${menu.title}"?\nThao tác này sẽ xoá toàn bộ ${menu.orders.length} đơn đặt món đi kèm!`
    : `Bạn có chắc chắn muốn xoá menu "${menu.title}"?`
    
  if (!confirm(message)) return

  deletingMenus[menu.id] = true
  deleteErrors[menu.id] = ''
  
  const { error } = await deleteMenu(menu.id, menu.image_url)
  if (error) {
    deleteErrors[menu.id] = 'Xoá menu không thành công. Thử lại nhé.'
    deletingMenus[menu.id] = false
  } else {
    menus.value = menus.value.filter((m) => m.id !== menu.id)
  }
}

const copiedMenuId = ref(null)

function copyMenuLink(menuId) {
  const url = `${window.location.origin}/menu/${menuId}`
  navigator.clipboard.writeText(url).then(() => {
    copiedMenuId.value = menuId
    setTimeout(() => {
      if (copiedMenuId.value === menuId) {
        copiedMenuId.value = null
      }
    }, 2000)
  }).catch((err) => {
    console.error('Failed to copy link: ', err)
  })
}

const zoomedImageUrl = ref(null)

function zoomImage(url) {
  zoomedImageUrl.value = url
  window.addEventListener('keydown', handleEsc)
}

function closeZoom() {
  zoomedImageUrl.value = null
  window.removeEventListener('keydown', handleEsc)
}

function handleEsc(e) {
  if (e.key === 'Escape') closeZoom()
}

onUnmounted(() => {
  window.removeEventListener('keydown', handleEsc)
})
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
            <span class="spacer" />
            <div class="row row-wrap" style="gap: 0.5rem;">
              <AppButton
                variant="ghost"
                size="sm"
                @click="copyMenuLink(menu.id)"
              >
                {{ copiedMenuId === menu.id ? 'Đã chép ✓' : 'Sao chép link' }}
              </AppButton>
              <AppButton
                v-if="menu.poster_id === myId"
                variant="danger"
                size="sm"
                :loading="!!deletingMenus[menu.id]"
                @click="confirmDeleteMenu(menu)"
              >
                Xoá Menu
              </AppButton>
            </div>
          </div>

          <p v-if="deleteErrors[menu.id]" class="alert">
            {{ deleteErrors[menu.id] }}
          </p>

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
            class="menu-image clickable"
            @click="zoomImage(menu.image_url)"
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

    <!-- Image Zoom Lightbox Overlay -->
    <div
      v-if="zoomedImageUrl"
      class="lightbox-overlay"
      @click="closeZoom"
    >
      <button class="lightbox-close" @click.stop="closeZoom">✕</button>
      <img
        :src="zoomedImageUrl"
        class="lightbox-image"
        @click.stop
      />
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

.menu-image.clickable {
  cursor: zoom-in;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.menu-image.clickable:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
}

.lightbox-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  cursor: zoom-out;
  animation: fadeIn 0.2s ease-out;
}

.lightbox-image {
  max-width: 90%;
  max-height: 90%;
  object-fit: contain;
  border-radius: var(--radius-md);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.5);
  cursor: default;
  animation: zoomIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.lightbox-close {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: white;
  font-size: 1.5rem;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s ease, transform 0.15s ease;
}

.lightbox-close:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: scale(1.05);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes zoomIn {
  from { transform: scale(0.9); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
</style>

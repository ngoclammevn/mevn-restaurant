<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useUser } from '@clerk/vue'
import { useMenus } from '../composables/useMenus'
import { useOrders } from '../composables/useOrders'
import { todayInVN, formatVNDate, formatVNTime } from '../lib/date'
import { autolink } from '../lib/autolink'
import {
  AppCard,
  AppButton,
  Avatar,
  TextField,
  TextArea,
  PageHeader,
  EmptyState,
  PaidStamp,
  PaidToggle,
  Spinner,
  MenuBoard,
  PaymentQRModal,
} from '../components/ui'

const { user } = useUser()
const { listMenusByDate, deleteMenu } = useMenus()
const { updateOrder, togglePaid } = useOrders()

// Reactive current user id — Clerk may not be hydrated at setup time
const myId = computed(() => user.value?.id)

const todayStr = todayInVN()
const todayDisplay = formatVNDate(todayStr)

// ---- page state ----
const loading = ref(true)
const errorMsg = ref('')
const menus = ref([])

// Per-order toggle loading and error keyed by order.id
const toggleLoading = reactive({})
const toggleError = reactive({})

const showQRModal = ref(false)
const selectedQROrder = ref(null)
const selectedQRMenu = ref(null)

function openQRModal(menu, order) {
  selectedQRMenu.value = menu
  selectedQROrder.value = order
  showQRModal.value = true
}

function handleQRModalPaid() {
  if (selectedQROrder.value && selectedQRMenu.value) {
    handleToggle(selectedQRMenu.value, selectedQROrder.value, true)
  }
  showQRModal.value = false
}

function hasQRConfig(poster) {
  if (!poster?.payment_info) return false
  return poster.payment_info.includes('STK:') || poster.payment_info.includes('Momo:')
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
  }
  loading.value = false
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

const editingOrderId = ref(null)
const editDraft = reactive({ item_text: '', note: '' })
const editSaving = ref(false)
const editError = ref('')

const deletingMenus = reactive({})
const deleteErrors = reactive({})

function startEdit(order) {
  editingOrderId.value = order.id
  editDraft.item_text = order.item_text
  editDraft.note = order.note ?? ''
  editError.value = ''
}

function cancelEdit() {
  editingOrderId.value = null
  editError.value = ''
}

async function saveEdit(menu, order) {
  if (!editDraft.item_text.trim()) return
  editSaving.value = true
  editError.value = ''
  const { data, error } = await updateOrder({
    id: order.id,
    item_text: editDraft.item_text.trim(),
    note: editDraft.note.trim() || null,
  })
  if (error) {
    editError.value = 'Lưu không thành công. Thử lại nhé.'
  } else if (data) {
    const idx = menu.orders.findIndex((o) => o.id === order.id)
    if (idx !== -1) {
      menu.orders[idx] = { ...menu.orders[idx], ...data }
    }
    editingOrderId.value = null
  }
  editSaving.value = false
}

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

// ── OCR helpers ──
function isStructured(note) {
  if (!note) return false
  try { const d = JSON.parse(note); return d && Array.isArray(d.dishes) } catch { return false }
}

const copiedMenuId = ref(null)

function copyMenuLink(menuId) {
  const url = `${window.location.origin}/share/${menuId}`
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
      sub="Xem ai đang đặt gì — click vào menu để chọn món."
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

          <!-- Image -->
          <img
            v-if="menu.image_url"
            :src="menu.image_url"
            :alt="menu.title"
            class="menu-image clickable"
            @click="zoomImage(menu.image_url)"
          />

          <!-- OCR board -->
          <MenuBoard
            v-if="isStructured(menu.note)"
            :note="menu.note"
          />

          <!-- Plain text note (khi không có OCR) -->
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
                <AppButton
                  v-if="order.user_id === myId && editingOrderId !== order.id"
                  variant="ghost"
                  size="sm"
                  @click="startEdit(order)"
                >
                  Sửa
                </AppButton>
                <PaidStamp :paid="order.is_paid" />
              </div>

              <!-- Edit inline form -->
              <template v-if="editingOrderId === order.id">
                <TextArea
                  v-model="editDraft.item_text"
                  label="Món bạn muốn đặt"
                  :rows="3"
                />
                <TextField
                  v-model="editDraft.note"
                  label="Ghi chú (tuỳ chọn)"
                />
                <p v-if="editError" class="alert">{{ editError }}</p>
                <div class="row" style="gap: 0.5rem;">
                  <AppButton
                    size="sm"
                    :loading="editSaving"
                    :disabled="!editDraft.item_text.trim()"
                    @click="saveEdit(menu, order)"
                  >
                    Lưu
                  </AppButton>
                  <AppButton variant="ghost" size="sm" @click="cancelEdit">
                    Huỷ
                  </AppButton>
                </div>
              </template>

              <!-- Display mode -->
              <template v-else>
                <p class="order-item" style="white-space: pre-wrap;">{{ order.item_text }}</p>
                <p v-if="order.note" class="meta order-user-note">{{ order.note }}</p>
                <p v-if="order.updated_at" class="meta order-edited-at">
                  đã sửa lúc {{ formatVNTime(order.updated_at) }}
                </p>
              </template>

              <!-- Self-tick: only for own order -->
              <div class="row row-wrap" style="gap: 0.5rem; align-items: center;">
                <PaidToggle
                  v-if="order.user_id === myId"
                  :paid="order.is_paid"
                  :loading="!!toggleLoading[order.id]"
                  @toggle="(val) => handleToggle(menu, order, val)"
                />
                <AppButton
                  v-if="order.user_id === myId && !order.is_paid && hasQRConfig(menu.poster)"
                  variant="ghost"
                  size="sm"
                  style="padding: 0.25rem 0.5rem;"
                  @click="openQRModal(menu, order)"
                >
                  🔗 Quét QR
                </AppButton>
              </div>
              <p v-if="order.user_id === myId && toggleError[order.id]" class="alert">
                {{ toggleError[order.id] }}
              </p>
            </div>
          </div>

          <div v-else class="meta no-orders">Chưa có ai đặt món.</div>

          <hr class="divider" />

          <AppButton :to="`/menu/${menu.id}`" size="sm">
            Vào chọn món →
          </AppButton>
        </div>
      </AppCard>
    </div>

    <PaymentQRModal
      v-if="showQRModal && selectedQROrder && selectedQRMenu"
      :order="selectedQROrder"
      :poster="selectedQRMenu.poster"
      :menu-date="selectedQRMenu.menu_date"
      :menu="selectedQRMenu"
      @close="showQRModal = false"
      @paid="handleQRModalPaid"
    />

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
  object-fit: contain;
  max-height: 480px;
  background: var(--bg-tint);
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

.order-edited-at {
  padding-left: 0.2rem;
  font-style: italic;
  font-size: var(--fs-xs, 0.75rem);
  color: var(--ink-faint, var(--ink-soft));
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

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUser } from '@clerk/vue'
import { useMenus } from '../composables/useMenus'
import { useOrders } from '../composables/useOrders'
import { formatVNDate } from '../lib/date'
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
import OcrHelper from '../components/OcrHelper.vue'

const route = useRoute()
const router = useRouter()
const { user } = useUser()
const { getMenu, deleteMenu } = useMenus()
const { createOrder, togglePaid, listProfiles } = useOrders()

const myId = computed(() => user.value?.id)

const loading = ref(true)
const errorMsg = ref('')
const menu = ref(null)
const profiles = ref([])

// Form draft
const draft = reactive({
  item_text: '',
  note: '',
  orderFor: '',
  submitting: false,
  submitError: ''
})

const toggleLoading = reactive({})
const toggleError = reactive({})
const deleting = ref(false)
const deleteError = ref('')
const copied = ref(false)

onMounted(load)

async function load() {
  loading.value = true
  errorMsg.value = ''
  
  const menuId = route.params.id
  if (!menuId) {
    errorMsg.value = 'Không tìm thấy ID của menu.'
    loading.value = false
    return
  }

  const { data, error } = await getMenu(menuId)
  if (error) {
    errorMsg.value = 'Không tải được chi tiết menu. Menu có thể không tồn tại hoặc đã bị xoá.'
  } else {
    menu.value = data
  }

  // Load profiles for ordering on behalf
  const { data: profileData } = await listProfiles()
  profiles.value = profileData ?? []
  loading.value = false
}

async function submitOrder() {
  if (!menu.value || !draft.item_text.trim()) return
  draft.submitting = true
  draft.submitError = ''

  const { data, error } = await createOrder({
    menu_id: menu.value.id,
    item_text: draft.item_text.trim(),
    note: draft.note.trim() || null,
    user_id: draft.orderFor || null,
  })

  if (error) {
    draft.submitError = 'Đặt món không thành công. Thử lại nhé.'
  } else {
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
    menu.value.orders = [...(menu.value.orders ?? []), newOrder]
    draft.item_text = ''
    draft.note = ''
    draft.orderFor = ''
  }
  draft.submitting = false
}

async function handleToggle(order, newVal) {
  toggleLoading[order.id] = true
  toggleError[order.id] = ''
  const { data, error } = await togglePaid(order.id, newVal)
  if (error) {
    toggleError[order.id] = 'Cập nhật trạng thái không thành công. Thử lại nhé.'
  } else if (data) {
    const idx = menu.value.orders.findIndex((o) => o.id === order.id)
    if (idx !== -1) {
      menu.value.orders[idx] = { ...menu.value.orders[idx], is_paid: data.is_paid }
    }
  }
  toggleLoading[order.id] = false
}

async function confirmDeleteMenu() {
  if (!menu.value) return
  const message = menu.value.orders?.length > 0
    ? `Bạn có chắc chắn muốn xoá menu "${menu.value.title}"?\nThao tác này sẽ xoá toàn bộ ${menu.value.orders.length} đơn đặt món đi kèm!`
    : `Bạn có chắc chắn muốn xoá menu "${menu.value.title}"?`
    
  if (!confirm(message)) return

  deleting.value = true
  deleteError.value = ''
  
  const { error } = await deleteMenu(menu.value.id, menu.value.image_url)
  if (error) {
    deleteError.value = 'Xoá menu không thành công. Thử lại nhé.'
    deleting.value = false
  } else {
    router.push('/')
  }
}

function copyMenuLink() {
  if (!menu.value) return
  const url = `${window.location.origin}/menu/${menu.value.id}`
  navigator.clipboard.writeText(url).then(() => {
    copied.value = true
    setTimeout(() => {
      copied.value = false
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
    <div style="margin-bottom: 1.5rem;">
      <router-link to="/" class="back-link">
        ← Quay lại trang Hôm nay
      </router-link>
    </div>

    <!-- Loading -->
    <Spinner v-if="loading" />

    <!-- Load error -->
    <div v-else-if="errorMsg">
      <EmptyState
        title="Không tìm thấy menu"
        :description="errorMsg"
        icon="🔍"
      >
        <AppButton :to="'/'">Quay lại Hôm nay</AppButton>
      </EmptyState>
    </div>

    <!-- Menu Detail -->
    <div v-else class="stack">
      <PageHeader
        eyebrow="Chi tiết menu"
        :title="menu.title"
        :sub="`Đăng ngày ${formatVNDate(menu.menu_date)}`"
      />

      <AppCard ticket>
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
                @click="copyMenuLink"
              >
                {{ copied ? 'Đã chép ✓' : 'Sao chép link' }}
              </AppButton>
              <AppButton
                v-if="menu.poster_id === myId"
                variant="danger"
                size="sm"
                :loading="deleting"
                @click="confirmDeleteMenu"
              >
                Xoá Menu
              </AppButton>
            </div>
          </div>

          <p v-if="deleteError" class="alert">
            {{ deleteError }}
          </p>

          <!-- Payment info (shown only when set) -->
          <div v-if="menu.poster?.payment_info" class="payment-info-block">
            <span class="eyebrow">Thông tin chuyển khoản</span>
            <p class="payment-info">{{ menu.poster.payment_info }}</p>
          </div>

          <hr class="divider" />

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
                @toggle="(val) => handleToggle(order, val)"
              />
              <p v-if="order.user_id === myId && toggleError[order.id]" class="alert">
                {{ toggleError[order.id] }}
              </p>
            </div>
          </div>

          <div v-else class="meta no-orders">Chưa có ai đặt món.</div>

          <hr class="divider" />

          <!-- Order form -->
          <form class="stack-sm" @submit.prevent="submitOrder">
            <div class="eyebrow">Đặt món</div>
            <div class="field">
              <label>Đặt cho</label>
              <select v-model="draft.orderFor" class="input">
                <option value="">Tôi (chính mình)</option>
                <option v-for="p in profiles" :key="p.id" :value="p.id">
                  {{ p.full_name }}
                </option>
              </select>
            </div>
            <OcrHelper
              v-if="menu.image_url"
              :image-url="menu.image_url"
              @select-meal="(mealName) => draft.item_text = mealName"
            />
            <TextField
              v-model="draft.item_text"
              label="Món bạn muốn đặt"
              placeholder="Ví dụ: cơm tấm sườn bì chả"
            />
            <TextField
              v-model="draft.note"
              label="Ghi chú (tuỳ chọn)"
              placeholder="Ví dụ: ít cay, không hành"
            />
            <p v-if="draft.submitError" class="alert">
              {{ draft.submitError }}
            </p>
            <AppButton
              type="submit"
              :loading="draft.submitting"
              :disabled="!draft.item_text.trim()"
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
.back-link {
  color: var(--primary);
  text-decoration: none;
  font-weight: 600;
  font-size: var(--fs-sm);
  display: inline-flex;
  align-items: center;
  transition: color 0.15s ease;
}
.back-link:hover {
  color: var(--primary-hover);
}

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

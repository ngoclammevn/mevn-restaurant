<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUser } from '@clerk/vue'
import { useMenus } from '../composables/useMenus'
import { useOrders } from '../composables/useOrders'
import { usePresence, getPersonColor } from '../composables/usePresence'
import { formatVNDate, formatVNTime } from '../lib/date'
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
  SparklesText,
  ConfettiBurst,
  SignInModal,
  PaymentQRModal,
} from '../components/ui'
const route = useRoute()
const router = useRouter()
const { user } = useUser()
const { getMenu, deleteMenu } = useMenus()
const { createOrder, updateOrder, togglePaid, listProfiles } = useOrders()
const { viewers, setActiveDish, setMyPicks, selfRemotePicks, myPresenceKey, onCartUpdated } = usePresence(route.params.id)
const confettiRef = ref(null)
const showSignIn = ref(false)

const myId = computed(() => user.value?.id)
const otherViewers = computed(() => viewers.value.filter(v => v.presenceKey !== myPresenceKey.value))
const gridRippling = ref(false)
watch(() => viewers.value.length, (newLen, oldLen) => {
  if (newLen > (oldLen ?? 0)) {
    gridRippling.value = true
    setTimeout(() => { gridRippling.value = false }, 1500)
  }
})
const isGuest = computed(() => !user.value)
const soloWords = 'Hãy rủ mọi người cùng ăn cơm nhé! 🍱'.split(' ')

const showQRModal = ref(false)
const selectedQROrder = ref(null)

function openQRModal(order) {
  selectedQROrder.value = order
  showQRModal.value = true
}

function handleQRModalPaid() {
  if (selectedQROrder.value) {
    handleToggle(selectedQROrder.value, true)
  }
  showQRModal.value = false
}

function hasQRConfig(poster) {
  if (!poster?.payment_info) return false
  return poster.payment_info.includes('STK:') || poster.payment_info.includes('Momo:')
}

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

const editingOrderId = ref(null)
const editDraft = reactive({ item_text: '', note: '' })
const editSaving = ref(false)
const editError = ref('')
const deleting = ref(false)
const deleteError = ref('')
const copied = ref(false)
const picks = reactive({})

function isStructured(note) {
  if (!note) return false
  try { const d = JSON.parse(note); return d && Array.isArray(d.dishes) } catch { return false }
}
function findDishByName(name, menuData) {
  if (!menuData?.note) return null
  try {
    const parsed = JSON.parse(menuData.note)
    return (parsed.dishes ?? []).find(d => d.name === name) ?? null
  } catch {}
  return null
}


function savePicksToLocal() {
  if (!menu.value) return
  try {
    localStorage.setItem(`picks_menu_${menu.value.id}`, JSON.stringify(Object.keys(picks)))
  } catch {}
}

function toggleDish(dish) {
  let action = 'add'
  if (picks[dish.name]) {
    delete picks[dish.name]
    action = 'remove'
  } else {
    picks[dish.name] = dish
    action = 'add'
    setActiveDish(dish.name)
  }
  draft.item_text = Object.values(picks).map(d => d.name).join('\n')
  setMyPicks(Object.keys(picks), action, dish.name)
  savePicksToLocal()
}

onMounted(() => {
  load()
})

function applyRemotePicks(remotePicks) {
  if (!remotePicks?.length || !menu.value) return
  let changed = false
  for (const name of remotePicks) {
    if (!picks[name]) {
      const dish = findDishByName(name, menu.value)
      if (dish) { picks[name] = dish; changed = true }
    }
  }
  if (changed) {
    draft.item_text = Object.values(picks).map(d => d.name).join('\n')
    setMyPicks(Object.keys(picks))
    savePicksToLocal()
  }
}

watch(selfRemotePicks, applyRemotePicks)
watch(menu, () => applyRemotePicks(selfRemotePicks.value))

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

  // Khôi phục giỏ hàng đã chọn từ localStorage
  if (menu.value) {
    try {
      const saved = localStorage.getItem(`picks_menu_${menu.value.id}`)
      if (saved) {
        const savedNames = JSON.parse(saved)
        savedNames.forEach(name => {
          const dish = findDishByName(name, menu.value)
          if (dish) picks[name] = dish
        })
        draft.item_text = Object.values(picks).map(d => d.name).join('\n')
        setMyPicks(Object.keys(picks))
      }
      
      const savedNote = sessionStorage.getItem(`draft_note_menu_${menu.value.id}`)
      if (savedNote) draft.note = savedNote

      const savedOrderFor = sessionStorage.getItem(`draft_orderFor_menu_${menu.value.id}`)
      if (savedOrderFor) draft.orderFor = savedOrderFor
    } catch (e) {
      console.error('Failed to restore picks:', e)
    }
  }

  watch(() => [draft.note, draft.orderFor], () => {
    if (!menu.value) return
    try {
      sessionStorage.setItem(`draft_note_menu_${menu.value.id}`, draft.note || '')
      sessionStorage.setItem(`draft_orderFor_menu_${menu.value.id}`, draft.orderFor || '')
    } catch (e) {}
  }, { deep: true })

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
    Object.keys(picks).forEach(k => delete picks[k])
    setMyPicks([])
    localStorage.removeItem(`picks_menu_${menu.value.id}`)
    try {
      sessionStorage.removeItem(`draft_note_menu_${menu.value.id}`)
      sessionStorage.removeItem(`draft_orderFor_menu_${menu.value.id}`)
    } catch (e) {}
    confettiRef.value?.fire()
  }
  draft.submitting = false
}

function handleFormSubmit() {
  if (isGuest.value) {
    showSignIn.value = true
  } else {
    submitOrder()
  }
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

async function saveEdit(order) {
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
    const idx = menu.value.orders.findIndex((o) => o.id === order.id)
    if (idx !== -1) {
      menu.value.orders[idx] = { ...menu.value.orders[idx], ...data }
    }
    editingOrderId.value = null
  }
  editSaving.value = false
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
  const url = `${window.location.origin}/share/${menu.value.id}`
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

          <!-- Image -->
          <img
            v-if="menu.image_url"
            :src="menu.image_url"
            :alt="menu.title"
            class="menu-image clickable"
            @click="zoomImage(menu.image_url)"
          />

          <!-- OCR board or plain note -->
          <MenuBoard
            v-if="isStructured(menu.note)"
            :note="menu.note"
            :picks="picks"
            :viewers="otherViewers"
            @toggle-dish="toggleDish"
            @hover-dish="setActiveDish"
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
                    @click="saveEdit(order)"
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
                  @toggle="(val) => handleToggle(order, val)"
                />
                <AppButton
                  v-if="order.user_id === myId && !order.is_paid && hasQRConfig(menu?.poster)"
                  variant="ghost"
                  size="sm"
                  style="padding: 0.25rem 0.5rem;"
                  @click="openQRModal(order)"
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

          <!-- Order form -->
          <form class="stack-sm" @submit.prevent="handleFormSubmit">
            <div class="eyebrow">Đặt món</div>
            <div v-if="!isGuest" class="field">
              <label>Đặt cho</label>
              <select v-model="draft.orderFor" class="input">
                <option value="">Tôi (chính mình)</option>
                <option v-for="p in profiles" :key="p.id" :value="p.id">
                  {{ p.full_name }}
                </option>
              </select>
            </div>
            <TextArea
              v-model="draft.item_text"
              label="Món bạn muốn đặt"
              placeholder="Ví dụ: cơm tấm sườn bì chả"
              :rows="3"
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
              {{ isGuest ? 'Đăng nhập để đặt món' : 'Đặt món' }}
            </AppButton>
          </form>
        </div>
      </AppCard>
    </div>

    <!-- Presence widget — mobile pill (hidden on desktop) -->
    <Transition name="presence">
      <div v-if="viewers.length >= 1" class="presence-pill" :class="{ 'presence-pill--solo': viewers.length === 1 }">
        <span class="presence-dot"></span>
        <template v-if="viewers.length === 1">
          <SparklesText text="Bạn là người đầu tiên ở đây! ✨" :count="6" />
        </template>
        <template v-else>
          <div class="presence-avs">
            <div v-for="(v, i) in otherViewers.slice(0, 4)" :key="v.deviceId || v.presenceKey"
              class="pav-wrap pav-wrap--sm" :style="{'--pc': v.color || 'var(--muted)', zIndex: 10 - i}">
              <div class="pav-ring">
                <Transition name="avatar-fade" mode="out-in">
                  <img v-if="v.avatar" :key="v.avatar" :src="v.avatar" />
                  <div v-else :key="v.emoji || v.name" class="pav-inner">{{ v.emoji ?? v.name?.[0] ?? '?' }}</div>
                </Transition>
              </div>
            </div>
          </div>
          <span class="presence-label"><b>{{ otherViewers.length }}</b> người khác đang xem</span>
        </template>
      </div>
    </Transition>

    <!-- Presence widget — desktop sidebar card (hidden on mobile) -->
    <Transition name="presence-card">
      <div v-if="otherViewers.length >= 1" class="presence-card">
        <div class="presence-card-grid" :class="{ 'presence-card-grid--ripple': gridRippling }"></div>
        <div class="presence-card-inner">
          <div class="pc-dot-row">
            <span class="presence-dot"></span>
          </div>
          <TransitionGroup name="viewer-morph" tag="div" class="presence-card-list">
            <div
              v-for="v in otherViewers.slice(0, 6)"
              :key="v.deviceId || v.presenceKey"
              class="presence-card-row"
            >
              <div class="pav-wrap pav-wrap--md" :style="{'--pc': v.color || 'var(--muted)'}">
                <div class="pav-ring">
                  <Transition name="avatar-fade" mode="out-in">
                    <img v-if="v.avatar" :key="v.avatar" :src="v.avatar" />
                    <div v-else :key="v.emoji || v.name" class="pav-inner">{{ v.emoji ?? v.name?.[0] ?? '?' }}</div>
                  </Transition>
                </div>
                <svg v-if="v.presenceKey === menu?.poster?.id" class="pav-chef" viewBox="0 0 28 24" xmlns="http://www.w3.org/2000/svg">
                  <ellipse cx="14" cy="11" rx="9" ry="10" fill="white"/>
                  <rect x="4" y="17" width="20" height="4.5" rx="2.2" fill="white"/>
                  <rect x="4" y="18.8" width="20" height="2" rx="1" fill="rgba(200,200,200,.45)"/>
                  <line x1="14" y1="3" x2="14" y2="17" stroke="rgba(220,220,220,.4)" stroke-width="1"/>
                </svg>
              </div>
              <Transition name="text-fade" mode="out-in">
                <span :key="v.name" class="presence-card-name" :class="{ 'presence-card-name--anon': v.isAnon }">{{ v.name }}</span>
              </Transition>
            </div>
          </TransitionGroup>
        </div>
      </div>
    </Transition>

    <!-- Desktop solo state — only when authenticated user is alone, desktop only -->
    <Transition name="presence-card">
      <div v-if="viewers.length >= 1 && otherViewers.length === 0" class="presence-card presence-card--solo">
        <div class="presence-card-grid"></div>
        <div class="presence-card-inner">
          <p class="pc-solo-text">
            <span
              v-for="(word, i) in soloWords"
              :key="i"
              class="tge-word"
              :style="{ animationDelay: `${150 + i * 90}ms` }"
            >{{ word }}</span>
          </p>
          <AppButton size="sm" class="pc-solo-btn" @click="copyMenuLink">
            {{ copied ? '✓ Đã chép!' : '🔗 Chia sẻ menu' }}
          </AppButton>
        </div>
      </div>
    </Transition>

    <ConfettiBurst ref="confettiRef" />

    <SignInModal v-if="showSignIn" @close="showSignIn = false" />

    <PaymentQRModal
      v-if="showQRModal && selectedQROrder"
      :order="selectedQROrder"
      :poster="menu.poster"
      :menu-date="menu.menu_date"
      :menu="menu"
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

.order-edited-at {
  padding-left: 0.2rem;
  font-style: italic;
  font-size: var(--fs-xs, 0.75rem);
  color: var(--ink-faint, var(--ink-soft));
}

.no-orders {
  padding: 0.4rem 0;
}

.guest-banner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1.5rem;
  background: var(--primary-soft);
  border: 1px solid rgba(31,110,69,0.2);
  border-radius: var(--radius-sm);
  text-align: center;
}

.guest-banner-text {
  font-size: var(--fs-sm);
  color: var(--primary-ink);
  font-weight: 600;
  margin: 0;
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

/* ── Presence: avatar ring ── */
.pav-wrap { position: relative; flex-shrink: 0; display: inline-flex; }
.pav-wrap--sm .pav-ring { width: 24px; height: 24px; padding: 1.5px; }
.pav-wrap--sm .pav-ring img, .pav-wrap--sm .pav-inner { width: 21px; height: 21px; font-size: 8px; }
.pav-wrap--md .pav-ring { width: 34px; height: 34px; padding: 2px; }
.pav-wrap--md .pav-ring img, .pav-wrap--md .pav-inner { width: 30px; height: 30px; font-size: 11px; }
.pav-ring { border-radius: 50%; background: var(--pc, var(--muted)); display: flex; align-items: center; justify-content: center; transition: background 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
.pav-ring img { border-radius: 50%; object-fit: cover; }
.pav-inner { border-radius: 50%; background: var(--pc, var(--muted)); display: flex; align-items: center; justify-content: center; font-weight: 800; color: #fff; overflow: hidden; transition: background 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
.pav-chef {
  position: absolute; top: -9px; right: -8px;
  width: 20px; height: 17px; z-index: 2;
  transform: rotate(15deg);
  filter: drop-shadow(0 1px 2px rgba(0,0,0,.5));
  pointer-events: none;
}

/* Live dot */
.presence-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--primary); box-shadow: 0 0 5px var(--primary);
  flex-shrink: 0; animation: pdot 2s ease-in-out infinite;
}
@keyframes pdot { 0%,100%{opacity:1} 50%{opacity:0.25} }

/* Mobile pill */
.presence-avs { display: flex; }
.presence-avs .pav-wrap { margin-left: -6px; }
.presence-avs .pav-wrap:first-child { margin-left: 0; }
.presence-pill {
  position: fixed; bottom: 5rem; left: 50%; transform: translateX(-50%);
  background: var(--card); border: 1px solid var(--line-strong);
  border-radius: var(--radius-pill); padding: 6px 14px 6px 9px;
  display: flex; align-items: center; gap: 8px;
  box-shadow: var(--shadow-lift); z-index: 60; white-space: nowrap;
}
.presence-pill--solo :deep(.sparkles-text) { font-size: var(--fs-sm); font-weight: 700; color: var(--gold); }
.presence-label { font-size: var(--fs-sm); color: var(--ink-soft); }
.presence-label b { color: var(--primary-ink); }
@media (min-width: 1080px) { .presence-pill { display: none; } }

/* Desktop sidebar */
.presence-card { display: none; }
@media (min-width: 1080px) {
  .presence-card {
    display: block; position: fixed; top: 80px; right: 40px;
    width: 210px; z-index: 60; overflow: clip;
  }
}
.presence-card-grid {
  position: absolute; inset: -24px; pointer-events: none; z-index: 0;
  background-image:
    linear-gradient(to right, var(--line-strong, rgba(0,0,0,.07)) 1px, transparent 1px),
    linear-gradient(to bottom, var(--line-strong, rgba(0,0,0,.07)) 1px, transparent 1px);
  background-size: 22px 22px;
  mask-image: radial-gradient(ellipse 70% 75% at 50% 50%, black 0%, transparent 70%);
  -webkit-mask-image: radial-gradient(ellipse 70% 75% at 50% 50%, black 0%, transparent 70%);
}
.presence-card-grid::after {
  content: '';
  position: absolute;
  inset: 24px;
  border-radius: inherit;
  background: radial-gradient(ellipse 60% 60% at 50% 50%, var(--primary) 0%, transparent 70%);
  opacity: 0;
  pointer-events: none;
  transform-origin: center;
  transform: scale(0.3);
}
.presence-card-grid--ripple::after {
  animation: grid-join-ripple 1.5s ease-out forwards;
}
@keyframes grid-join-ripple {
  0%   { opacity: 0.25; transform: scale(0.3); }
  40%  { opacity: 0.12; transform: scale(1.1); }
  100% { opacity: 0;    transform: scale(1.6); }
}
.presence-card-inner { position: relative; z-index: 1; padding: 12px 12px 10px; }
.pc-dot-row { margin-bottom: 10px; }
.presence-card-list { display: flex; flex-direction: column; gap: 6px; position: relative; }
.presence-card-row { display: flex; align-items: center; gap: 9px; }
.presence-card-name { font-size: 12px; color: var(--ink); font-weight: 500; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.presence-card-name--anon { color: var(--muted); font-style: italic; font-weight: 400; }

/* Viewer morph (inspira-ui blur style) */
.viewer-morph-enter-active { transition: all 0.5s ease; }
.viewer-morph-leave-active { transition: all 0.3s ease; position: absolute; width: 100%; }
.viewer-morph-enter-from { opacity: 0; filter: blur(6px); transform: translateY(6px) scale(.9); }
.viewer-morph-leave-to   { opacity: 0; filter: blur(6px); transform: translateY(-4px) scale(.9); }
.presence-card-row--morphing .presence-card-name { animation: morph-name-in 0.7s ease forwards; }
@keyframes morph-name-in { 0%{ filter:blur(8px); opacity:0; } 100%{ filter:blur(0); opacity:1; } }

/* Text & Avatar morph transitions (Inspira UI styled) */
.text-fade-enter-active, .text-fade-leave-active {
  transition: opacity 0.35s ease, filter 0.35s ease, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.text-fade-enter-from {
  opacity: 0;
  filter: blur(2px);
  transform: translateY(3px);
}
.text-fade-leave-to {
  opacity: 0;
  filter: blur(2px);
  transform: translateY(-3px);
}

.avatar-fade-enter-active, .avatar-fade-leave-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.avatar-fade-enter-from {
  opacity: 0;
  transform: scale(0.6) rotate(-15deg);
}
.avatar-fade-leave-to {
  opacity: 0;
  transform: scale(0.6) rotate(15deg);
}

/* Pill transitions */
.presence-enter-active { transition: opacity 0.35s ease, transform 0.35s ease; }
.presence-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.presence-enter-from { opacity: 0; transform: translateX(-50%) translateY(10px); }
.presence-leave-to   { opacity: 0; transform: translateX(-50%) translateY(6px); }
/* Sidebar transitions */
.presence-card-enter-active { transition: opacity 0.35s ease, transform 0.35s ease; }
.presence-card-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.presence-card-enter-from { opacity: 0; transform: translateY(-8px); }
.presence-card-leave-to   { opacity: 0; transform: translateY(-4px); }

/* Solo desktop state */
.presence-card--solo .presence-card-inner {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;
}
.pc-solo-text {
  display: flex;
  flex-wrap: wrap;
  gap: 0.28em;
  align-items: baseline;
  margin: 0;
  font-size: var(--fs-sm);
  font-style: italic;
  color: var(--ink-soft);
  font-weight: 400;
  line-height: 1.5;
}
.tge-word {
  display: inline-block;
  opacity: 0;
  filter: blur(6px);
  animation: tge-reveal 0.55s ease-out forwards;
}
@keyframes tge-reveal {
  to { opacity: 1; filter: blur(0); }
}
.pc-solo-btn {
  white-space: nowrap;
  font-size: var(--fs-sm);
}

</style>

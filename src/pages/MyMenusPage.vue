<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { useUser } from '@clerk/vue'
import { useMenus } from '../composables/useMenus'
import { isDeadlineError } from '../composables/useOrders'
import { formatVNDate } from '../lib/date'
import { getOrderedDishUsage, parseMenuEditorDraft } from '../lib/menuEditor'
import { buildShareUrl } from '../lib/share'
import {
  PageHeader,
  AppCard,
  AppButton,
  AsyncState,
  MenuEditorDialog,
  SignedOutState,
  SignInModal,
  DeadlineStatus,
} from '../components/ui'

const { getMenu, listMyMenus, updateMenu, deleteMenu } = useMenus()
const { user, isLoaded, isSignedIn } = useUser()

const loading = ref(true)
const errorMsg = ref('')
const menus = ref([])
const showSignIn = ref(false)

function refreshOnFocus() {
  load()
}

onMounted(() => {
  load()
  window.addEventListener('focus', refreshOnFocus)
})
onUnmounted(() => window.removeEventListener('focus', refreshOnFocus))
watch([isLoaded, isSignedIn], ([loaded]) => {
  if (loaded) load()
})

async function load() {
  if (!isLoaded.value || !isSignedIn.value) {
    loading.value = false
    menus.value = []
    return
  }

  loading.value = true
  errorMsg.value = ''
  const { data, error } = await listMyMenus()
  if (error) {
    errorMsg.value = 'Không tải được danh sách menu. Kiểm tra kết nối rồi thử lại.'
  } else {
    menus.value = data ?? []
  }
  loading.value = false
}

// Group by menu_date, newest day first (matches HistoryPage layout).
const groupedByDay = computed(() => {
  const map = new Map()
  for (const menu of menus.value) {
    const d = menu.menu_date
    if (!map.has(d)) map.set(d, [])
    map.get(d).push(menu)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, dayMenus]) => ({ date, menus: dayMenus }))
})

function orderStats(menu) {
  const total = menu.orders?.length ?? 0
  const paid = menu.orders?.filter((o) => o.is_paid).length ?? 0
  return { total, paid }
}

// ---- copy link ----
const copiedMenuId = ref(null)
function copyMenuLink(menu) {
  const url = buildShareUrl(menu)
  navigator.clipboard.writeText(url).then(() => {
    copiedMenuId.value = menu.id
    setTimeout(() => {
      if (copiedMenuId.value === menu.id) copiedMenuId.value = null
    }, 2000)
  }).catch((err) => {
    console.error('Failed to copy link: ', err)
  })
}

// ---- owner menu editor ----
const selectedMenu = ref(null)
const editorOpenedOrders = ref([])
const editSaving = ref(false)
const editError = ref('')

function openMenuEditor(menu) {
  selectedMenu.value = menu
  editorOpenedOrders.value = (menu.orders ?? []).map(order => ({ ...order }))
  editError.value = ''
}

function closeMenuEditor() {
  selectedMenu.value = null
  editorOpenedOrders.value = []
  editError.value = ''
}

function dishPrice(dish) {
  const price = Number(dish?.price)
  return Number.isFinite(price) ? price : 0
}

function findFreshOrderConflict(originalNote, draftNote, openedOrders, latestOrders) {
  const original = parseMenuEditorDraft(originalNote ?? '')
  const next = parseMenuEditorDraft(draftNote ?? '')
  if (original.kind !== 'structured' || next.kind !== 'structured') return null

  const openedUsage = getOrderedDishUsage(original.dishes, openedOrders)
  const latestUsage = getOrderedDishUsage(original.dishes, latestOrders)
  const nextByName = new Map(next.dishes.map(dish => [dish.name, dish]))

  for (const originalDish of original.dishes) {
    const name = originalDish.name
    const latestCount = latestUsage.counts.get(name) ?? 0
    const nextDish = nextByName.get(name)

    if (latestCount > 0 && !nextDish) {
      return { kind: 'name', name }
    }
    if (!nextDish || dishPrice(nextDish) === dishPrice(originalDish)) continue
    if (latestUsage.paidNames.has(name)) {
      return { kind: 'paid-price', name }
    }

    const openedCount = openedUsage.counts.get(name) ?? 0
    if (latestCount > openedCount) {
      return { kind: 'unpaid-price', name, count: latestCount }
    }
  }

  return null
}

function mergeFreshMenu(freshMenu) {
  const idx = menus.value.findIndex(menu => menu.id === freshMenu.id)
  if (idx !== -1) menus.value[idx] = { ...menus.value[idx], ...freshMenu }
  if (selectedMenu.value?.id === freshMenu.id) {
    selectedMenu.value = { ...selectedMenu.value, ...freshMenu }
  }
}

async function saveMenuDraft(draft) {
  if (!selectedMenu.value) return
  editSaving.value = true
  editError.value = ''

  const originalMenu = selectedMenu.value
  const { data: freshMenu, error: refreshError } = await getMenu(draft.id)
  if (refreshError || !freshMenu) {
    editError.value = 'Không kiểm tra được đơn mới trước khi lưu. Bản nháp của bạn vẫn được giữ; hãy thử lại.'
    editSaving.value = false
    return
  }

  const conflict = findFreshOrderConflict(
    originalMenu.note,
    draft.note,
    editorOpenedOrders.value,
    freshMenu.orders ?? [],
  )
  mergeFreshMenu(freshMenu)

  if (conflict?.kind === 'name') {
    editError.value = `Món "${conflict.name}" vừa có đơn mới nên không thể đổi tên hoặc xoá. Bản nháp của bạn vẫn được giữ; hãy kiểm tra lại.`
    editSaving.value = false
    return
  }
  if (conflict?.kind === 'paid-price') {
    editError.value = `Món "${conflict.name}" vừa có đơn đã thanh toán nên giá đã được khoá. Bản nháp của bạn vẫn được giữ; hãy kiểm tra lại.`
    editSaving.value = false
    return
  }
  if (conflict?.kind === 'unpaid-price') {
    const confirmed = typeof window !== 'undefined'
      && typeof window.confirm === 'function'
      && window.confirm(`Giá mới sẽ cập nhật số tiền của ${conflict.count} đơn chưa thanh toán`)
    if (!confirmed) {
      editError.value = `Dữ liệu đơn của "${conflict.name}" vừa thay đổi. Bản nháp của bạn vẫn được giữ; hãy xác nhận lại giá trước khi lưu.`
      editSaving.value = false
      return
    }
  }

  const { data, error } = await updateMenu(draft)
  if (error) {
    editError.value = isDeadlineError(error)
      ? 'Menu đã chốt đơn. Hãy gia hạn hoặc bỏ hạn chót rồi thử lại.'
      : 'Lưu thay đổi không thành công. Thử lại nhé.'
  } else if (data) {
    const idx = menus.value.findIndex((m) => m.id === draft.id)
    if (idx !== -1) {
      menus.value[idx] = { ...menus.value[idx], ...data, orders: freshMenu.orders ?? [] }
    }
    selectedMenu.value = null
    editorOpenedOrders.value = []
  }
  editSaving.value = false
}

// ---- delete ----
const deletingMenus = reactive({})
const deleteErrors = reactive({})

async function confirmDeleteMenu(menu) {
  const total = menu.orders?.length ?? 0
  const message = total > 0
    ? `Bạn có chắc chắn muốn xoá menu "${menu.title}"?\nThao tác này sẽ xoá toàn bộ ${total} đơn đặt món đi kèm!`
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
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Quản lý"
      title="Menu của tôi"
      sub="Các menu bạn đã đăng và tình hình đặt món của mỗi menu."
    />

    <SignedOutState
      v-if="isLoaded && !isSignedIn"
      description="Đăng nhập để xem và quản lý các menu bạn đã đăng."
      @sign-in="showSignIn = true"
    />

    <AsyncState
      v-else
      :loading="!isLoaded || loading"
      loading-label="Đang tải menu…"
      :error="errorMsg"
      :empty="menus.length === 0"
      empty-icon="🍱"
      empty-title="Bạn chưa đăng menu nào"
      empty-description="Đăng một menu để mọi người đặt cơm trưa."
      @retry="load"
    >
      <template #empty-action>
        <AppButton :to="'/post'">Đăng cơm</AppButton>
      </template>
      <div class="stack">
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

        <AppCard v-for="menu in group.menus" :key="menu.id" ticket>
          <div class="stack-sm">
            <div class="row row-wrap menu-head">
              <h2 class="section-title menu-title">{{ menu.title }}</h2>
              <span class="spacer" />
              <span class="badge">{{ orderStats(menu).total }} đơn</span>
              <span
                class="badge"
                :class="orderStats(menu).paid === orderStats(menu).total ? 'badge--paid' : 'badge--unpaid'"
              >
                đã trả {{ orderStats(menu).paid }}/{{ orderStats(menu).total }}
              </span>
            </div>
            <DeadlineStatus :deadline="menu.order_deadline" />

            <p v-if="deleteErrors[menu.id]" class="alert">
              {{ deleteErrors[menu.id] }}
            </p>

            <div class="row row-wrap actions">
              <AppButton variant="ghost" size="sm" :to="`/menu/${menu.id}`">
                Xem chi tiết
              </AppButton>
              <AppButton variant="ghost" size="sm" @click="copyMenuLink(menu)">
                {{ copiedMenuId === menu.id ? 'Đã chép ✓' : 'Sao chép link' }}
              </AppButton>
              <AppButton
                v-if="menu.poster_id === user?.id"
                :data-testid="`edit-menu-${menu.id}`"
                variant="ghost"
                size="sm"
                @click="openMenuEditor(menu)"
              >
                Chỉnh sửa món
              </AppButton>
              <AppButton
                variant="danger"
                size="sm"
                :loading="!!deletingMenus[menu.id]"
                @click="confirmDeleteMenu(menu)"
              >
                Xoá
              </AppButton>
            </div>
          </div>
        </AppCard>
      </section>
      </div>
    </AsyncState>
    <MenuEditorDialog
      v-if="selectedMenu"
      :menu="selectedMenu"
      :orders="selectedMenu.orders ?? []"
      :open="Boolean(selectedMenu)"
      :saving="editSaving"
      :error="editError"
      @close="closeMenuEditor"
      @save="saveMenuDraft"
    />
    <SignInModal v-if="showSignIn" @close="showSignIn = false" />
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
.menu-head {
  align-items: center;
  gap: 0.5rem;
}
.menu-title {
  font-size: var(--fs-base);
}
.actions {
  gap: 0.5rem;
}
</style>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { useUser } from '@clerk/vue'
import { useMenus } from '../composables/useMenus'
import { isDeadlineError } from '../composables/useOrders'
import { formatVNDate } from '../lib/date'
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

const { listMyMenus, updateMenu, deleteMenu } = useMenus()
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
const editSaving = ref(false)
const editError = ref('')

function openMenuEditor(menu) {
  selectedMenu.value = menu
  editError.value = ''
}

function closeMenuEditor() {
  selectedMenu.value = null
  editError.value = ''
}

async function saveMenuDraft(draft) {
  if (!selectedMenu.value) return
  editSaving.value = true
  editError.value = ''
  const { data, error } = await updateMenu(draft)
  if (error) {
    editError.value = isDeadlineError(error)
      ? 'Menu đã chốt đơn. Hãy gia hạn hoặc bỏ hạn chót rồi thử lại.'
      : 'Lưu thay đổi không thành công. Thử lại nhé.'
  } else if (data) {
    const idx = menus.value.findIndex((m) => m.id === draft.id)
    if (idx !== -1) {
      menus.value[idx] = { ...menus.value[idx], ...data, orders: menus.value[idx].orders }
    }
    selectedMenu.value = null
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

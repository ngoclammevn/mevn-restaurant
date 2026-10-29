<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useUser } from '@clerk/vue'
import { useDashboard } from '../composables/useDashboard'
import { todayInVN, formatVNDate } from '../lib/date'
import {
  PageHeader,
  AppCard,
  AppButton,
  Avatar,
  Spinner,
  EmptyState,
  SignInModal,
} from '../components/ui'

const { user, isSignedIn } = useUser()
const { unpaidByPersonForMyMenus, fetchStatistics } = useDashboard()

const showSignIn = ref(false)
const activeTab = ref('unpaid') // 'unpaid' | 'stats'

// ---- Tab 1: Unpaid (no date filter, shows all incomplete members) ----
const unpaidLoading = ref(true)
const unpaidError = ref('')
const people = ref([])

const totalUnpaidOrders = computed(() =>
  people.value.reduce((sum, p) => sum + p.items.length, 0)
)
const totalUnpaidAmount = computed(() =>
  people.value.reduce((sum, p) => sum + (p.knownTotal || 0), 0)
)
const hasAnyUnpaidPrice = computed(() =>
  people.value.some((p) => p.hasPricedItem)
)

async function loadUnpaid() {
  if (!isSignedIn.value) {
    unpaidLoading.value = false
    return
  }
  unpaidLoading.value = true
  unpaidError.value = ''
  const { data, error } = await unpaidByPersonForMyMenus()
  if (error) {
    unpaidError.value = 'Không tải được dữ liệu. Kiểm tra kết nối rồi thử lại.'
    unpaidLoading.value = false
    return
  }
  people.value = data ?? []
  unpaidLoading.value = false
}

// ---- Tab 2: Statistics (with startDate & endDate filter) ----
function getMonthStartVN() {
  const today = todayInVN()
  const [y, m] = today.split('-')
  return `${y}-${m}-01`
}

function shiftDays(dateStr, deltaDays) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  dt.setUTCDate(dt.getUTCDate() + deltaDays)
  const ny = dt.getUTCFullYear()
  const nm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const nd = String(dt.getUTCDate()).padStart(2, '0')
  return `${ny}-${nm}-${nd}`
}

const startDate = ref(getMonthStartVN())
const endDate = ref(todayInVN())
const onlyMyMenus = ref(true)
const statsLoading = ref(false)
const statsError = ref('')
const statsData = ref(null)

const dateRangeInvalid = computed(() =>
  Boolean(startDate.value && endDate.value && startDate.value > endDate.value)
)

function applyPreset(preset) {
  const today = todayInVN()
  if (preset === '7d') {
    startDate.value = shiftDays(today, -6)
    endDate.value = today
  } else if (preset === '30d') {
    startDate.value = shiftDays(today, -29)
    endDate.value = today
  } else if (preset === 'this_month') {
    startDate.value = getMonthStartVN()
    endDate.value = today
  } else if (preset === 'last_month') {
    const [y, m] = today.split('-').map(Number)
    const firstPrev = new Date(Date.UTC(y, m - 2, 1, 12, 0, 0))
    const lastPrev = new Date(Date.UTC(y, m - 1, 0, 12, 0, 0))
    const py = firstPrev.getUTCFullYear()
    const pm = String(firstPrev.getUTCMonth() + 1).padStart(2, '0')
    const ld = String(lastPrev.getUTCDate()).padStart(2, '0')
    startDate.value = `${py}-${pm}-01`
    endDate.value = `${py}-${pm}-${ld}`
  } else if (preset === 'all') {
    startDate.value = ''
    endDate.value = ''
  }
}

async function loadStats() {
  if (!isSignedIn.value) {
    statsLoading.value = false
    return
  }
  if (dateRangeInvalid.value) return
  statsLoading.value = true
  statsError.value = ''
  const { data, error } = await fetchStatistics({
    startDate: startDate.value,
    endDate: endDate.value,
    onlyMyMenus: onlyMyMenus.value,
  })
  if (error) {
    statsError.value = 'Không tải được dữ liệu thống kê. Kiểm tra kết nối rồi thử lại.'
    statsLoading.value = false
    return
  }
  statsData.value = data
  statsLoading.value = false
}

function fmtMoney(val) {
  if (val == null) return ''
  return new Intl.NumberFormat('vi-VN').format(val) + 'đ'
}

onMounted(() => {
  loadUnpaid()
  loadStats()
})

watch(user, () => {
  loadUnpaid()
  loadStats()
})

watch([startDate, endDate, onlyMyMenus], () => {
  loadStats()
})
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Thu tiền & Thống kê"
      :title="activeTab === 'unpaid' ? 'Ai chưa chuyển khoản?' : 'Thống kê đặt cơm'"
      :sub="
        activeTab === 'unpaid'
          ? 'Toàn bộ thành viên chưa hoàn thành thanh toán trên các menu bạn đăng.'
          : 'Tổng hợp số đơn, chi phí và tình trạng thanh toán theo khoảng thời gian.'
      "
    />

    <!-- Not signed in -->
    <div v-if="!isSignedIn" style="margin-top: 1.5rem">
      <EmptyState
        title="Chưa đăng nhập"
        description="Vui lòng đăng nhập để theo dõi thu tiền và xem thống kê."
        icon="🔒"
      >
        <AppButton @click="showSignIn = true">Đăng nhập</AppButton>
      </EmptyState>
    </div>

    <template v-else>
      <!-- Mode switcher tabs -->
      <div class="dashboard-tabs">
        <button
          type="button"
          class="dashboard-tab"
          :class="{ 'dashboard-tab--active': activeTab === 'unpaid' }"
          @click="activeTab = 'unpaid'"
        >
          <span>Chưa chuyển khoản</span>
          <span
            v-if="!unpaidLoading && people.length > 0"
            class="tab-count tab-count--unpaid"
          >
            {{ people.length }}
          </span>
        </button>
        <button
          type="button"
          class="dashboard-tab"
          :class="{ 'dashboard-tab--active': activeTab === 'stats' }"
          @click="activeTab = 'stats'"
        >
          <span>📊 Thống kê</span>
        </button>
      </div>

      <!-- ============================================================
           TAB 1: DANH SÁCH CHƯA CHUYỂN KHOẢN (KHÔNG FILTER NGÀY)
           ============================================================ -->
      <div v-if="activeTab === 'unpaid'">
        <Spinner v-if="unpaidLoading" label="Đang tải danh sách…" />

        <template v-else>
          <p v-if="unpaidError" class="alert">{{ unpaidError }}</p>

          <EmptyState
            v-else-if="people.length === 0"
            icon="🎉"
            title="Tất cả mọi người đã hoàn thành!"
            description="Không còn thành viên nào nợ tiền trên toàn bộ các menu bạn đã đăng."
          />

          <template v-else>
            <!-- Summary banner -->
            <div class="unpaid-overview row-wrap">
              <span class="badge badge--unpaid">
                {{ people.length }} người chưa chuyển khoản
              </span>
              <span class="meta">· {{ totalUnpaidOrders }} đơn chưa hoàn thành</span>
              <span v-if="hasAnyUnpaidPrice" class="unpaid-total-pill">
                Tổng tạm tính: <strong>{{ fmtMoney(totalUnpaidAmount) }}</strong>
              </span>
            </div>

            <!-- One card per person -->
            <div class="stack">
              <AppCard v-for="person in people" :key="person.user_id">
                <div class="stack-sm">
                  <!-- Person header -->
                  <div class="row-wrap">
                    <Avatar :src="person.avatar_url" :name="person.full_name || ''" />
                    <div>
                      <div class="person-name">
                        {{ person.full_name || '(chưa đặt tên)' }}
                      </div>
                      <div class="meta">
                        {{ person.items.length }} đơn chưa trả
                      </div>
                    </div>
                    <span class="spacer" />
                    <span v-if="person.hasPricedItem" class="badge badge--unpaid person-amount">
                      {{ fmtMoney(person.knownTotal) }}{{ person.hasUnpricedItem ? '+' : '' }}
                    </span>
                  </div>

                  <hr class="divider" />

                  <!-- Unpaid orders across all dates -->
                  <ul class="unpaid-items-list stack-sm">
                    <li
                      v-for="item in person.items"
                      :key="item.order_id"
                      class="unpaid-item-row"
                    >
                      <span class="item-date-badge">{{ formatVNDate(item.menu_date) }}</span>
                      <router-link :to="`/menu/${item.menu_id}`" class="item-menu-link">
                        {{ item.menu_title }}
                      </router-link>
                      <span class="item-sep">—</span>
                      <span class="item-text">{{ item.item_text }}</span>
                      <span v-if="item.price != null" class="item-price">
                        {{ fmtMoney(item.price) }}
                      </span>
                    </li>
                  </ul>
                </div>
              </AppCard>
            </div>
          </template>
        </template>
      </div>

      <!-- ============================================================
           TAB 2: THỐNG KÊ (CÓ FILTER NGÀY BẮT ĐẦU & KẾT THÚC)
           ============================================================ -->
      <div v-else class="stack">
        <!-- Filter panel -->
        <AppCard>
          <div class="stack-sm">
            <div class="row-wrap filter-top-row">
              <span class="eyebrow">Bộ lọc thời gian</span>
              <span class="spacer" />
              <!-- Scope toggle -->
              <div class="scope-switch">
                <button
                  type="button"
                  class="scope-btn"
                  :class="{ 'scope-btn--active': onlyMyMenus }"
                  @click="onlyMyMenus = true"
                >
                  Menu tôi đăng
                </button>
                <button
                  type="button"
                  class="scope-btn"
                  :class="{ 'scope-btn--active': !onlyMyMenus }"
                  @click="onlyMyMenus = false"
                >
                  Cả nhóm
                </button>
              </div>
            </div>

            <!-- Date inputs -->
            <div class="date-filter-grid">
              <div class="field">
                <label for="stats-start-date">Ngày bắt đầu</label>
                <input
                  id="stats-start-date"
                  v-model="startDate"
                  type="date"
                  class="input"
                />
              </div>
              <div class="field">
                <label for="stats-end-date">Ngày kết thúc</label>
                <input
                  id="stats-end-date"
                  v-model="endDate"
                  type="date"
                  class="input"
                />
              </div>
            </div>

            <!-- Quick preset pills -->
            <div class="preset-row row-wrap">
              <span class="meta" style="font-size: var(--fs-xs);">Chọn nhanh:</span>
              <button type="button" class="preset-chip" @click="applyPreset('7d')">
                7 ngày qua
              </button>
              <button type="button" class="preset-chip" @click="applyPreset('30d')">
                30 ngày qua
              </button>
              <button type="button" class="preset-chip" @click="applyPreset('this_month')">
                Tháng này
              </button>
              <button type="button" class="preset-chip" @click="applyPreset('last_month')">
                Tháng trước
              </button>
              <button type="button" class="preset-chip" @click="applyPreset('all')">
                Tất cả
              </button>
            </div>

            <p v-if="dateRangeInvalid" class="alert">
              Ngày bắt đầu không được lớn hơn ngày kết thúc.
            </p>
          </div>
        </AppCard>

        <Spinner v-if="statsLoading" label="Đang tổng hợp thống kê…" />

        <p v-else-if="statsError" class="alert">{{ statsError }}</p>

        <template v-else-if="statsData">
          <!-- Empty state when no menus in range -->
          <EmptyState
            v-if="statsData.summary.totalMenus === 0"
            icon="📭"
            title="Chưa có dữ liệu trong khoảng thời gian này"
            :description="
              startDate && endDate
                ? `Từ ${formatVNDate(startDate)} đến ${formatVNDate(endDate)} không có menu nào.`
                : 'Không tìm thấy menu nào phù hợp với bộ lọc.'
            "
          />

          <template v-else>
            <!-- Primary Financial Cards: Tổng tiền đã chi & Tổng tiền đã thu -->
            <div class="finance-hero-grid">
              <div class="finance-card finance-card--spent">
                <div class="finance-card__head">
                  <span class="finance-card__icon">💸</span>
                  <span class="finance-card__label">Tổng tiền đã chi</span>
                </div>
                <div class="finance-card__value">
                  {{ fmtMoney(statsData.summary.totalAmount || 0) }}
                </div>
                <div class="finance-card__sub">
                  Chi mua <strong>{{ statsData.summary.totalOrders }}</strong> suất trên
                  <strong>{{ statsData.summary.totalMenus }}</strong> menu
                </div>
              </div>

              <div class="finance-card finance-card--collected">
                <div class="finance-card__head">
                  <span class="finance-card__icon">💰</span>
                  <span class="finance-card__label">Tổng tiền đã thu</span>
                </div>
                <div class="finance-card__value">
                  {{ fmtMoney(statsData.summary.paidAmount || 0) }}
                </div>
                <div class="finance-card__sub">
                  Đã thu <strong>{{ statsData.summary.paidOrders }}/{{ statsData.summary.totalOrders }}</strong> đơn
                  ({{ statsData.summary.paidRate }}%)
                </div>
              </div>

              <div class="finance-card finance-card--pending">
                <div class="finance-card__head">
                  <span class="finance-card__icon">⏳</span>
                  <span class="finance-card__label">Tiền còn chưa thu</span>
                </div>
                <div class="finance-card__value">
                  {{ fmtMoney(statsData.summary.unpaidAmount || 0) }}
                </div>
                <div class="finance-card__sub">
                  Còn <strong>{{ statsData.summary.unpaidOrders }}</strong> đơn chưa chuyển khoản
                </div>
              </div>
            </div>

            <!-- Collection progress bar & Personal lunch spending -->
            <AppCard>
              <div class="stack-sm">
                <div class="row-wrap" style="justify-content: space-between;">
                  <span class="eyebrow">Tiến độ thu hồi chi phí</span>
                  <span class="meta">
                    Đã thu <strong>{{ fmtMoney(statsData.summary.paidAmount || 0) }}</strong>
                    / Đã chi <strong>{{ fmtMoney(statsData.summary.totalAmount || 0) }}</strong>
                    ({{ statsData.summary.amountCollectedRate }}%)
                  </span>
                </div>
                <div class="progress-track">
                  <div
                    class="progress-fill"
                    :style="{ width: `${statsData.summary.totalAmount > 0 ? statsData.summary.amountCollectedRate : statsData.summary.paidRate}%` }"
                  />
                </div>
                <div class="personal-spend-row row-wrap">
                  <span class="meta">
                    🍱 <strong>Phần ăn cá nhân bạn đặt trong kỳ:</strong>
                    {{ statsData.summary.myPersonalOrdersCount }} bữa —
                    Tổng chi cá nhân: <strong>{{ fmtMoney(statsData.summary.myPersonalSpentAmount || 0) }}</strong>
                    <template v-if="statsData.summary.myPersonalUnpaidAmount > 0">
                      (còn chưa trả {{ fmtMoney(statsData.summary.myPersonalUnpaidAmount) }})
                    </template>
                  </span>
                </div>
              </div>
            </AppCard>

            <!-- Section 1: Member breakdown -->
            <AppCard v-if="statsData.byMember.length > 0">
              <div class="stack-sm">
                <div class="row-wrap">
                  <span class="eyebrow">Thống kê theo thành viên ({{ statsData.byMember.length }})</span>
                  <span class="spacer" />
                  <span class="meta">
                    Đã thu: <strong>{{ fmtMoney(statsData.summary.paidAmount || 0) }}</strong>
                    / Tổng: <strong>{{ fmtMoney(statsData.summary.totalAmount || 0) }}</strong>
                  </span>
                </div>

                <hr class="divider" />

                <div class="member-stats-list">
                  <div
                    v-for="m in statsData.byMember"
                    :key="m.user_id"
                    class="member-stat-row"
                  >
                    <Avatar :src="m.avatar_url" :name="m.full_name" :size="34" />
                    <div class="member-stat-info">
                      <div class="member-stat-name">{{ m.full_name }}</div>
                      <div class="meta member-stat-sub">
                        {{ m.totalOrders }} đơn · Tổng: <strong>{{ fmtMoney(m.totalAmount || 0) }}</strong>
                      </div>
                    </div>
                    <div class="member-stat-badges">
                      <span v-if="m.paidOrders > 0" class="badge badge--paid">
                        Đã trả {{ m.paidOrders }} ({{ fmtMoney(m.paidAmount || 0) }})
                      </span>
                      <span v-if="m.unpaidOrders > 0" class="badge badge--unpaid">
                        Chưa trả {{ m.unpaidOrders }} ({{ fmtMoney(m.unpaidAmount || 0) }})
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </AppCard>

            <!-- Section 2: Top Dishes -->
            <AppCard v-if="statsData.topDishes.length > 0">
              <div class="stack-sm">
                <div class="eyebrow">Món được đặt nhiều nhất</div>
                <hr class="divider" />
                <div class="dish-stats-list">
                  <div
                    v-for="(dish, idx) in statsData.topDishes"
                    :key="dish.name"
                    class="dish-stat-row"
                  >
                    <span class="dish-rank">#{{ idx + 1 }}</span>
                    <span class="dish-name">{{ dish.name }}</span>
                    <span class="badge badge--paid">×{{ dish.count }}</span>
                    <span v-if="dish.hasPrice" class="dish-amount">
                      {{ fmtMoney(dish.totalAmount) }}
                    </span>
                  </div>
                </div>
              </div>
            </AppCard>

            <!-- Section 3: Menus in range -->
            <AppCard v-if="statsData.byMenu.length > 0">
              <div class="stack-sm">
                <div class="eyebrow">Danh sách menu trong kỳ ({{ statsData.byMenu.length }})</div>
                <hr class="divider" />
                <div class="menu-stats-list">
                  <router-link
                    v-for="m in statsData.byMenu"
                    :key="m.id"
                    :to="`/menu/${m.id}`"
                    class="menu-stat-row"
                  >
                    <span class="item-date-badge">{{ formatVNDate(m.menu_date) }}</span>
                    <div class="menu-stat-main">
                      <span class="menu-stat-title">{{ m.title }}</span>
                      <span v-if="!onlyMyMenus && m.poster_name" class="meta">
                        · đăng bởi {{ m.poster_name }}
                      </span>
                    </div>
                    <div class="menu-stat-right">
                      <span class="menu-stat-amount">
                        Chi: {{ fmtMoney(m.totalAmount || 0) }} · Thu: {{ fmtMoney(m.paidAmount || 0) }}
                      </span>
                      <span
                        class="badge"
                        :class="m.unpaidOrders === 0 ? 'badge--paid' : 'badge--unpaid'"
                      >
                        đã trả {{ m.paidOrders }}/{{ m.totalOrders }}
                      </span>
                    </div>
                  </router-link>
                </div>
              </div>
            </AppCard>
          </template>
        </template>
      </div>
    </template>

    <SignInModal v-if="showSignIn" @close="showSignIn = false" />
  </div>
</template>

<style scoped>
.dashboard-tabs {
  display: inline-flex;
  gap: 0.35rem;
  padding: 0.3rem;
  background: var(--bg-tint);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-pill);
  margin-bottom: 1.4rem;
  max-width: 100%;
  flex-wrap: wrap;
}

.dashboard-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.48rem 1rem;
  border-radius: var(--radius-pill);
  border: none;
  background: transparent;
  color: var(--ink-soft);
  font-weight: 700;
  font-size: var(--fs-sm);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, box-shadow 0.15s;
}

.dashboard-tab:hover {
  color: var(--ink);
}

.dashboard-tab--active {
  background: var(--card);
  color: var(--primary-ink);
  box-shadow: var(--shadow);
}

.tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.35rem;
  height: 1.35rem;
  padding: 0 0.4rem;
  border-radius: var(--radius-pill);
  font-size: var(--fs-xs);
  font-weight: 800;
}

.tab-count--unpaid {
  background: var(--accent);
  color: #fff;
}

/* Unpaid tab */
.unpaid-overview {
  margin-bottom: 1rem;
}

.unpaid-total-pill {
  margin-left: auto;
  font-size: var(--fs-sm);
  color: var(--ink-soft);
}

.person-name {
  font-weight: 700;
}

.person-amount {
  font-size: var(--fs-sm);
  padding: 0.25rem 0.7rem;
}

.unpaid-items-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.unpaid-item-row {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding: 0.2rem 0;
}

.item-date-badge {
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--ink-soft);
  background: var(--bg-tint);
  border: 1px solid var(--line);
  padding: 0.1rem 0.45rem;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.item-menu-link {
  font-size: var(--fs-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--primary);
  text-decoration: none;
  flex-shrink: 0;
}

.item-menu-link:hover {
  text-decoration: underline;
}

.item-sep {
  color: var(--ink-soft);
  font-size: var(--fs-sm);
}

.item-text {
  font-size: var(--fs-sm);
  color: var(--ink);
  font-weight: 500;
}

.item-price {
  margin-left: auto;
  font-size: var(--fs-sm);
  font-weight: 700;
  color: #a83312;
}

/* Stats filter */
.filter-top-row {
  margin-bottom: 0.2rem;
}

.scope-switch {
  display: inline-flex;
  background: var(--bg-tint);
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  padding: 0.18rem;
  gap: 0.15rem;
}

.scope-btn {
  border: none;
  background: transparent;
  padding: 0.25rem 0.65rem;
  border-radius: var(--radius-pill);
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--ink-soft);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.scope-btn--active {
  background: var(--primary);
  color: #fff;
}

.date-filter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.85rem;
}

.preset-row {
  gap: 0.4rem;
  margin-top: 0.2rem;
}

.preset-chip {
  border: 1px solid var(--line-strong);
  background: var(--bg);
  color: var(--ink-soft);
  border-radius: var(--radius-pill);
  padding: 0.22rem 0.65rem;
  font-size: var(--fs-xs);
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.preset-chip:hover {
  background: var(--primary-soft);
  color: var(--primary-ink);
  border-color: var(--primary);
}

/* Finance Hero Grid */
.finance-hero-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.9rem;
}

.finance-card {
  background: var(--card);
  border: 1.5px solid var(--line);
  border-radius: var(--radius);
  padding: 1.05rem 1.15rem;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.finance-card--spent {
  background: color-mix(in srgb, var(--bg-tint) 60%, var(--card));
  border-color: var(--line-strong);
}

.finance-card--collected {
  background: color-mix(in srgb, var(--primary-soft) 50%, var(--card));
  border-color: color-mix(in srgb, var(--primary) 30%, var(--line));
}

.finance-card--pending {
  background: color-mix(in srgb, var(--accent-soft) 50%, var(--card));
  border-color: color-mix(in srgb, var(--accent) 30%, var(--line));
}

.finance-card__head {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.finance-card__icon {
  font-size: 1rem;
}

.finance-card__label {
  font-size: var(--fs-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ink-soft);
}

.finance-card__value {
  font-size: var(--fs-xl);
  font-weight: 800;
  color: var(--ink);
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
}

.finance-card--collected .finance-card__value {
  color: var(--primary-ink);
}

.finance-card--pending .finance-card__value {
  color: #a83312;
}

.finance-card__sub {
  font-size: var(--fs-xs);
  color: var(--ink-soft);
}

.progress-track {
  width: 100%;
  height: 10px;
  background: var(--bg-tint);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-pill);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary) 0%, #2b8f5a 100%);
  border-radius: var(--radius-pill);
  transition: width 0.35s ease;
}

.personal-spend-row {
  padding-top: 0.25rem;
  border-top: 1px dashed var(--line);
}

/* Member breakdown */
.member-stats-list {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.member-stat-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-wrap: wrap;
  padding: 0.35rem 0;
  border-bottom: 1px dashed var(--line);
}

.member-stat-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.member-stat-info {
  flex: 1;
  min-width: 140px;
}

.member-stat-name {
  font-weight: 700;
  font-size: var(--fs-sm);
}

.member-stat-sub {
  font-size: var(--fs-xs);
}

.member-stat-badges {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

/* Dish breakdown */
.dish-stats-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.dish-stat-row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.25rem 0;
}

.dish-rank {
  font-size: var(--fs-xs);
  font-weight: 800;
  color: var(--muted);
  min-width: 1.6rem;
}

.dish-name {
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--ink);
  flex: 1;
}

.dish-amount {
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--primary-ink);
}

/* Menu breakdown */
.menu-stats-list {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.menu-stat-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  padding: 0.45rem 0.55rem;
  border-radius: var(--radius-sm);
  text-decoration: none;
  color: inherit;
  transition: background 0.15s;
}

.menu-stat-row:hover {
  background: var(--bg-tint);
}

.menu-stat-main {
  flex: 1;
  min-width: 150px;
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.menu-stat-title {
  font-weight: 700;
  font-size: var(--fs-sm);
  color: var(--ink);
}

.menu-stat-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
}

.menu-stat-amount {
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--primary-ink);
}
</style>

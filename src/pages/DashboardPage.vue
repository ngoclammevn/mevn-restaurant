<script setup>
import { ref, watch, onMounted } from 'vue'
import { useUser } from '@clerk/vue'
import { useDashboard } from '../composables/useDashboard'
import { todayInVN, formatVNDate } from '../lib/date'
import { PageHeader, AppCard, Avatar, Spinner, EmptyState } from '../components/ui'

const { user } = useUser()
const { unpaidByPersonForMyMenus } = useDashboard()

const date = ref(todayInVN())
const loading = ref(true)
const errorMsg = ref('')
const people = ref([])

onMounted(load)
watch(date, load)
watch(user, () => {
  load()
})

async function load() {
  loading.value = true
  errorMsg.value = ''
  const { data, error } = await unpaidByPersonForMyMenus(date.value)
  if (error) {
    errorMsg.value = 'Không tải được dữ liệu. Kiểm tra kết nối rồi thử lại.'
    loading.value = false
    return
  }
  people.value = data
  loading.value = false
}
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Thu tiền"
      title="Ai chưa chuyển khoản?"
      sub="Danh sách người chưa trả trên các menu bạn đăng."
    />

    <!-- Date picker -->
    <div class="field" style="max-width: 18rem; margin-bottom: 1.5rem;">
      <label for="dashboard-date">Ngày</label>
      <input
        id="dashboard-date"
        v-model="date"
        type="date"
        class="input"
      />
    </div>

    <!-- Loading -->
    <Spinner v-if="loading" label="Đang tải…" />

    <template v-else>
      <!-- Error -->
      <p v-if="errorMsg" class="alert">{{ errorMsg }}</p>

      <!-- Empty state -->
      <EmptyState
        v-else-if="people.length === 0"
        icon="🎉"
        title="Không có ai chưa trả cho ngày này"
        :description="`${formatVNDate(date)} — mọi người đã chuyển khoản hoặc chưa có đơn nào.`"
      />

      <!-- Unpaid list -->
      <template v-else>
        <!-- Summary count -->
        <div class="row-wrap" style="margin-bottom: 1rem;">
          <span class="badge badge--unpaid">{{ people.length }} người chưa chuyển khoản</span>
          <span class="meta">ngày {{ formatVNDate(date) }}</span>
        </div>

        <!-- One card per person -->
        <div class="stack">
          <AppCard v-for="person in people" :key="person.user_id">
            <div class="stack-sm">
              <!-- Person header -->
              <div class="row">
                <Avatar :name="person.full_name || ''" />
                <div>
                  <div style="font-weight: 700;">
                    {{ person.full_name || '(chưa đặt tên)' }}
                  </div>
                  <div class="meta">{{ person.items.length }} món</div>
                </div>
              </div>

              <hr class="divider" />

              <!-- Items -->
              <ul class="stack-sm" style="list-style: none; margin: 0; padding: 0;">
                <li
                  v-for="item in person.items"
                  :key="item.order_id"
                  class="row-wrap"
                >
                  <span class="eyebrow" style="flex: none;">{{ item.menu_title }}</span>
                  <span style="color: var(--ink-soft); font-size: var(--fs-sm);">—</span>
                  <span style="font-size: var(--fs-sm);">{{ item.item_text }}</span>
                </li>
              </ul>
            </div>
          </AppCard>
        </div>
      </template>
    </template>
  </div>
</template>

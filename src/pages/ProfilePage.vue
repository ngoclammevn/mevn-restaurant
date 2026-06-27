<script setup>
import { ref, onMounted } from 'vue'
import { useUser } from '@clerk/vue'
import { useProfile } from '../composables/useProfile'
import { AppCard, AppButton, Avatar, TextField, TextArea, PageHeader, Spinner } from '../components/ui'

const { user } = useUser()
const { getProfile, updateProfile } = useProfile()
const loading = ref(true)
const saving = ref(false)
const errorMsg = ref('')
const saved = ref(false)
const form = ref({ full_name: '', payment_info: '' })

onMounted(load)

async function load() {
  loading.value = true
  const uid = user.value?.id
  if (!uid) { loading.value = false; return }
  const { data } = await getProfile(uid)
  if (data) {
    form.value = {
      full_name: data.full_name ?? '',
      payment_info: data.payment_info ?? '',
    }
  }
  loading.value = false
}

async function save() {
  saving.value = true
  errorMsg.value = ''
  saved.value = false
  const { error } = await updateProfile({
    full_name: form.value.full_name,
    payment_info: form.value.payment_info,
  })
  if (error) {
    errorMsg.value = 'Lưu không thành công. Kiểm tra kết nối rồi thử lại.'
  } else {
    saved.value = true
  }
  saving.value = false
}
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Hồ sơ"
      title="Hồ sơ của bạn"
      sub="Tên và thông tin chuyển khoản này hiện trên mọi menu bạn đăng."
    />

    <Spinner v-if="loading" />

    <AppCard v-else>
      <div class="stack">
        <div class="row">
          <Avatar :src="user?.imageUrl" :name="user?.fullName || form.full_name" :size="46" />
          <div>
            <div style="font-weight: 700">{{ user?.fullName || 'Bạn' }}</div>
            <div class="meta">Đăng nhập bằng Google</div>
          </div>
        </div>

        <hr class="divider" />

        <form class="stack" @submit.prevent="save">
          <TextField
            v-model="form.full_name"
            label="Tên hiển thị"
            placeholder="Nguyễn Văn A"
          />
          <TextArea
            v-model="form.payment_info"
            label="Thông tin chuyển khoản"
            placeholder="VCB 0123456789 — Nguyễn Văn A&#10;Momo 0907xxxxxx"
            hint="Mọi người xem thông tin này trên menu bạn đăng để chuyển khoản cho bạn."
            :rows="3"
          />
          <p v-if="errorMsg" class="alert">{{ errorMsg }}</p>

          <div class="row">
            <AppButton type="submit" :loading="saving">Lưu hồ sơ</AppButton>
            <span v-if="saved" class="badge badge--paid">Đã lưu ✓</span>
          </div>
        </form>
      </div>
    </AppCard>
  </div>
</template>

<style scoped>
.ocr-mode-selector-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}

.ocr-mode-card {
  display: flex;
  align-items: flex-start;
  padding: 1rem;
  background: var(--bg, #fff);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  position: relative;
}

.ocr-mode-card:hover {
  border-color: rgba(220, 180, 100, 0.5);
  background: rgba(250, 246, 239, 0.4);
}

.ocr-mode-card.active {
  border-color: #dcb464;
  background: rgba(250, 246, 239, 0.85);
  box-shadow: 0 2px 8px rgba(220, 180, 100, 0.08);
}

.ocr-radio-input {
  margin-top: 0.25rem;
  margin-right: 0.75rem;
  accent-color: #dcb464;
  cursor: pointer;
}

.ocr-card-content {
  flex: 1;
}

.ocr-card-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.25rem;
}

.ocr-card-icon {
  font-size: 1.1rem;
}

.ocr-card-title {
  font-weight: 700;
  font-size: var(--fs-sm);
  color: var(--primary-ink);
}

.ocr-card-badge {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 0.1rem 0.35rem;
  background: var(--primary-ink);
  color: #fff;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.ocr-card-desc {
  font-size: var(--fs-xs);
  color: var(--ink-soft);
  margin: 0;
  line-height: 1.4;
}

.ocr-mode-banner-info {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  background: rgba(220, 180, 100, 0.08);
  border: 1px dashed rgba(220, 180, 100, 0.3);
  border-radius: var(--radius);
  margin-bottom: 1.25rem;
  font-size: var(--fs-sm);
  color: var(--primary-ink);
}

.ocr-mode-banner-info .icon {
  font-size: 1.2rem;
}

.ocr-mode-banner-info .text {
  line-height: 1.4;
}

.ocr-mode-inputs-card {
  padding: 1.25rem;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  margin-bottom: 1.25rem;
}

.ocr-advanced-toggle-wrap {
  margin-top: 0.5rem;
}

.ocr-advanced-toggle-btn {
  background: none;
  border: none;
  font-size: var(--fs-xs);
  font-weight: 600;
  color: #dcb464;
  cursor: pointer;
  padding: 0.25rem 0;
  display: inline-flex;
  align-items: center;
}

.ocr-advanced-toggle-btn:hover {
  text-decoration: underline;
}

.ocr-advanced-panel {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px dashed var(--line);
}
</style>

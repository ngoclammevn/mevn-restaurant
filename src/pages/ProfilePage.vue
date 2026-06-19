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
  // No row yet (fresh login) is fine — App.vue's ensureProfile creates it.
  if (data) form.value = { full_name: data.full_name ?? '', payment_info: data.payment_info ?? '' }
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
  if (error) errorMsg.value = 'Lưu không thành công. Kiểm tra kết nối rồi thử lại.'
  else saved.value = true
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

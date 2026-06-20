<script setup>
import { ref, computed } from 'vue'
import { useMenus } from '../composables/useMenus'
import { todayInVN, formatVNDate } from '../lib/date'
import { AppCard, AppButton, TextArea, PageHeader } from '../components/ui'

const { createMenu } = useMenus()

const menuDate = ref(todayInVN())
const title = computed(() => `Đặt cơm trưa ngày ${formatVNDate(menuDate.value)}`)
const note = ref('')
const imageFile = ref(null)
const imagePreview = ref(null)

const posting = ref(false)
const errorMsg = ref('')
const posted = ref(false)

function onFile(e) {
  const file = e.target.files[0] ?? null
  if (imagePreview.value) {
    URL.revokeObjectURL(imagePreview.value)
    imagePreview.value = null
  }
  imageFile.value = file
  if (file) {
    imagePreview.value = URL.createObjectURL(file)
  }
}

const fileInputEl = ref(null)

function resetForm() {
  note.value = ''
  menuDate.value = todayInVN()
  imageFile.value = null
  if (imagePreview.value) {
    URL.revokeObjectURL(imagePreview.value)
    imagePreview.value = null
  }
  if (fileInputEl.value) fileInputEl.value.value = ''
}

async function submit() {
  errorMsg.value = ''

  if (!imageFile.value && !note.value.trim()) {
    errorMsg.value = 'Menu cần có ít nhất ảnh hoặc mô tả món ăn.'
    return
  }

  posting.value = true
  const { error } = await createMenu({
    title: title.value.trim(),
    menu_date: menuDate.value || todayInVN(),
    note: note.value.trim() || null,
    imageFile: imageFile.value,
  })
  posting.value = false

  if (error) {
    errorMsg.value = 'Đăng menu không thành công. Kiểm tra kết nối rồi thử lại.'
    return
  }

  posted.value = true
  resetForm()
}
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Đăng cơm"
      title="Đăng menu hôm nay"
      sub="Đăng ảnh hoặc gõ mô tả món — mọi người sẽ đặt theo."
    />

    <AppCard>
      <div class="stack">

        <!-- Success state -->
        <template v-if="posted">
          <div class="stack-sm">
            <span class="badge badge--paid">Đã đăng ✓</span>
            <p class="meta">Menu của bạn đã được đăng thành công.</p>
          </div>
          <div class="row">
            <AppButton :to="'/'">Xem menu hôm nay</AppButton>
            <AppButton variant="ghost" @click="posted = false">Đăng thêm menu</AppButton>
          </div>
        </template>

        <!-- Form state -->
        <form v-else class="stack" @submit.prevent="submit">

          <!-- Date -->
          <div class="field">
            <label>Ngày</label>
            <input
              v-model="menuDate"
              type="date"
              class="input"
            />
          </div>

          <!-- Title (auto-generated from date) -->
          <div class="field">
            <label>Tiêu đề</label>
            <p class="title-preview">{{ title }}</p>
          </div>

          <!-- Note / text menu -->
          <TextArea
            v-model="note"
            label="Mô tả món ăn"
            placeholder="Cơm tấm sườn bì chả — 45k&#10;Bún bò Huế — 40k&#10;..."
            hint="Gõ menu dạng text nếu không có ảnh, hoặc bổ sung thêm ảnh bên dưới."
            :rows="5"
          />

          <!-- Image upload -->
          <div class="field">
            <label>Ảnh menu</label>
            <input
              ref="fileInputEl"
              type="file"
              accept="image/*"
              class="input"
              style="padding: 0.45rem 0.8rem; cursor: pointer;"
              @change="onFile"
            />
            <span class="hint">Menu cần có ảnh hoặc mô tả text (hoặc cả hai).</span>
          </div>

          <!-- Image preview -->
          <div v-if="imagePreview" class="preview-wrap">
            <img :src="imagePreview" alt="Xem trước ảnh menu" class="preview-img" />
          </div>

          <!-- Validation error -->
          <p v-if="errorMsg" class="alert">{{ errorMsg }}</p>

          <div class="row">
            <AppButton type="submit" :loading="posting">Đăng menu</AppButton>
          </div>

        </form>
      </div>
    </AppCard>
  </div>
</template>

<style scoped>
.title-preview {
  font-weight: 700;
  font-size: var(--fs-base);
  color: var(--ink);
}
.preview-wrap {
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--line);
  background: var(--bg-tint);
}
.preview-img {
  width: 100%;
  max-height: 260px;
  object-fit: cover;
  display: block;
}
</style>

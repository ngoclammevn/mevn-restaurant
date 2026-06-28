<script setup>
import { ref, watch, onMounted } from 'vue'
import { useUser } from '@clerk/vue'
import { useProfile } from '../composables/useProfile'
import { AppCard, AppButton, Avatar, TextField, TextArea, PageHeader, Spinner, EmptyState, SignInModal } from '../components/ui'

const { user, isSignedIn } = useUser()
const { getProfile, updateProfile } = useProfile()
const loading = ref(true)
const saving = ref(false)
const errorMsg = ref('')
const saved = ref(false)
const form = ref({ full_name: '', payment_info: '' })
const showSignIn = ref(false)

const LIST_BANKS = [
  { code: 'VCB', name: 'Vietcombank', bin: '970436' },
  { code: 'TCB', name: 'Techcombank', bin: '970407' },
  { code: 'MB', name: 'MBBank', bin: '970422' },
  { code: 'BIDV', name: 'BIDV', bin: '970418' },
  { code: 'CTG', name: 'VietinBank', bin: '970415' },
  { code: 'ACB', name: 'ACB', bin: '970416' },
  { code: 'TPB', name: 'TPBank', bin: '970423' },
  { code: 'VPB', name: 'VPBank', bin: '970432' },
  { code: 'OCB', name: 'OCB', bin: '970448' },
  { code: 'VIB', name: 'VIB', bin: '970441' },
  { code: 'MSB', name: 'MSB', bin: '970426' },
  { code: 'STB', name: 'Sacombank', bin: '970403' }
]

const useStructured = ref(true)
const bankCode = ref('')
const accountNumber = ref('')
const accountName = ref('')
const momoPhone = ref('')
function removeVietnameseTones(str) {
  if (!str) return '';
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g,"a"); 
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g,"e"); 
  str = str.replace(/ì|í|ị|ỉ|ĩ/g,"i"); 
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g,"o"); 
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g,"u"); 
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g,"y"); 
  str = str.replace(/đ/g,"d");
  str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
  str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
  str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
  str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
  str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
  str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
  str = str.replace(/Đ/g, "D");
  return str.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, " ");
}

watch(accountName, (newVal) => {
  accountName.value = removeVietnameseTones(newVal).toUpperCase()
})

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
    
    // Parse structured payment info
    const text = data.payment_info ?? ''
    const matchStk = text.match(/STK:\s*([a-zA-Z0-9]+)/)
    const matchNh = text.match(/NH:\s*([a-zA-Z0-9]+)/)
    const matchCtk = text.match(/CTK:\s*(.+)/)
    const matchMomo = text.match(/Momo:\s*([0-9]+)/)

    if (matchStk && matchNh) {
      useStructured.value = true
      accountNumber.value = matchStk[1]
      bankCode.value = matchNh[1]
      accountName.value = matchCtk ? matchCtk[1].trim() : ''
      momoPhone.value = matchMomo ? matchMomo[1].trim() : ''
    } else {
      useStructured.value = false
    }
  }
  loading.value = false
}

async function save() {
  saving.value = true
  errorMsg.value = ''
  saved.value = false

  if (useStructured.value) {
    const parts = [
      `STK: ${accountNumber.value.trim()}`,
      `NH: ${bankCode.value.trim()}`,
      accountName.value.trim() ? `CTK: ${accountName.value.trim()}` : '',
      momoPhone.value.trim() ? `Momo: ${momoPhone.value.trim()}` : ''
    ].filter(Boolean)
    form.value.payment_info = parts.join('\n')
  }

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

    <div v-if="!isSignedIn" style="margin-top: 1.5rem">
      <EmptyState
        title="Chưa đăng nhập"
        description="Đăng nhập để cập nhật tên hiển thị và thông tin chuyển khoản của bạn."
        icon="👤"
      >
        <AppButton @click="showSignIn = true">Đăng nhập</AppButton>
      </EmptyState>
    </div>

    <div v-else>
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
          <div class="field">
            <label class="label-toggle">
              <input type="checkbox" v-model="useStructured" />
              <span>Tự động tạo mã QR khi thanh toán</span>
            </label>
          </div>

          <template v-if="useStructured">
            <div class="row row-equal">
              <div class="field flex-1">
                <label class="label">Ngân hàng</label>
                <select v-model="bankCode" class="select-field">
                  <option value="">Chọn ngân hàng</option>
                  <option v-for="b in LIST_BANKS" :key="b.code" :value="b.code">{{ b.name }} ({{ b.code }})</option>
                </select>
              </div>
              <div class="field flex-1">
                <label class="label">Số tài khoản</label>
                <input type="text" class="input-field" v-model="accountNumber" placeholder="Nhập STK" />
              </div>
            </div>
            <TextField v-model="accountName" label="Tên chủ tài khoản (Viết hoa không dấu)" placeholder="NGUYEN VAN A" />
            <TextField v-model="momoPhone" label="Số điện thoại MoMo (Tùy chọn)" placeholder="0907123456" />

            <!-- QR Preview -->
            <div v-if="bankCode && accountNumber" class="qr-preview-box">
              <div class="eyebrow">Xem trước mã QR của bạn (giá trị mặc định 10.000 đ):</div>
              <img :src="`https://img.vietqr.io/image/${bankCode}-${accountNumber}-compact2.png?amount=10000&addInfo=TEST%20QR&accountName=${encodeURIComponent(accountName)}`" class="qr-preview-img" />
              <div class="meta text-center">Hãy quét thử bằng app ngân hàng để kiểm tra tính chính xác.</div>
            </div>
          </template>
          <template v-else>
            <TextArea
              v-model="form.payment_info"
              label="Thông tin chuyển khoản tự do"
              placeholder="VCB 0123456789 — Nguyễn Văn A&#10;Momo 0907xxxxxx"
              hint="Mọi người xem thông tin này trên menu bạn đăng để chuyển khoản cho bạn."
              :rows="3"
            />
          </template>
          <p v-if="errorMsg" class="alert">{{ errorMsg }}</p>

          <div class="row">
            <AppButton type="submit" :loading="saving">Lưu hồ sơ</AppButton>
            <span v-if="saved" class="badge badge--paid">Đã lưu ✓</span>
          </div>
        </form>
      </div>
    </AppCard>
    <SignInModal v-if="showSignIn" @close="showSignIn = false" />
    </div>
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

.label-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  cursor: pointer;
}
.row-equal {
  display: flex;
  gap: 1rem;
}
.flex-1 {
  flex: 1;
}
.select-field {
  width: 100%;
  padding: 0.55rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  color: var(--ink);
  font-family: inherit;
  font-size: var(--fs-sm);
}
.qr-preview-box {
  border: 1px dashed var(--line);
  padding: 1.25rem;
  border-radius: var(--radius);
  background: var(--bg-soft);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
}
.qr-preview-img {
  max-width: 200px;
  height: auto;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
.text-center {
  text-align: center;
}
</style>

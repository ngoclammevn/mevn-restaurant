<script setup>
import { ref, watch, onUnmounted } from 'vue'
import { useUser } from '@clerk/vue'
import { useProfile } from '../composables/useProfile'
import { LIST_BANKS } from '../lib/banks'
import { AppButton, Avatar, PageHeader, Spinner, EmptyState, SignInModal } from '../components/ui'
const { user, isSignedIn } = useUser(), { getProfile, updateProfile } = useProfile()
const profileLoaded = ref(false)
const loading = ref(false), saving = ref(false), errorMsg = ref(''), saved = ref(false), showSignIn = ref(false)
const fullName = ref(''), paymentInfo = ref(''), structured = ref(true), method = ref('bank')
const bankCode = ref(''), accountNumber = ref(''), accountName = ref(''), momoPhone = ref(''), momoPsp = ref('')
let generation = 0
watch(accountName, value => { accountName.value = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'D').replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, ' ').toUpperCase() })
watch(() => user.value?.id, load, { immediate: true })
onUnmounted(() => { generation++ })
async function load() {
  const current = ++generation, uid = user.value?.id
  fullName.value = ''; paymentInfo.value = ''; bankCode.value = ''; accountNumber.value = ''; accountName.value = ''; momoPhone.value = ''; momoPsp.value = ''
  errorMsg.value = ''; saved.value = false; saving.value = false; profileLoaded.value = false
  if (!uid) { loading.value = false; return }
  loading.value = true
  try {
    const result = await getProfile(uid)
    if (current !== generation || uid !== user.value?.id) return
    if (result.error) throw result.error
    fullName.value = result.data?.full_name ?? ''; paymentInfo.value = result.data?.payment_info ?? ''
    const text = paymentInfo.value
    const field = key => text.match(new RegExp(`^${key}:\\s*(.*)$`, 'mi'))?.[1]?.trim() ?? ''
    bankCode.value = field('NH'); accountNumber.value = field('STK'); accountName.value = field('CTK'); momoPhone.value = field('Momo'); momoPsp.value = field('MomoPSP')
    structured.value = !text.trim() || !!(bankCode.value || accountNumber.value || momoPhone.value)
    profileLoaded.value = true
  } catch { if (current === generation) errorMsg.value = 'Chưa tải được hồ sơ. Thử lại.' }
  finally { if (current === generation) loading.value = false }
}
async function save() {
  const uid = user.value?.id, current = generation
  if (!uid || saving.value || !profileLoaded.value) return
  saving.value = true; errorMsg.value = ''; saved.value = false
  const text = structured.value ? [accountNumber.value.trim() && `STK: ${accountNumber.value.trim()}`, bankCode.value && `NH: ${bankCode.value}`, accountName.value.trim() && `CTK: ${accountName.value.trim()}`, momoPhone.value.trim() && `Momo: ${momoPhone.value.trim()}`, momoPsp.value && `MomoPSP: ${momoPsp.value}`].filter(Boolean).join('\n') : paymentInfo.value
  try {
    const result = await updateProfile({ full_name: fullName.value.trim(), payment_info: text })
    if (current !== generation || uid !== user.value?.id) return
    if (result.error) throw result.error
    paymentInfo.value = text; saved.value = true
  } catch { if (current === generation) errorMsg.value = 'Chưa lưu được hồ sơ. Kiểm tra kết nối rồi thử lại.' }
  finally { if (current === generation) saving.value = false }
}
</script>
<template><div class="stack">
  <PageHeader title="Cá nhân" sub="Tên và thông tin nhận tiền trên menu bạn đăng." />
  <EmptyState v-if="!isSignedIn" title="Đăng nhập để xem hồ sơ"><AppButton @click="showSignIn = true">Đăng nhập</AppButton></EmptyState>
  <template v-else><Spinner v-if="loading" label="Đang tải hồ sơ…" /><div v-else class="profile-grid">
    <form class="card stack" @submit.prevent="save">
      <div class="row"><Avatar :src="user?.imageUrl" :name="fullName || user?.fullName" :size="46" /><div><h2 class="section-title">{{ fullName || user?.fullName || 'Hồ sơ của tôi' }}</h2><p class="meta">{{ user?.primaryEmailAddress?.emailAddress }}</p></div></div>
      <fieldset :disabled="saving || !profileLoaded" class="stack profile-fields">
        <label class="field">Tên hiển thị<input v-model="fullName" class="input" autocomplete="name" /></label>
        <div class="stack-sm"><h2 class="section-title">Thông tin nhận tiền</h2><p class="meta">Mọi người thấy thông tin này khi thanh toán menu của bạn.</p></div>
        <label class="row profile-choice"><input v-model="structured" type="checkbox" /> Tạo mã QR từ thông tin tài khoản</label>
        <template v-if="structured">
          <div class="profile-tabs" role="group" aria-label="Thông tin nhận tiền"><button type="button" :aria-pressed="method === 'bank'" :class="{ active: method === 'bank' }" @click="method = 'bank'">Ngân hàng</button><button type="button" :aria-pressed="method === 'momo'" :class="{ active: method === 'momo' }" @click="method = 'momo'">MoMo</button></div>
          <div v-show="method === 'bank'" class="stack-sm"><label class="field">Ngân hàng<select v-model="bankCode" class="input"><option value="">Chọn ngân hàng</option><option v-for="bank in LIST_BANKS" :key="bank.code" :value="bank.code">{{ bank.name }} ({{ bank.code }})</option></select></label><label class="field">Số tài khoản<input v-model.trim="accountNumber" class="input" inputmode="numeric" /></label><label class="field">Tên chủ tài khoản<input v-model="accountName" class="input" placeholder="NGUYEN VAN A" /><span class="hint">Tên được chuyển sang chữ hoa không dấu.</span></label></div>
          <label v-show="method === 'momo'" class="field">Số điện thoại MoMo<input v-model.trim="momoPhone" class="input" type="tel" autocomplete="tel" /><span class="hint">Có thể lưu cả ngân hàng và MoMo.</span></label>
          <p v-if="(!bankCode || !accountNumber) && !momoPhone" class="meta">Bạn có thể thêm thông tin nhận tiền sau.</p><details v-if="accountNumber || momoPhone"><summary>Thông tin người nhận</summary><dl class="profile-preview"><dt>Người nhận</dt><dd>{{ accountName || fullName }}</dd><template v-if="accountNumber"><dt>Ngân hàng</dt><dd>{{ bankCode || 'Chưa chọn ngân hàng' }}</dd><dt>Số tài khoản</dt><dd>{{ accountNumber }}</dd></template><template v-if="momoPhone"><dt>MoMo</dt><dd>{{ momoPhone }}</dd></template></dl></details>
        </template>
        <label v-else class="field">Thông tin chuyển khoản<textarea v-model="paymentInfo" class="input" rows="4" placeholder="Ngân hàng, số tài khoản, tên người nhận…" /></label>
      </fieldset>
      <p v-if="errorMsg" class="alert" role="alert">{{ errorMsg }} <button v-if="!profileLoaded" type="button" @click="load">Thử lại</button></p>
      <div class="row-wrap"><AppButton type="submit" :loading="saving" :disabled="!profileLoaded">Lưu thông tin</AppButton><span v-if="saved" role="status" class="meta">Đã lưu</span></div>
    </form>
    <section class="card stack"><h2 class="section-title">Của tôi</h2><router-link class="profile-link" to="/history">Lịch cơm <span aria-hidden="true">→</span></router-link><router-link class="profile-link" to="/taste">Khẩu vị của tôi <span aria-hidden="true">→</span></router-link><router-link class="profile-link" to="/my-menus">Menu đã đăng <span aria-hidden="true">→</span></router-link></section>
  </div></template><SignInModal v-if="showSignIn" @close="showSignIn = false" />
</div></template>
<style scoped>
.profile-preview { margin:0; }.profile-preview dt { font-size:var(--fs-sm); color:var(--ink-soft); }.profile-preview dd { margin:0 0 .7rem; overflow-wrap:anywhere; }.profile-grid { display:grid; grid-template-columns:minmax(0,1.6fr) minmax(230px,1fr); gap:1.25rem; align-items:start; }.profile-fields { margin:0; padding:0; border:0; min-width:0; }.profile-choice { min-height:44px; cursor:pointer; }
.profile-tabs { display:flex; gap:1rem; border-bottom:1px solid var(--line); }.profile-tabs button { min-height:44px; padding:.5rem 0; border:0; border-bottom:2px solid transparent; background:none; cursor:pointer; }.profile-tabs button.active { border-bottom-color:var(--ink); font-weight:600; }.profile-link { display:flex; justify-content:space-between; align-items:center; min-height:44px; color:var(--ink); border-bottom:1px solid var(--line); text-decoration:none; }@media(max-width:700px) { .profile-grid { grid-template-columns:1fr; } }
</style>

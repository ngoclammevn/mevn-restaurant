<script setup>
import { ref, watch, onUnmounted } from 'vue'
import { useUser, UserButton } from '@clerk/vue'
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
<template><div class="stack profile-page">
  <PageHeader eyebrow="Hồ sơ" title="Thông tin của bạn" sub="Tên và thông tin chuyển khoản xuất hiện trên menu bạn đăng." />
  <EmptyState v-if="!isSignedIn" title="Đăng nhập để xem hồ sơ"><AppButton @click="showSignIn = true">Đăng nhập</AppButton></EmptyState>
  <template v-else><Spinner v-if="loading" label="Đang tải hồ sơ…" /><div v-else class="profile-grid">
    <form class="card profile-card" @submit.prevent="save">
      <div class="profile-identity"><Avatar :src="user?.imageUrl" :name="fullName || user?.fullName" :size="46" /><div><strong>{{ fullName || user?.fullName || 'Hồ sơ của tôi' }}</strong><p class="meta">{{ user?.primaryEmailAddress?.emailAddress }} · Đăng nhập Google</p></div><div class="profile-account"><span class="meta">Tài khoản</span><UserButton /></div></div>
      <fieldset :disabled="saving || !profileLoaded" class="profile-fields">
        <div class="profile-divide"><label class="field">Tên hiển thị<input v-model="fullName" class="input" autocomplete="name" /></label></div>
        <h2>Thông tin nhận chuyển khoản</h2>
        <div class="profile-tabs" role="group" aria-label="Cách nhập thông tin chuyển khoản"><button type="button" :aria-pressed="structured && method === 'bank'" @click="structured = true; method = 'bank'">Ngân hàng</button><button type="button" :aria-pressed="structured && method === 'momo'" @click="structured = true; method = 'momo'">MoMo</button><button type="button" :aria-pressed="!structured" @click="structured = false">Nhập tự do</button></div>
        <div v-if="structured">
          <div v-show="method === 'bank'"><div class="profile-form-columns"><label class="field">Ngân hàng<select v-model="bankCode" class="input"><option value="">Chọn ngân hàng</option><option v-for="bank in LIST_BANKS" :key="bank.code" :value="bank.code">{{ bank.name }} ({{ bank.code }})</option></select></label><label class="field">Số tài khoản<input v-model.trim="accountNumber" class="input" inputmode="numeric" /></label></div><label class="field">Tên chủ tài khoản · Viết hoa không dấu<input v-model="accountName" class="input" placeholder="NGUYEN VAN A" /></label><p class="meta profile-note">Mã QR khi thanh toán được tạo từ ngân hàng và số tài khoản này.</p><div v-if="accountNumber" class="profile-payment-example"><strong>Thông tin người nhận</strong><p>{{ bankCode || 'Chưa chọn ngân hàng' }} · {{ accountNumber }}<br />{{ accountName || fullName }}</p></div></div>
          <div v-show="method === 'momo'"><label class="field">Số điện thoại MoMo · Không bắt buộc<input v-model.trim="momoPhone" class="input" type="tel" autocomplete="tel" placeholder="Nhập số điện thoại" /></label><p class="meta profile-note">MoMo bổ sung cho thông tin ngân hàng; đổi tab không xóa tài khoản đã nhập.</p></div>
          <p v-if="(!bankCode || !accountNumber) && !momoPhone" class="profile-warning">Bạn chưa có đủ thông tin chuyển khoản. Có thể bổ sung sau khi lưu hồ sơ.</p>
        </div>
        <label v-else class="field">Thông tin chuyển khoản tự do<textarea v-model="paymentInfo" class="input" rows="4" placeholder="Ngân hàng, số tài khoản hoặc MoMo…" /></label>
      </fieldset>
      <p v-if="errorMsg" class="alert" role="alert">{{ errorMsg }} <button v-if="!profileLoaded" type="button" @click="load">Thử lại</button></p>
      <div class="row-wrap profile-divide profile-save"><AppButton type="submit" :loading="saving" :disabled="!profileLoaded">Lưu hồ sơ</AppButton><span v-if="saved" role="status" class="meta">Đã lưu</span></div>
      <p class="profile-private">Khi bạn ở Hồ sơ, nhóm chỉ thấy bạn đang online.</p>
    </form>
    <aside class="profile-aside"><section class="card"><h2>Cá nhân</h2><div class="profile-link-list"><router-link class="profile-link" to="/history">Lịch ăn của bạn <span aria-hidden="true">→</span></router-link><router-link class="profile-link" to="/taste">Khẩu vị của tôi <span aria-hidden="true">→</span></router-link><router-link class="profile-link" to="/my-menus">Menu bạn đăng <span aria-hidden="true">→</span></router-link><router-link class="profile-link" to="/dashboard">Theo dõi người chưa trả <span aria-hidden="true">→</span></router-link></div></section><section class="card"><h3>Đăng menu cho nhóm?</h3><p class="meta profile-note">Bạn là người thu tiền của menu mình đăng. Mỗi người vẫn tự xác nhận đã trả.</p><AppButton to="/post">Đăng menu</AppButton></section></aside>
  </div></template><SignInModal v-if="showSignIn" @close="showSignIn = false" />
</div></template>
<style scoped>
.profile-page :deep(.btn){font-size:14px;border-radius:11px;padding:10px 15px;}
.profile-grid { display:grid; grid-template-columns:minmax(0,1.5fr) minmax(270px,1fr); gap:22px; align-items:start; }.profile-card h2,.profile-aside h2 { font-size:20px; margin:0 0 8px; }.profile-aside h3 { font-size:17px; margin:0; }.profile-identity { display:flex; align-items:center; gap:12px; }.profile-account { margin-left:auto; display:flex; align-items:center; gap:8px; }.profile-identity > div:nth-child(2) { min-width:0; flex:1; }.profile-identity strong { overflow-wrap:anywhere; }.profile-account { flex:none; }.profile-identity p { margin:4px 0 0; font-size:13px; }.profile-fields { padding:0; margin:0; min-width:0; border:0; }.profile-divide { margin-top:21px; padding-top:20px; border-top:1px solid var(--line); }.profile-card .field { display:grid; gap:7px; font-size:14px; font-weight:600; margin:16px 0; }.profile-card .input { min-height:46px; font-weight:400; padding:11px 12px; border-radius:10px; }.profile-form-columns { display:grid; grid-template-columns:1fr 1fr; gap:15px; }.profile-form-columns .field { min-width:0; }.profile-tabs { display:flex; gap:8px; flex-wrap:wrap; margin:17px 0; }.profile-tabs button { min-height:44px; border:1px solid var(--line-strong); border-radius:11px; padding:10px 15px; background:var(--card); font-size:14px; cursor:pointer; }.profile-tabs button[aria-pressed=true] { background:#f1f3ec; border-color:#bbc4b0; color:#303c25; }.profile-note { margin:14px 0 17px; font-size:13px; }.profile-payment-example { padding:15px; border-radius:12px; background:var(--bg-tint); font-size:13px; margin-top:17px; }.profile-payment-example p { margin:8px 0 0; }.profile-warning { font-size:13px; border:1px solid #e4ce9e; background:#fff7e6; padding:12px 14px; border-radius:10px; color:#805c1b; margin-top:14px; }.profile-private { margin-top:20px; padding-left:12px; border-left:3px solid var(--line-strong); font-size:12px; color:var(--ink-soft); }.profile-aside { display:grid; gap:18px; }.profile-link-list { display:grid; gap:9px; margin-top:17px; }.profile-link { display:flex; justify-content:space-between; align-items:center; min-height:44px; border:1px solid var(--line-strong); border-radius:11px; padding:10px 15px; text-decoration:none; color:var(--ink); font-size:14px; }.profile-save { justify-content:space-between; }
@media(max-width:640px) { .profile-grid { grid-template-columns:1fr; gap:18px; }.profile-form-columns { grid-template-columns:1fr; gap:0; }.profile-form-columns .field + .field { margin-top:0; }.profile-tabs button { flex:1; padding:10px 11px; }.profile-identity p { overflow-wrap:anywhere; }.profile-account > span { display:none; } }
</style>

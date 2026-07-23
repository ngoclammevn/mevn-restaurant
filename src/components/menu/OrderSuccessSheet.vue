<script setup>
import AppButton from '../ui/AppButton.vue'

defineProps({
  order: { type: Object, required: true },
  orderedForName: { type: String, default: '' },
  canPay: { type: Boolean, default: false },
  hasPaymentInfo: { type: Boolean, default: false },
})

const emit = defineEmits(['pay', 'later', 'copy-link'])
</script>

<template>
  <div class="success-sheet__overlay" role="presentation">
    <section class="success-sheet" role="dialog" aria-modal="true" aria-labelledby="order-success-title">
      <span class="success-sheet__icon" aria-hidden="true">✓</span>
      <p class="eyebrow">Đặt món thành công</p>
      <h2 id="order-success-title">
        {{ canPay ? 'Đơn của bạn đã được gửi' : `Đã đặt giúp ${orderedForName}` }}
      </h2>
      <p v-if="canPay && !hasPaymentInfo" class="meta">
        Người đăng chưa thêm thông tin chuyển khoản.
      </p>
      <div class="success-sheet__actions">
        <template v-if="canPay">
          <AppButton data-testid="success-pay" @click="emit('pay')">
            Thanh toán ngay
          </AppButton>
          <AppButton data-testid="success-later" variant="ghost" @click="emit('later')">
            Để sau
          </AppButton>
        </template>
        <AppButton v-else data-testid="success-copy-link" @click="emit('copy-link')">
          Sao chép link menu
        </AppButton>
      </div>
    </section>
  </div>
</template>

<style scoped>
.success-sheet__overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(20, 28, 23, 0.45);
  backdrop-filter: blur(4px);
}

.success-sheet {
  width: min(100%, 28rem);
  padding: 1.5rem;
  text-align: center;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 1rem;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.2);
}

.success-sheet__icon {
  display: inline-grid;
  width: 3rem;
  height: 3rem;
  place-items: center;
  margin-bottom: 0.5rem;
  color: white;
  font-size: 1.5rem;
  font-weight: 700;
  background: var(--primary);
  border-radius: 50%;
}

.success-sheet h2 {
  margin: 0.25rem 0 0.5rem;
  font-size: 1.35rem;
}

.success-sheet__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 1.25rem;
}
</style>

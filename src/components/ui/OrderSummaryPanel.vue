<script setup>
import { computed, ref } from 'vue'
import { summarizeManagedMenu } from '../../lib/manage-summary'

const props = defineProps({
  orders:   { type: Array,  required: true },
  menuNote: { type: String, default: '' },
  isClosed: { type: Boolean, default: false },
  beforeCopy: { type: Function, default: null },
})

const emit = defineEmits(['copied', 'reopen'])

const summary = computed(() => summarizeManagedMenu({ note:props.menuNote, orders:props.orders }).orderedDishes.map(row => ({
  displayName:row.name, count:row.servings, total:row.unknownPriceCount ? null : row.knownTotal,
  peopleLabel:row.people.length > 3 ? `${row.people.slice(0,3).map(p=>p.name).join(', ')} +${row.people.length-3} khác` : row.people.map(p=>p.name).join(', '),
})))

const totalParts = computed(() => summary.value.reduce((s, e) => s + e.count, 0))

const grandTotal = computed(() => {
  if (!summary.value.length) return null
  const totals = summary.value.map(e => e.total)
  if (totals.some(t => t === null)) return null
  return totals.reduce((s, t) => s + t, 0)
})

function fmt(val) {
  if (val == null) return ''
  return new Intl.NumberFormat('vi-VN').format(val) + 'đ'
}

const copied = ref(false), copying = ref(false), copyError = ref('')

const copyText = computed(() => {
  const lines = summary.value.map(e =>
    `• ${e.displayName} ×${e.count}${e.total != null ? ` — ${fmt(e.total)}` : ''}`
  )
  const head = `🛒 DANH SÁCH CẦN MUA — ${totalParts.value} phần`
  const tail = grandTotal.value != null ? `Tổng ${totalParts.value} phần: ${fmt(grandTotal.value)}` : ''
  return [head, ...lines, tail].filter(Boolean).join('\n')
})

async function copyList() {
  if (copying.value) return
  copying.value = true; copyError.value = ''
  try {
    if (props.beforeCopy && !(await props.beforeCopy())) return
    await navigator.clipboard.writeText(copyText.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
    emit('copied')
  } catch {
    // ponytail: clipboard blocked (http / denied) — báo cho user tự copy tay
    copyError.value = 'Chưa sao chép được. Bạn có thể chọn và sao chép danh sách bên dưới.'
  } finally { copying.value = false }
}
</script>

<template>
  <div v-if="summary.length" class="osp-wrap">


    <!-- Header -->
    <div class="osp-header">
      <span class="eyebrow">Danh sách cần mua</span>
      <span class="osp-header-right">
        <button
          v-if="isClosed"
          type="button"
          class="osp-reopen"
          title="Mở lại nhận đơn"
          @click="emit('reopen')"
        >Mở lại nhận đơn</button>
        <button
          type="button"
          class="osp-copy"
          :disabled="copying"
          :class="{ 'osp-copy--done': copied }"
          :title="copied ? 'Đã copy' : isClosed ? 'Copy danh sách' : 'Copy danh sách (sẽ chốt đơn)'"
          @click="copyList"
        >{{ copied ? 'Đã sao chép' : isClosed ? 'Sao chép danh sách' : 'Sao chép & chốt đơn' }}</button>
        <span class="badge badge--paid osp-badge">{{ totalParts }} phần</span>
      </span>
    </div>

    <div class="osp-divider" />

    <p v-if="copyError" class="alert" role="alert">{{ copyError }}</p>
    <!-- Rows -->
    <div class="osp-body">
      <div v-for="(item, i) in summary" :key="i">
        <div class="osp-row">
          <span class="osp-dish">{{ item.displayName }}</span>
          <span class="osp-count">×{{ item.count }}</span>
          <span class="osp-people">{{ item.peopleLabel }}</span>
          <span v-if="item.total !== null" class="osp-price">{{ fmt(item.total) }}</span>
        </div>
      </div>
    </div>

    <!-- Total (chỉ hiện khi tất cả món đều có giá) -->
    <template v-if="grandTotal !== null">
      <div class="osp-divider" />
      <div class="osp-total">
        <span>Tổng {{ totalParts }} phần</span>
        <span class="osp-total-price">{{ fmt(grandTotal) }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.osp-wrap {
  position: relative;
  overflow: hidden;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  padding: 0.85rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.osp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.osp-header-right {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.osp-copy {
  min-height: 44px;
  border: 1px solid var(--line);
  background: transparent;
  border-radius: var(--radius-pill);
  padding: 0.1rem 0.45rem;
  font-size: var(--fs-xs);
  line-height: 1.4;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.osp-copy:hover {
  background: var(--bg-tint);
}

.osp-copy--done {
  color: var(--ink);
  border-color: var(--primary);
}

.osp-reopen {
  min-height: 44px;
  border: 1px solid var(--line);
  background: transparent;
  border-radius: var(--radius-pill);
  padding: 0.1rem 0.5rem;
  font-size: var(--fs-xs);
  line-height: 1.4;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
}

.osp-reopen:hover {
  background: var(--bg-tint);
}

.osp-badge {
  font-size: var(--fs-xs);
  padding: 0.15rem 0.6rem;
}

.osp-divider {
  height: 1px;
  background: var(--line);
}

.osp-body {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.osp-row {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding: 0.1rem 0;
}

.osp-dish {
  font-weight: 600;
  font-size: var(--fs-sm);
  color: var(--ink);
  flex-shrink: 0;
  max-width: 40%;
}

.osp-count {
  background: var(--bg-tint);
  color: var(--ink);
  font-size: var(--fs-xs);
  font-weight: 700;
  padding: 0.05rem 0.45rem;
  border-radius: var(--radius-pill);
  flex-shrink: 0;
}

.osp-people {
  color: var(--muted);
  font-size: var(--fs-xs);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.osp-price {
  color: var(--ink);
  font-weight: 700;
  font-size: var(--fs-sm);
  margin-left: auto;
  flex-shrink: 0;
}

.osp-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 700;
  font-size: var(--fs-sm);
  color: var(--ink);
}

.osp-total-price {
  font-size: var(--fs-base);
}
</style>

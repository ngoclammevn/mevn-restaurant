<script setup>
import { computed, ref } from 'vue'
import BorderBeam from './BorderBeam.vue'
import BlurReveal from './BlurReveal.vue'

const props = defineProps({
  orders:   { type: Array,  required: true },
  menuNote: { type: String, default: '' },
})

function parseDishMap(note) {
  try {
    const parsed = JSON.parse(note)
    if (!Array.isArray(parsed.dishes)) return null
    const map = new Map()
    for (const d of parsed.dishes) {
      if (d.name) map.set(d.name.toLowerCase(), d.price ?? null)
    }
    return map
  } catch {
    return null
  }
}

const summary = computed(() => {
  const dishMap = parseDishMap(props.menuNote)
  const agg = new Map()

  for (const order of props.orders) {
    const lines = (order.item_text || '').split('\n').map(l => l.trim()).filter(Boolean)
    const personName = order.user?.full_name || '?'
    for (const line of lines) {
      const key = line.toLowerCase()
      if (!agg.has(key)) {
        const price = dishMap ? (dishMap.get(key) ?? null) : null
        agg.set(key, { displayName: line, count: 0, people: [], unitPrice: price })
      }
      const entry = agg.get(key)
      entry.count++
      entry.people.push(personName)
    }
  }

  return [...agg.values()]
    .map(e => ({
      ...e,
      total: e.unitPrice != null ? e.unitPrice * e.count : null,
      peopleLabel: e.people.length > 3
        ? `${e.people.slice(0, 3).join(', ')} +${e.people.length - 3} khác`
        : e.people.join(', '),
    }))
    .sort((a, b) => b.count - a.count || a.displayName.localeCompare(b.displayName, 'vi'))
})

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

const copied = ref(false)

const copyText = computed(() => {
  const lines = summary.value.map(e =>
    `• ${e.displayName} ×${e.count}${e.total != null ? ` — ${fmt(e.total)}` : ''}`
  )
  const head = `🛒 DANH SÁCH CẦN MUA — ${totalParts.value} phần`
  const tail = grandTotal.value != null ? `Tổng ${totalParts.value} phần: ${fmt(grandTotal.value)}` : ''
  return [head, ...lines, tail].filter(Boolean).join('\n')
})

async function copyList() {
  try {
    await navigator.clipboard.writeText(copyText.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  } catch {
    // ponytail: clipboard blocked (http / denied) — báo cho user tự copy tay
    alert('Không copy được (trình duyệt chặn clipboard). Vui lòng copy thủ công.')
  }
}
</script>

<template>
  <div v-if="summary.length" class="osp-wrap">
    <BorderBeam :size="120" :duration="8" colorFrom="#dcb464" colorTo="#1f6e45" />

    <!-- Header -->
    <div class="osp-header">
      <span class="eyebrow">🛒 Danh sách cần mua</span>
      <span class="osp-header-right">
        <button
          type="button"
          class="osp-copy"
          :class="{ 'osp-copy--done': copied }"
          :title="copied ? 'Đã copy' : 'Copy danh sách'"
          @click="copyList"
        >{{ copied ? '✓' : '📋' }}</button>
        <span class="badge badge--paid osp-badge">{{ totalParts }} phần</span>
      </span>
    </div>

    <div class="osp-divider" />

    <!-- Rows -->
    <div class="osp-body">
      <BlurReveal
        v-for="(item, i) in summary"
        :key="i"
        :delay="i * 0.05"
      >
        <div class="osp-row">
          <span class="osp-dish">{{ item.displayName }}</span>
          <span class="osp-count">×{{ item.count }}</span>
          <span class="osp-people">{{ item.peopleLabel }}</span>
          <span v-if="item.total !== null" class="osp-price">{{ fmt(item.total) }}</span>
        </div>
      </BlurReveal>
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
  background: var(--primary-soft);
  border: 1px solid rgba(31, 110, 69, 0.25);
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
  border: 1px solid rgba(31, 110, 69, 0.3);
  background: transparent;
  border-radius: var(--radius-pill);
  padding: 0.1rem 0.45rem;
  font-size: var(--fs-xs);
  line-height: 1.4;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.osp-copy:hover {
  background: rgba(31, 110, 69, 0.1);
}

.osp-copy--done {
  color: var(--primary-ink);
  border-color: var(--primary);
}

.osp-badge {
  font-size: var(--fs-xs);
  padding: 0.15rem 0.6rem;
}

.osp-divider {
  height: 1px;
  background: rgba(31, 110, 69, 0.18);
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
  background: var(--primary);
  color: #fff;
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
  color: var(--primary-ink);
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
  color: var(--primary-ink);
}

.osp-total-price {
  font-size: var(--fs-base);
}
</style>

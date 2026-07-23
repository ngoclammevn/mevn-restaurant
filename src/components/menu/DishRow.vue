<script setup>
import { computed } from 'vue'

const props = defineProps({
  dish: { type: Object, required: true },
  selected: Boolean,
})

const emit = defineEmits(['toggle'])
const controlId = computed(() => `dish-${props.dish.name}`)

function toggle() {
  emit('toggle', props.dish.name)
}
</script>

<template>
  <label
    :for="controlId"
    class="dish-row"
    :class="{ 'dish-row--selected': selected }"
    :data-testid="`dish-row-${dish.name}`"
  >
    <input
      :id="controlId"
      class="dish-row__control dish-row__control--44"
      type="checkbox"
      :checked="selected"
      @change="toggle"
    />
    <span class="dish-row__content">
      <strong>{{ dish.name }}</strong>
      <span v-if="dish.price" class="dish-row__price">{{ new Intl.NumberFormat('vi-VN').format(dish.price) }}đ</span>
    </span>
    <span v-if="selected" class="dish-row__selected-text"><span aria-hidden="true">✓</span> Đã chọn</span>
  </label>
</template>

<style scoped>
.dish-row {
  display: flex;
  align-items: center;
  gap: .8rem;
  min-height: 64px;
  padding: .55rem .8rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--card);
  cursor: pointer;
}
.dish-row--selected { border-color: var(--primary); box-shadow: inset 0 0 0 1px var(--primary); }
.dish-row__control { flex: 0 0 auto; accent-color: var(--primary); cursor: pointer; }
.dish-row__control--44 { width: 44px; height: 44px; margin: -.55rem 0; }
.dish-row__content { display: flex; min-width: 0; flex: 1; flex-direction: column; }
.dish-row__price { color: var(--muted); font-size: var(--fs-sm); }
.dish-row__selected-text { display: inline-flex; align-items: center; gap: .3rem; color: var(--primary-ink); font-size: var(--fs-sm); font-weight: 700; white-space: nowrap; }
</style>

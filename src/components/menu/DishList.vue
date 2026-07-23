<script setup>
import DishRow from './DishRow.vue'

defineProps({
  dishes: { type: Array, default: () => [] },
  selectedNames: { type: Array, default: () => [] },
})

const emit = defineEmits(['toggle'])
</script>

<template>
  <div class="dish-list" aria-label="Danh sách món">
    <DishRow
      v-for="dish in dishes"
      :key="dish.name"
      :dish="dish"
      :selected="selectedNames.includes(dish.name)"
      @toggle="emit('toggle', $event)"
    />
  </div>
</template>

<style scoped>
.dish-list { display: grid; gap: .6rem; }
</style>

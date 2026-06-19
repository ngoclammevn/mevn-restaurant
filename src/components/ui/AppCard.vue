<script setup>
defineProps({ ticket: Boolean })
</script>

<template>
  <article :class="ticket ? 'ticket' : 'card'"><slot /></article>
</template>

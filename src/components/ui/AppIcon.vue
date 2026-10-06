<script setup>
defineProps({ name: { type: String, default: 'lunch' } })
const paths = {
  lunch: ['M3 10h18a9 9 0 0 1-18 0Z', 'M8 21h8M12 19v2M7 3v3m5-4v4m5-3v3'],
  today: ['M8 3v4m8-4v4M4 5h16v16H4zM4 10h16M9 15l2 2 4-4'],
  calendar: ['M8 3v4m8-4v4M4 5h16v16H4zM4 10h16M8 14h2m4 0h2m-8 4h2'],
  restaurant: ['M4 10h16M5 10v10h14V10M3 10l2-6h14l2 6M9 20v-6h6v6'],
  manage: ['M4 7h16M4 17h16M8 4v6m8 4v6'],
  arrow: ['M19 12H5m6-6-6 6 6 6'],
  plus: ['M12 5v14M5 12h14'],
  check: ['M5 12l4 4L19 6'],
  person: ['M16 7a4 4 0 1 1-8 0a4 4 0 0 1 8 0', 'M4 21v-2a8 8 0 0 1 16 0v2'],
  updates: ['M5 3h14v18H5z', 'M8 7h8M8 11h8M8 15h5'],
  online: ['M16 8a4 4 0 1 1-8 0a4 4 0 0 1 8 0', 'M3 21v-2a9 9 0 0 1 18 0v2'],
}
</script>
<template><svg class="app-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path v-for="(path, index) in paths[name] || paths.lunch" :key="index" :d="path" /></svg></template>

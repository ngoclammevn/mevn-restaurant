<script setup>
import ManageTabs from '../components/navigation/ManageTabs.vue'
</script>

<template>
  <div class="manage-page stack">
    <ManageTabs />
    <router-view />
  </div>
</template>

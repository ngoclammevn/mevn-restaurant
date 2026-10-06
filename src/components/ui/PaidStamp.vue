<script setup>defineProps({ paid: Boolean })</script>
<template><span class="paid-status" :class="{ 'paid-status--paid': paid }">{{ paid ? 'Đã trả' : 'Chưa trả' }}</span></template>
<style scoped>.paid-status { display:inline-flex; align-items:center; gap:.35rem; color:var(--ink-soft); font-size:var(--fs-sm); white-space:nowrap; }.paid-status::before { content:''; height:6px; width:6px; background:var(--muted); border-radius:50%; }.paid-status--paid::before { background:var(--primary); }</style>

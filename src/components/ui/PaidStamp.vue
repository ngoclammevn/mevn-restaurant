<script setup>defineProps({ paid: Boolean })</script>
<template><span class="paid-status" :class="{ 'paid-status--paid': paid }"><span aria-hidden="true">{{ paid ? '✓' : '!' }}</span>{{ paid ? 'Đã thanh toán' : 'Chưa thanh toán' }}</span></template>
<style scoped>.paid-status{display:inline-flex;align-items:center;gap:6px;color:var(--unpaid-ink,#a52a32);background:var(--unpaid-bg,#fff0f1);border-radius:999px;padding:6px 10px;font-size:14px;font-weight:600;line-height:1.4}.paid-status--paid{color:var(--primary);background:var(--bg-tint)}.paid-status>span{font-weight:750}</style>

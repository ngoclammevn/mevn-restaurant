<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { SignIn } from '@clerk/vue'
import { PageHeader } from '../components/ui'
const route = useRoute()
const redirectUrl = computed(() => { const value = route.query.redirect; return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/' })
</script>
<template><section class="stack sign-in-page"><PageHeader title="Đăng nhập" sub="Đăng nhập để đặt món và xem lịch cơm." /><SignIn :force-redirect-url="redirectUrl" /></section></template>
<style scoped>.sign-in-page { align-items:center; }.sign-in-page :deep(.cl-rootBox), .sign-in-page :deep(.cl-cardBox), .sign-in-page :deep(.cl-card) { max-width:100%; }</style>

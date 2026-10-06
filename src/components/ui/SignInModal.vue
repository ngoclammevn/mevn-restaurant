<script setup>
import { watch } from 'vue'
import { SignIn, useUser } from '@clerk/vue'
import AppDialog from './AppDialog.vue'
const emit = defineEmits(['close'])
const { isSignedIn } = useUser()
const redirectUrl = window.location.href
watch(isSignedIn, signedIn => { if (signedIn) emit('close') })
</script>
<template><AppDialog open title="Đăng nhập" @close="emit('close')"><div class="signin-content"><SignIn oauth-flow="popup" :force-redirect-url="redirectUrl" /></div></AppDialog></template>
<style scoped>.signin-content { display:flex; justify-content:center; min-width:0; }.signin-content :deep(.cl-rootBox), .signin-content :deep(.cl-cardBox), .signin-content :deep(.cl-card) { max-width:100%; }.signin-content :deep(.cl-card) { box-shadow:none; }</style>

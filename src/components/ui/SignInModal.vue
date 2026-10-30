<script setup>
import { watch } from 'vue'
import { SignIn, useUser } from '@clerk/vue'
import AppDialog from './AppDialog.vue'
const emit = defineEmits(['close'])
const { isSignedIn } = useUser()
const redirectUrl = window.location.href
const appearance = {
  elements: {
    rootBox: { width: '100%' },
    cardBox: { width: '100%', boxShadow: 'none', border: 'none' },
    card: { width: '100%', boxShadow: 'none', border: 'none' },
  },
}
watch(isSignedIn, signedIn => { if (signedIn) emit('close') })
</script>
<template><AppDialog open title="Đăng nhập" @close="emit('close')"><div class="signin-content"><SignIn :appearance="appearance" oauth-flow="popup" :force-redirect-url="redirectUrl" /></div></AppDialog></template>
<style scoped>
/* Form Clerk rộng 400px; khung 720px chung làm popup dư khoảng trắng trên desktop. */
:global(.app-dialog:has(.signin-content)) { width:min(450px,calc(100% - 32px)); }
.signin-content { display:flex; justify-content:center; min-width:0; }
.signin-content :deep(.cl-rootBox), .signin-content :deep(.cl-cardBox), .signin-content :deep(.cl-card) { max-width:100%; }
</style>

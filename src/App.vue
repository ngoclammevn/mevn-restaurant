<script setup>
import { watch } from 'vue'
import { useUser, Show, UserButton } from '@clerk/vue'
import { useProfile } from './composables/useProfile'

const { isSignedIn } = useUser()
const { ensureProfile } = useProfile()
watch(isSignedIn, (v) => { if (v) ensureProfile() }, { immediate: true })
</script>

<template>
  <!-- @clerk/vue 2.x: <Show> replaces React-SDK <SignedIn>/<SignedOut> (core-3). -->
  <Show when="signed-in">
    <header><UserButton /></header>
    <router-view />
    <template #fallback>
      <!-- signed-out: router guard redirects protected routes to /sign-in -->
      <router-view />
    </template>
  </Show>
</template>

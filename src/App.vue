<script setup>
import { watch } from 'vue'
import { useUser, Show, UserButton } from '@clerk/vue'
import { useProfile } from './composables/useProfile'

const { isSignedIn } = useUser()
const { ensureProfile } = useProfile()
watch(isSignedIn, (v) => { if (v) ensureProfile() }, { immediate: true })

const nav = [
  { to: '/', label: 'Hôm nay' },
  { to: '/post', label: 'Đăng cơm' },
  { to: '/dashboard', label: 'Thu tiền' },
  { to: '/history', label: 'Đơn của tôi' },
  { to: '/profile', label: 'Hồ sơ' },
]
</script>

<template>
  <!-- @clerk/vue 2.x: <Show> replaces React-SDK <SignedIn>/<SignedOut> (core-3). -->
  <Show when="signed-in">
    <div class="app-shell">
      <header class="app-bar">
        <router-link to="/" class="brand">
          <span class="brand-dot">🍱</span> Cơm Trưa
        </router-link>
        <nav class="app-nav">
          <router-link v-for="l in nav" :key="l.to" :to="l.to" class="nav-link" exact-active-class="router-link-active">
            {{ l.label }}
          </router-link>
          <UserButton />
        </nav>
      </header>
      <main class="app-main">
        <router-view />
      </main>
    </div>

    <template #fallback>
      <!-- signed-out: router guard sends protected routes to /sign-in -->
      <router-view />
    </template>
  </Show>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useUser, Show, UserButton } from '@clerk/vue'
import { useProfile } from './composables/useProfile'
import changelog from './changelog.json'
import ChangelogModal from './components/ui/ChangelogModal.vue'
import SignInModal from './components/ui/SignInModal.vue'
import AppButton from './components/ui/AppButton.vue'


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

const latestDate = changelog[0]?.date ?? ''
const showChangelog = ref(false)
const showSignIn = ref(false)
</script>


<template>
  <div class="app-shell">
    <header class="app-bar">
      <router-link to="/" class="brand">
        <span class="brand-dot">🍱</span> Cơm Trưa
      </router-link>
      <nav class="app-nav">
        <router-link v-for="l in nav" :key="l.to" :to="l.to" class="nav-link" exact-active-class="router-link-active">
          {{ l.label }}
        </router-link>
      </nav>
      <div class="user-action">
        <UserButton v-if="isSignedIn" />
        <AppButton v-else size="sm" @click="showSignIn = true">Đăng nhập</AppButton>
      </div>
    </header>
    <main class="app-main">
      <router-view />
    </main>
    <a href="#" class="changelog-fab" :title="`Changelog ${latestDate}`" @click.prevent="showChangelog = true">
      <span class="changelog-fab__label">{{ latestDate }}</span>
    </a>

    <ChangelogModal v-if="showChangelog" @close="showChangelog = false" />
    <SignInModal v-if="showSignIn" @close="showSignIn = false" />
  </div>
</template>

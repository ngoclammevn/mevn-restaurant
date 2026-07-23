<script setup>
import { computed, ref, watch } from 'vue'
import { useUser } from '@clerk/vue'
import { useRoute } from 'vue-router'
import { useProfile } from './composables/useProfile'
import changelog from './changelog.json'
import AccountMenu from './components/navigation/AccountMenu.vue'
import AppBottomNav from './components/navigation/AppBottomNav.vue'
import ChangelogModal from './components/ui/ChangelogModal.vue'
import SignInModal from './components/ui/SignInModal.vue'
import AppButton from './components/ui/AppButton.vue'

const route = useRoute()
const { isSignedIn } = useUser()
const { ensureProfile } = useProfile()
watch(isSignedIn, (v) => { if (v) ensureProfile() }, { immediate: true })

const isFocused = computed(() => route.meta.focused === true)
const isWide = computed(() => route.meta.layout === 'wide')
const nav = [
  { to: '/', label: 'Hôm nay' },
  { to: '/post', label: 'Đăng menu' },
  { to: '/history', label: 'Đơn của tôi' },
  { to: '/manage/menus', label: 'Quản lý' },
]

const latestDate = changelog[0]?.date ?? ''
const showChangelog = ref(false)
const showSignIn = ref(false)
</script>


<template>
  <div class="app-shell">
    <header v-if="!isFocused" class="app-bar">
      <router-link to="/" class="brand">
        <span class="brand-dot">🍱</span> Cơm Trưa
      </router-link>
      <nav class="app-nav">
        <router-link v-for="l in nav" :key="l.to" :to="l.to" class="nav-link" exact-active-class="router-link-active">
          {{ l.label }}
        </router-link>
      </nav>
      <div class="user-action">
        <AccountMenu v-if="isSignedIn" @show-changelog="showChangelog = true" />
        <AppButton v-else size="sm" @click="showSignIn = true">Đăng nhập</AppButton>
      </div>
    </header>
    <main
      class="app-main"
      :class="{ 'app-main--wide': isWide, 'app-main--focused': isFocused }"
    >
      <router-view />
    </main>
    <AppBottomNav v-if="!isFocused" />
    <a
      v-if="!isFocused"
      href="#"
      class="changelog-fab"
      :title="`Changelog ${latestDate}`"
      @click.prevent="showChangelog = true"
    >
      <span class="changelog-fab__label">{{ latestDate }}</span>
    </a>

    <ChangelogModal v-if="showChangelog" @close="showChangelog = false" />
    <SignInModal v-if="showSignIn" @close="showSignIn = false" />
  </div>
</template>

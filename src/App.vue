<script setup>
import { ref, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useUser } from '@clerk/vue'
import { useProfile } from './composables/useProfile'
import { provideAppPresence } from './composables/useAppPresence'
import changelog from './changelog.json'
import ChangelogModal from './components/ui/ChangelogModal.vue'
import SignInModal from './components/ui/SignInModal.vue'
import AppButton from './components/ui/AppButton.vue'
import AppIcon from './components/ui/AppIcon.vue'
import AppNavigation from './components/AppNavigation.vue'
import Avatar from './components/ui/Avatar.vue'
import PresenceFloat from './components/PresenceFloat.vue'
const route = useRoute(), { isSignedIn, user } = useUser(), { ensureProfile } = useProfile()
const { viewers, connected } = provideAppPresence()
watch(isSignedIn, value => { if (value) ensureProfile() }, { immediate: true })
const latestDate = changelog[0]?.date ?? '', showChangelog = ref(false), showSignIn = ref(false), unread = ref(false)
try { unread.value = localStorage.getItem('lunch-changelog-seen') !== latestDate } catch {}
function openUpdates() { showChangelog.value = true; unread.value = false; try { localStorage.setItem('lunch-changelog-seen', latestDate) } catch {} }
watch(() => route.path, async () => { await nextTick(); const target = document.querySelector('#main-content h1, #main-content'); if (target) { target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }) } })
</script>
<template><div class="app-shell"><a href="#main-content" class="skip-link">Đến nội dung chính</a>
  <header class="app-bar"><router-link to="/" class="brand"><AppIcon name="lunch" />Cơm Trưa</router-link><AppNavigation surface="desktop" :path="route.path" />
    <div class="user-action"><AppButton v-if="isSignedIn" to="/post" variant="ghost" size="sm" class="post-action" aria-label="Đăng menu"><AppIcon name="plus" /><span>Đăng menu</span></AppButton>
      <button type="button" class="updates-action" :aria-label="`Cập nhật ứng dụng · ${latestDate}`" @click="openUpdates"><AppIcon name="updates" /><span v-if="unread" class="updates-dot" aria-hidden="true" /></button>
      <router-link v-if="isSignedIn" to="/profile" class="profile-action" aria-label="Mở trang cá nhân"><Avatar :src="user?.imageUrl" :name="user?.fullName || user?.firstName" :size="40" /></router-link><AppButton v-else size="sm" @click="showSignIn = true">Đăng nhập</AppButton>
    </div>
  </header><main id="main-content" class="app-main" tabindex="-1"><router-view /></main><AppNavigation surface="mobile" :path="route.path" />
  <PresenceFloat v-if="isSignedIn" :viewers="viewers" :connected="connected" />
  <ChangelogModal v-if="showChangelog" @close="showChangelog = false" /><SignInModal v-if="showSignIn" @close="showSignIn = false" />
</div></template>

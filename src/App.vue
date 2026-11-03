<script setup>
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
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
const route = useRoute(), { isSignedIn, user } = useUser(), { ensureProfile,currentProfile } = useProfile()
provideAppPresence()
watch(()=>user.value?.id, value => { if (value) ensureProfile() }, { immediate: true })
const latestDate = changelog[0]?.date ?? '', showChangelog = ref(false), showSignIn = ref(false), unread = ref(false)
const mobileNavHidden = ref(false)
const mobileNavMedia = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(max-width: 900px)') : null
let lastScrollY = 0, scrollDirection = 0, scrollDistance = 0
try { unread.value = localStorage.getItem('lunch-changelog-seen') !== latestDate } catch {}
function openUpdates() { showChangelog.value = true; unread.value = false; try { localStorage.setItem('lunch-changelog-seen', latestDate) } catch {} }
function updateMobileNavigation() {
  const currentScrollY = Math.max(0, window.scrollY)
  const delta = currentScrollY - lastScrollY
  lastScrollY = currentScrollY
  if (!mobileNavMedia?.matches) { mobileNavHidden.value = false; return }
  if (currentScrollY <= 24) { mobileNavHidden.value = false; scrollDistance = 0; scrollDirection = 0; return }
  if (Math.abs(delta) < 2) return
  const nextDirection = Math.sign(delta)
  if (nextDirection !== scrollDirection) { scrollDirection = nextDirection; scrollDistance = 0 }
  scrollDistance += Math.abs(delta)
  if (scrollDirection > 0 && scrollDistance >= 56) mobileNavHidden.value = true
  if (scrollDirection < 0 && scrollDistance >= 16) mobileNavHidden.value = false
}
function resetMobileNavigation() {
  mobileNavHidden.value = false
  lastScrollY = window.scrollY
  scrollDirection = 0
  scrollDistance = 0
}
onMounted(() => {
  lastScrollY = window.scrollY
  window.addEventListener('scroll', updateMobileNavigation, { passive: true })
  mobileNavMedia?.addEventListener('change', resetMobileNavigation)
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', updateMobileNavigation)
  mobileNavMedia?.removeEventListener('change', resetMobileNavigation)
})
watch(() => route.path, resetMobileNavigation)
watch(() => route.path, async () => { await nextTick(); const target = document.querySelector('#main-content h1, #main-content'); if (target) { target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }) } })
</script>
<template><div class="app-shell" :class="{ 'app-shell--nav-hidden': mobileNavHidden }"><a href="#main-content" class="skip-link">Đến nội dung chính</a>
  <header class="app-bar"><router-link to="/" class="brand"><AppIcon name="lunch" />Cơm Trưa</router-link><AppNavigation surface="desktop" :path="route.path" />
    <div class="user-action"><AppButton v-if="isSignedIn" to="/post" variant="ghost" size="sm" class="post-action" aria-label="Đăng menu"><AppIcon name="plus" /><span>Đăng menu</span></AppButton>
      <button type="button" class="updates-action" :aria-label="`Cập nhật ứng dụng · ${latestDate}`" @click="openUpdates"><AppIcon name="updates" /><span v-if="unread" class="updates-dot" aria-hidden="true" /></button>
      <router-link v-if="isSignedIn" to="/profile" class="profile-action" aria-label="Mở trang cá nhân"><Avatar :profile="currentProfile || {id:user?.id,avatar_url:user?.imageUrl,provider_has_image:user?.hasImage}" :name="user?.fullName || user?.firstName" :size="40" /></router-link><AppButton v-else size="sm" @click="showSignIn = true">Đăng nhập</AppButton>
    </div>
  </header><main id="main-content" class="app-main" tabindex="-1"><router-view /></main><AppNavigation surface="mobile" :path="route.path" :class="{ 'app-navigation--hidden': mobileNavHidden }" />
  <ChangelogModal v-if="showChangelog" @close="showChangelog = false" /><SignInModal v-if="showSignIn" @close="showSignIn = false" />
</div></template>

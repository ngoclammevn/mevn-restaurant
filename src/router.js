import { createRouter, createWebHistory } from 'vue-router'
import SignInPage from './pages/SignInPage.vue'

const routes = [
  { path: '/sign-in', component: SignInPage, meta: { public: true } },
  { path: '/', component: () => import('./pages/TodayPage.vue') },
  { path: '/menu/:id', component: () => import('./pages/MenuPage.vue') },
  { path: '/post', component: () => import('./pages/PostMenuPage.vue') },
  { path: '/dashboard', component: () => import('./pages/DashboardPage.vue') },
  { path: '/history', component: () => import('./pages/HistoryPage.vue') },
  { path: '/profile', component: () => import('./pages/ProfilePage.vue') },
  { path: '/changelog', component: () => import('./pages/ChangelogPage.vue') },
]

const router = createRouter({ history: createWebHistory(), routes })

// guard: redirect to /sign-in when Clerk reports signed-out
router.beforeEach(async (to) => {
  if (to.meta.public) return true
  const clerk = window.Clerk
  if (clerk) { await clerk.loaded; if (!clerk.user) return '/sign-in' }
  return true
})

export default router

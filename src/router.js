import { createRouter, createWebHistory } from 'vue-router'
import SignInPage from './pages/SignInPage.vue'

const routes = [
  { path: '/sign-in', component: SignInPage, meta: { public: true } },
  { path: '/', component: () => import('./pages/TodayPage.vue') },
  { path: '/menu/:id', component: () => import('./pages/MenuPage.vue'), meta: { public: true } },
  { path: '/share/:id', redirect: to => `/menu/${to.params.id}`, meta: { public: true } },
  { path: '/post', component: () => import('./pages/PostMenuPage.vue') },
  { path: '/dashboard', component: () => import('./pages/DashboardPage.vue') },
  { path: '/history', component: () => import('./pages/HistoryPage.vue') },
  { path: '/profile', component: () => import('./pages/ProfilePage.vue') },
  { path: '/changelog', component: () => import('./pages/ChangelogPage.vue') },
]

const router = createRouter({ history: createWebHistory(), routes })

// helper: wait for Clerk script to load and initialize
function waitClerk() {
  return new Promise((resolve) => {
    if (window.Clerk?.loaded) return resolve()
    const interval = setInterval(() => {
      if (window.Clerk?.loaded) {
        clearInterval(interval)
        resolve()
      }
    }, 20)
    // Timeout after 4s
    setTimeout(() => {
      clearInterval(interval)
      resolve()
    }, 4000)
  })
}

// guard: redirect to /sign-in when Clerk reports signed-out
router.beforeEach(async (to) => {
  if (to.meta.public) return true
  await waitClerk()
  const clerk = window.Clerk
  if (clerk && !clerk.user) return '/sign-in'
  return true
})

export default router

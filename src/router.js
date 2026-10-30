import { createRouter, createWebHistory } from 'vue-router'
import SignInPage from './pages/SignInPage.vue'

const routes = [
  { path: '/sign-in', component: SignInPage, meta: { public: true } },
  { path: '/', component: () => import('./pages/TodayPage.vue') },
  { path: '/menu/:id', component: () => import('./pages/MenuPage.vue'), meta: { public: true } },
  { path: '/share/:id', redirect: to => `/menu/${to.params.id}`, meta: { public: true } },
  { path: '/catalog', component: () => import('./pages/CatalogPage.vue') },
  { path: '/manage', component: () => import('./pages/ManagePage.vue') },
  { path: '/post', component: () => import('./pages/PostMenuPage.vue') },
  { path: '/my-menus', component: () => import('./pages/MyMenusPage.vue') },
  { path: '/dashboard', component: () => import('./pages/DashboardPage.vue') },
  { path: '/history', component: () => import('./pages/HistoryPage.vue') },
  { path: '/profile', component: () => import('./pages/ProfilePage.vue') },
  { path: '/taste', component: () => import('./pages/TastePage.vue') },
  { path: '/:pathMatch(.*)*', component: () => import('./pages/NotFoundPage.vue') },
]

const router = createRouter({ history: createWebHistory(), routes })

export default router

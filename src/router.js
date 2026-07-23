import { createRouter, createWebHistory } from 'vue-router'
import SignInPage from './pages/SignInPage.vue'

const routes = [
  { path: '/sign-in', component: SignInPage, meta: { public: true } },
  { path: '/', component: () => import('./pages/TodayPage.vue'), meta: { layout: 'wide' } },
  {
    path: '/menu/:id',
    component: () => import('./pages/MenuPage.vue'),
    meta: { public: true, focused: true, layout: 'wide' },
  },
  { path: '/share/:id', redirect: to => `/menu/${to.params.id}`, meta: { public: true } },
  { path: '/post', component: () => import('./pages/PostMenuPage.vue') },
  {
    path: '/manage',
    component: () => import('./pages/ManagePage.vue'),
    redirect: '/manage/menus',
    meta: { layout: 'wide' },
    children: [
      { path: 'menus', component: () => import('./pages/MyMenusPage.vue') },
      { path: 'payments', component: () => import('./pages/DashboardPage.vue') },
    ],
  },
  { path: '/my-menus', redirect: '/manage/menus' },
  { path: '/dashboard', redirect: '/manage/payments' },
  { path: '/history', component: () => import('./pages/HistoryPage.vue') },
  { path: '/profile', component: () => import('./pages/ProfilePage.vue') },
]

const router = createRouter({ history: createWebHistory(), routes })

export default router

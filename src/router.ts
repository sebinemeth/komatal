import { createRouter, createWebHistory } from 'vue-router'
import { isOrganiser, whenReady } from './lib/session'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: () => import('./pages/LandingPage.vue') },
    { path: '/belepes', component: () => import('./pages/AuthPage.vue') },
    { path: '/szervezo', component: () => import('./pages/DashboardPage.vue'), meta: { organiser: true } },
    { path: '/uj', component: () => import('./pages/CreatePage.vue'), meta: { organiser: true } },
    { path: '/k/:id', component: () => import('./pages/KomatalPage.vue'), props: true },
    { path: '/:rest(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach(async (to) => {
  if (!to.meta.organiser) return true
  await whenReady()
  return isOrganiser.value ? true : { path: '/belepes', query: { next: to.fullPath } }
})

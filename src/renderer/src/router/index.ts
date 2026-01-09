import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue')
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue')
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/RegisterView.vue')
    },
    {
      path: '/onboarding',
      name: 'onboarding',
      component: () => import('../views/OnboardingView.vue')
    }
  ]
})

// 路由守卫：未登录时跳转到登录页，首次登录跳转到引导页
router.beforeEach(async (to) => {
  if (to.path === '/login' || to.path === '/register') return true

  const session = await window.electronAPI.auth.checkSession()
  if (!session.valid) return '/login'

  if (to.path === '/onboarding') return true
  if (!session.onboardingCompleted) return '/onboarding'

  return true
})

export default router

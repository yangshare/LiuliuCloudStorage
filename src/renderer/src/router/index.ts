import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

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
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('../views/AdminView.vue'),
      meta: { requiresAdmin: true },
      redirect: '/admin/dashboard',
      children: [
        {
          path: 'dashboard',
          name: 'admin-dashboard',
          component: () => import('../views/admin/DashboardView.vue')
        },
        {
          path: 'users',
          name: 'admin-users',
          component: () => import('../views/admin/UsersView.vue')
        },
        {
          path: 'storage',
          name: 'admin-storage',
          component: () => import('../views/admin/StorageView.vue')
        },
        {
          path: 'quota',
          name: 'admin-quota',
          component: () => import('../views/admin/QuotaView.vue')
        },
        {
          path: 'audit',
          name: 'admin-audit',
          component: () => import('../views/admin/AuditView.vue')
        }
      ]
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue')
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

  // 管理员权限检查
  if (to.meta.requiresAdmin) {
    const authStore = useAuthStore()

    if (!authStore.isAdmin) {
      // 尝试验证管理员权限
      const hasPermission = await authStore.checkAdminPermission()
      if (!hasPermission) {
        console.warn('权限不足：仅管理员可以访问此页面')
        return '/home'
      }
    }
  }

  return true
})

export default router

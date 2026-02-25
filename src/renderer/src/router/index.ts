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
      path: '/setup',
      name: 'setup',
      component: () => import('../views/SetupView.vue')
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
    },
    {
      path: '/share-transfer',
      name: 'share-transfer',
      component: () => import('../views/ShareTransferView.vue')
    }
  ]
})

// 路由守卫：配置检查 → 登录检查 → 引导检查
router.beforeEach(async (to) => {
  // 1. 配置向导页面跳过所有检查
  if (to.path === '/setup') return true

  // 2. 检查配置是否完整（带超时保护）
  try {
    const configPromise = window.electronAPI.config.check()
    const timeoutPromise = new Promise<{ complete: false }>((_, reject) =>
      setTimeout(() => reject(new Error('配置检查超时')), 5000)
    )

    const configStatus = await Promise.race([configPromise, timeoutPromise])

    if (!configStatus.complete) {
      console.log('配置不完整，跳转到配置向导')
      return '/setup?reason=incomplete'
    }
  } catch (error) {
    // IPC 错误或超时时跳转配置页（可能是首次启动或配置文件损坏）
    const reason = error instanceof Error && error.message.includes('超时') ? 'timeout' : 'error'
    console.error(`检查配置失败 (${reason}):`, error)
    return `/setup?reason=${reason}`
  }

  // 3. 登录页跳过登录检查
  if (to.path === '/login') return true

  // 4. 检查登录状态
  const authStore = useAuthStore()
  const session = await window.electronAPI.auth.checkSession()

  if (!session.valid) return '/login'

  // Story 7.1 MEDIUM FIX: 初始化用户状态，包括 isAdmin
  if (!authStore.user) {
    authStore.initUserFromSession(session)
  }

  // 5. 管理员权限检查
  if (to.meta.requiresAdmin) {
    if (!authStore.isAdmin) {
      // 尝试验证管理员权限
      const hasPermission = await authStore.checkAdminPermission()
      if (!hasPermission) {
        console.warn('权限不足：仅管理员可以访问此页面')
        return '/'
      }
    }
  }

  return true
})

export default router

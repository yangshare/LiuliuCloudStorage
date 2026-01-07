/**
 * 路由配置
 */

import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    redirect: '/files',
    meta: { requiresAuth: true }
  },
  {
    path: '/files',
    name: 'FileExplorer',
    component: () => import('../views/FileExplorerView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/transfers',
    name: 'TransferManager',
    component: () => import('../views/TransferManagerView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/security',
    name: 'SecuritySettings',
    component: () => import('../views/SecuritySettingsView.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: 'sessions',
        name: 'Sessions',
        component: () => import('../components/security/SessionsList.vue')
      },
      {
        path: 'login-history',
        name: 'LoginHistory',
        component: () => import('../components/security/LoginHistoryList.vue')
      }
    ]
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue')
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('../views/RegisterView.vue')
  },
  {
    path: '/reset-password',
    name: 'ResetPassword',
    component: () => import('../views/ResetPasswordView.vue')
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

// 路由守卫
router.beforeEach((to, from, next) => {
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';

  if (to.meta.requiresAuth && !isAuthenticated) {
    // 需要认证但未登录，跳转到登录页
    next('/login');
  } else if ((to.path === '/login' || to.path === '/register') && isAuthenticated) {
    // 已登录用户访问登录/注册页，跳转到主页
    next('/');
  } else {
    next();
  }
});

export default router;

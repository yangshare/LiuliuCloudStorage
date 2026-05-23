import type { Router } from 'vue-router'
import type { Pinia } from 'pinia'
import { useAuthStore } from './stores/authStore'

const LOGIN_PATH = '/login'
const SETUP_PATH = '/setup'

export function setupAuthExpiredGuard(router: Router, pinia: Pinia): () => void {
  if (!window.electronAPI?.onAuthExpired) {
    console.warn('[auth-expired-guard] electronAPI.onAuthExpired 不可用')
    return () => {}
  }

  let isHandling = false

  const unsubscribe = window.electronAPI.onAuthExpired(async (code: string) => {
    if (isHandling) return

    const currentPath = router.currentRoute.value.path
    if (currentPath === LOGIN_PATH || currentPath === SETUP_PATH) return

    isHandling = true
    try {
      try {
        await window.electronAPI.auth.logout()
      } catch (err) {
        console.warn('[auth-expired-guard] logout 失败:', err)
      }

      const authStore = useAuthStore(pinia)
      authStore.clearUser()

      const message = code === 'FORBIDDEN' ? '权限不足，请重新登录' : '登录已过期，请重新登录'
      window.$message?.warning?.(message)

      await router.push(LOGIN_PATH)
    } finally {
      isHandling = false
    }
  })

  return unsubscribe
}

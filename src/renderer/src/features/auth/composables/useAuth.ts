// src/renderer/src/features/auth/composables/useAuth.ts

import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/features/auth'
import { authRendererService } from '../auth.renderer.service'
import { ElMessage } from 'element-plus'
import type { SessionCheckResult } from '../auth.renderer.service'

export function useAuth() {
  const store = useAuthStore()
  const router = useRouter()
  const isLoading = ref(false)

  async function login(username: string, password: string, autoLogin: boolean = false) {
    isLoading.value = true
    try {
      const result = await authRendererService.login(username, password, autoLogin)
      if (result.success) {
        const userResult = await authRendererService.getCurrentUser()
        if (userResult?.success && userResult.data) {
          store.setUser({
            id: userResult.data.id,
            username: userResult.data.username,
            token: userResult.data.token || '',
            isAdmin: userResult.data.isAdmin
          })
        }
        await handlePostLogin()
        ElMessage.success('登录成功')
        router.push('/')
        return true
      } else {
        ElMessage.error(result.message || '登录失败')
        return false
      }
    } catch (error) {
      ElMessage.error('网络错误，请稍后重试')
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function checkSession() {
    const result = await authRendererService.checkSession()
    if (!result.valid) {
      store.clearUser()
      return false
    }
    return true
  }

  async function initializeAuth(session: SessionCheckResult) {
    const initialized = store.setUserFromSession(session)
    if (initialized) {
      await handlePostLogin()
    }
  }

  async function handlePostLogin() {
    if (store.startupAutoSyncTriggered || !store.user?.id) return
    store.markAutoSyncTriggered()
    try {
      const result = await window.electronAPI.autoSync.startupRun({ userId: store.user.id })
      if (result?.success && result.executed > 0) {
        console.log(`[autoSync] 启动自动同步完成: ${result.executed}/${result.total}`)
      }
    } catch (error) {
      console.warn('[autoSync] 启动自动同步失败:', error)
    }
  }

  async function logout() {
    try {
      await authRendererService.logout()
    } finally {
      store.clearUser()
      router.push('/login')
    }
  }

  async function checkAdminPermission(): Promise<boolean> {
    if (!store.isLoggedIn) return false
    try {
      const result = await authRendererService.getUsers()
      return result?.success ?? false
    } catch {
      return false
    }
  }

  return {
    login, logout, checkSession, initializeAuth, checkAdminPermission,
    isLoading, user: store.user, isLoggedIn: store.isLoggedIn, isAdmin: store.isAdmin
  }
}

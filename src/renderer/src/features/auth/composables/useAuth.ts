// src/renderer/src/features/auth/composables/useAuth.ts

import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
import { authRendererService } from '../auth.renderer.service'
import { ElMessage } from 'element-plus'

export function useAuth() {
  const store = useAuthStore()
  const router = useRouter()
  const isLoading = ref(false)

  async function login(username: string, password: string, autoLogin: boolean = false) {
    isLoading.value = true
    try {
      const result = await authRendererService.login(username, password, autoLogin)
      if (result.success) {
        // 登录成功后获取用户信息
        const userResult = await authRendererService.getCurrentUser()
        if (userResult?.success && userResult.data) {
          store.setUser({
            id: userResult.data.id,
            username: userResult.data.username,
            token: userResult.data.token || '',
            isAdmin: userResult.data.isAdmin
          })
        }
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
      store.setUser(null)
      return false
    }
    return true
  }

  function logout() {
    authRendererService.logout()
    store.setUser(null)
    router.push('/login')
  }

  return {
    login,
    logout,
    checkSession,
    isLoading,
    user: store.user,
    isLoggedIn: store.isLoggedIn,
    isAdmin: store.isAdmin
  }
}

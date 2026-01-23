import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface User {
  id: number
  username: string
  token: string
  isAdmin?: boolean
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)

  const isLoggedIn = computed(() => user.value !== null)
  const isAdmin = computed(() => user.value?.isAdmin ?? false)

  /**
   * Story 7.1 MEDIUM FIX: 添加设置用户状态的方法
   * 处理数据库中的 is_admin (0/1) 到布尔值的转换
   */
  function setUser(userData: {
    id: number
    username: string
    token: string
    isAdmin?: number | boolean
  }) {
    user.value = {
      id: userData.id,
      username: userData.username,
      token: userData.token,
      // 转换 is_admin: 0/1 -> false/true
      isAdmin: typeof userData.isAdmin === 'boolean'
        ? userData.isAdmin
        : userData.isAdmin === 1
    }
  }

  /**
   * 清除用户状态
   */
  function clearUser() {
    user.value = null
  }

  /**
   * 从 session 数据初始化用户状态
   * 用于应用启动时恢复登录状态
   */
  function initUserFromSession(session: {
    valid: boolean
    username?: string
    onboardingCompleted?: boolean
  }) {
    if (session.valid && session.username) {
      // 使用专门的 API 获取当前用户信息
      window.electronAPI.auth.getCurrentUser?.()
        .then((result: any) => {
          if (result.success && result.data) {
            setUser({
              id: result.data.id,
              username: result.data.username,
              token: '', // token 已存储在后端
              isAdmin: result.data.isAdmin
            })
          } else {
            // 降级方案：如果获取失败，使用 session 中的用户名
            setUser({
              id: 0,
              username: session.username!,
              token: '',
              isAdmin: false
            })
          }
        })
        .catch(() => {
          // 获取用户信息失败，使用默认值
          setUser({
            id: 0,
            username: session.username!,
            token: '',
            isAdmin: false
          })
        })
    }
  }

  async function checkAdminPermission(): Promise<boolean> {
    if (!isLoggedIn.value) {
      return false
    }

    try {
      const result = await window.electronAPI.auth.getUsers()
      return result?.success ?? false
    } catch {
      return false
    }
  }

  return {
    user,
    isLoggedIn,
    isAdmin,
    setUser,
    clearUser,
    initUserFromSession,
    checkAdminPermission
  }
})

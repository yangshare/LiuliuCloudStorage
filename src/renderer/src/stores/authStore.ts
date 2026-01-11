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

  async function checkAdminPermission(): Promise<boolean> {
    if (!isLoggedIn.value) {
      return false
    }

    try {
      const result = await window.electronAPI.auth.getUsers()
      return result.success
    } catch {
      return false
    }
  }

  return {
    user,
    isLoggedIn,
    isAdmin,
    checkAdminPermission
  }
})

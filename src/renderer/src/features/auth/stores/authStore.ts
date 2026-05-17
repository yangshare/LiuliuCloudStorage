// src/renderer/src/features/auth/stores/authStore.ts

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { SessionCheckResult } from '../auth.renderer.service'

export interface User {
  id: number
  username: string
  token: string
  isAdmin?: boolean
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const startupAutoSyncTriggered = ref(false)

  const isLoggedIn = computed(() => user.value !== null)
  const isAdmin = computed(() => user.value?.isAdmin ?? false)

  function setUser(userData: { id: number; username: string; token: string; isAdmin?: number | boolean } | null) {
    if (userData === null) {
      user.value = null
      return
    }
    const newUser: User = {
      id: userData.id,
      username: userData.username,
      token: userData.token,
      isAdmin: typeof userData.isAdmin === 'boolean' ? userData.isAdmin : userData.isAdmin === 1
    }
    user.value = newUser
  }

  function setUserFromSession(session: SessionCheckResult): User | null {
    if (session.valid && session.user) {
      const newUser: User = {
        id: session.user.id,
        username: session.user.username,
        token: session.user.token || '',
        isAdmin: session.user.isAdmin
      }
      setUser(newUser)
      return newUser
    }
    if (session.valid && session.username) {
      const fallbackUser: User = { id: 0, username: session.username, token: '', isAdmin: false }
      setUser(fallbackUser)
      return fallbackUser
    }
    return null
  }

  function clearUser() {
    user.value = null
    startupAutoSyncTriggered.value = false
  }

  function markAutoSyncTriggered() {
    startupAutoSyncTriggered.value = true
  }

  return {
    user, isLoggedIn, isAdmin, startupAutoSyncTriggered,
    setUser, setUserFromSession, clearUser, markAutoSyncTriggered
  }
})

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
    user.value = {
      id: userData.id,
      username: userData.username,
      token: userData.token,
      isAdmin: typeof userData.isAdmin === 'boolean' ? userData.isAdmin : userData.isAdmin === 1
    }
    triggerStartupAutoSync()
  }

  async function triggerStartupAutoSync() {
    if (startupAutoSyncTriggered.value || !user.value?.id) return
    startupAutoSyncTriggered.value = true

    try {
      const result = await window.electronAPI.autoSync.startupRun({
        userId: user.value.id
      })
      if (result?.success && result.executed > 0) {
        console.log(`[autoSync] 启动自动同步完成: ${result.executed}/${result.total}`)
      }
    } catch (error) {
      console.warn('[autoSync] 启动自动同步失败:', error)
    }
  }

  function clearUser() {
    user.value = null
    startupAutoSyncTriggered.value = false
  }

  function initUserFromSession(session: SessionCheckResult) {
    if (session.valid && session.user) {
      setUser({
        id: session.user.id,
        username: session.user.username,
        token: session.user.token || '',
        isAdmin: session.user.isAdmin
      })
      return
    }

    if (session.valid && session.username) {
      window.electronAPI.auth.getCurrentUser?.()
        .then((result: any) => {
          if (result.success && result.data) {
            setUser({
              id: result.data.id,
              username: result.data.username,
              token: '',
              isAdmin: result.data.isAdmin
            })
          } else {
            setUser({
              id: 0,
              username: session.username!,
              token: '',
              isAdmin: false
            })
          }
        })
        .catch(() => {
          setUser({
            id: 0,
            username: session.username!,
            token: '',
            isAdmin: false
          })
        })
    }
  }

  async function logout() {
    try {
      await window.electronAPI.auth.logout()
    } finally {
      clearUser()
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
    logout,
    initUserFromSession,
    checkAdminPermission
  }
})

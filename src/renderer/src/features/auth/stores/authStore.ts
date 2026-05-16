// src/renderer/src/features/auth/stores/authStore.ts

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface User {
  id: number
  username: string
  token: string
  isAdmin: boolean
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const isLoggedIn = computed(() => !!user.value)
  const isAdmin = computed(() => user.value?.isAdmin ?? false)

  function setUser(newUser: User | null) {
    user.value = newUser
  }

  return { user, isLoggedIn, isAdmin, setUser }
})

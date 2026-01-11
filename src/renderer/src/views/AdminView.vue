<template>
  <admin-layout>
    <router-view />
  </admin-layout>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import AdminLayout from '@/components/admin/AdminLayout.vue'

const router = useRouter()
const authStore = useAuthStore()

onMounted(async () => {
  const isAdmin = await authStore.checkAdminPermission()

  if (!isAdmin) {
    console.warn('权限不足')
    router.push({ name: 'home' })
  }
})
</script>

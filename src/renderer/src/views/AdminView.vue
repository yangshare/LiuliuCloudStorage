<template>
  <admin-layout>
    <router-view />
  </admin-layout>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/features/auth'
import AdminLayout from '@/components/admin/AdminLayout.vue'

const router = useRouter()
const auth = useAuth()

onMounted(async () => {
  const isAdmin = await auth.checkAdminPermission()

  if (!isAdmin) {
    console.warn('权限不足')
    router.push({ name: 'home' })
  }
})
</script>

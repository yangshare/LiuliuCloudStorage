<template>
  <n-layout has-sider style="height: 100vh">
    <n-layout-sider
      bordered
      show-trigger
      collapse-mode="width"
      :collapsed-width="64"
      :width="240"
      :collapsed="collapsed"
      @collapse="collapsed = true"
      @expand="collapsed = false"
    >
      <div class="admin-logo">
        <n-text strong>溜溜网盘</n-text>
      </div>

      <n-menu
        :collapsed="collapsed"
        :collapsed-width="64"
        :collapsed-icon-size="22"
        :options="menuOptions"
        :value="activeKey"
        @update:value="handleMenuSelect"
      />
    </n-layout-sider>

    <n-layout>
      <n-layout-header bordered style="height: 64px; padding: 0 24px; display: flex; align-items: center; justify-content: space-between">
        <n-space align="center">
          <n-text strong>{{ currentPageTitle }}</n-text>
        </n-space>

        <n-space align="center">
          <n-text>管理员: {{ authStore.user?.username }}</n-text>
          <n-button text @click="handleLogout">
            退出
          </n-button>
        </n-space>
      </n-layout-header>

      <n-layout-content content-style="padding: 24px">
        <slot />
      </n-layout-content>
    </n-layout>
  </n-layout>
</template>

<script setup lang="ts">
import { ref, computed, h } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { NLayout, NLayoutSider, NLayoutHeader, NLayoutContent, NMenu, NText, NButton, NSpace } from 'naive-ui'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const collapsed = ref(false)

const activeKey = computed(() => {
  const path = route.path
  if (path.includes('/admin/users')) return 'users'
  if (path.includes('/admin/storage')) return 'storage'
  if (path.includes('/admin/quota')) return 'quota'
  return 'dashboard'
})

const currentPageTitle = computed(() => {
  const titles: Record<string, string> = {
    dashboard: '控制台',
    users: '用户管理',
    storage: '存储监控',
    quota: '配额管理'
  }
  return titles[activeKey.value] || '控制台'
})

const menuOptions = computed(() => [
  {
    label: '控制台',
    key: 'dashboard',
    icon: () => h('span', '📊')
  },
  {
    label: '用户管理',
    key: 'users',
    icon: () => h('span', '👥'),
    disabled: false
  },
  {
    label: '存储监控',
    key: 'storage',
    icon: () => h('span', '💾'),
    disabled: false
  },
  {
    label: '配额管理',
    key: 'quota',
    icon: () => h('span', '📈'),
    disabled: false
  }
])

const handleMenuSelect = (key: string) => {
  router.push({ name: `admin-${key}` })
}

const handleLogout = async () => {
  await window.electronAPI.auth.logout()
  router.push({ name: 'login' })
}
</script>

<style scoped>
.admin-logo {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid #f0f0f0;
  font-size: 18px;
  font-weight: bold;
}
</style>

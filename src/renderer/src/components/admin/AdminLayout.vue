<template>
  <el-container style="height: 100vh">
    <el-aside :width="collapsed ? '64px' : '240px'" class="admin-aside">
      <div class="admin-logo">
        <el-text v-if="!collapsed" tag="b" size="large">溜溜网盘</el-text>
        <el-text v-else tag="b" size="large">LL</el-text>
      </div>

      <el-menu
        :default-active="activeKey"
        :collapse="collapsed"
        :collapse-transition="false"
        @select="handleMenuSelect"
      >
        <el-menu-item index="dashboard">
          <el-icon><span class="menu-icon">📊</span></el-icon>
          <template #title>控制台</template>
        </el-menu-item>
        <el-menu-item index="users">
          <el-icon><span class="menu-icon">👥</span></el-icon>
          <template #title>用户管理</template>
        </el-menu-item>
        <el-menu-item index="storage">
          <el-icon><span class="menu-icon">💾</span></el-icon>
          <template #title>存储监控</template>
        </el-menu-item>
        <el-menu-item index="quota">
          <el-icon><span class="menu-icon">📈</span></el-icon>
          <template #title>配额管理</template>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header style="height: 64px; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--el-border-color-light)">
        <div class="header-left">
          <el-text tag="b" size="large">{{ currentPageTitle }}</el-text>
        </div>

        <div class="header-right">
          <el-space align="center" :size="12">
            <el-text>管理员: {{ authStore.user?.username }}</el-text>
            <el-button link @click="handleLogout">
              退出
            </el-button>
          </el-space>
        </div>
      </el-header>

      <el-main style="padding: 24px">
        <slot />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { ElContainer, ElAside, ElHeader, ElMain, ElMenu, ElMenuItem, ElText, ElButton, ElSpace, ElIcon } from 'element-plus'

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

const handleMenuSelect = (key: string) => {
  router.push({ name: `admin-${key}` })
}

const handleLogout = async () => {
  await window.electronAPI.auth.logout()
  router.push({ name: 'login' })
}
</script>

<style scoped>
.admin-aside {
  border-right: 1px solid var(--el-border-color-light);
  transition: width 0.3s;
  overflow: hidden;
}

.admin-logo {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid var(--el-border-color-light);
  font-size: 18px;
  font-weight: bold;
  padding: 0 16px;
}

.el-menu {
  border-right: none;
}

.menu-icon {
  font-size: 18px;
}

.header-left,
.header-right {
  display: flex;
  align-items: center;
}
</style>

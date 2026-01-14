<template>
  <n-space vertical size="large">
    <n-card title="欢迎使用管理员控制台">
      <n-space vertical>
        <n-text>这里是管理员控制台首页</n-text>
        <n-text depth="3">您可以通过左侧菜单访问各项管理功能</n-text>
      </n-space>
    </n-card>

    <n-grid :cols="3" :x-gap="16">
      <n-gi>
        <n-card hoverable>
          <n-statistic label="用户总数" :value="stats.totalUsers" />
          <template #footer>
            <n-text depth="3">注册用户数量</n-text>
          </template>
        </n-card>
      </n-gi>

      <n-gi>
        <n-card hoverable>
          <n-statistic label="总存储使用" :value="stats.totalStorage" suffix="GB" />
          <template #footer>
            <n-text depth="3">所有用户的存储占用</n-text>
          </template>
        </n-card>
      </n-gi>

      <n-gi>
        <n-card hoverable>
          <n-statistic label="活跃用户" :value="stats.activeUsers" />
          <template #footer>
            <n-text depth="3">近7天活跃用户</n-text>
          </template>
        </n-card>
      </n-gi>
    </n-grid>

    <n-card title="功能导航">
      <n-list>
        <n-list-item>
          <n-button text @click="goToUsers">
            用户管理 →
          </n-button>
        </n-list-item>
        <n-list-item>
          <n-button text @click="goToStorage">
            存储监控 →
          </n-button>
        </n-list-item>
        <n-list-item>
          <n-button text @click="goToQuota">
            配额管理 →
          </n-button>
        </n-list-item>
      </n-list>
    </n-card>
  </n-space>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  NSpace,
  NCard,
  NGrid,
  NGi,
  NStatistic,
  NList,
  NListItem,
  NButton,
  NText
} from 'naive-ui'

const router = useRouter()

const stats = ref({
  totalUsers: 0,
  totalStorage: 0,
  activeUsers: 0
})

const goToUsers = () => router.push({ name: 'admin-users' })
const goToStorage = () => router.push({ name: 'admin-storage' })
const goToQuota = () => router.push({ name: 'admin-quota' })
</script>

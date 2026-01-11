<template>
  <n-modal
    :show="show"
    @update:show="$emit('update:show', $event)"
  >
    <n-card
      style="width: 600px; max-height: 80vh; overflow: auto;"
      title="用户详情"
      :bordered="false"
      size="huge"
      role="dialog"
      aria-modal="true"
    >
      <n-descriptions v-if="user" :column="2" bordered>
        <n-descriptions-item label="用户名">
          {{ user.username }}
        </n-descriptions-item>
        <n-descriptions-item label="角色">
          <n-tag :type="user.isAdmin ? 'warning' : 'success'">
            {{ user.isAdmin ? '管理员' : '普通用户' }}
          </n-tag>
        </n-descriptions-item>
        <n-descriptions-item label="配额总量">
          {{ formatBytes(user.quotaTotal) }}
        </n-descriptions-item>
        <n-descriptions-item label="已使用">
          {{ formatBytes(user.quotaUsed) }}
        </n-descriptions-item>
        <n-descriptions-item label="使用率" :span="2">
          <n-progress
            type="line"
            :percentage="user.usageRate"
            :processing="user.usageRate > 90"
            :color="user.usageRate > 90 ? '#f56c6c' : user.usageRate > 70 ? '#e6a23c' : '#67c23a'"
          />
        </n-descriptions-item>
        <n-descriptions-item label="注册时间" :span="2">
          {{ formatDate(user.createdAt) }}
        </n-descriptions-item>
        <n-descriptions-item label="状态" :span="2">
          <n-tag :type="user.isAdmin ? 'warning' : 'success'">
            {{ user.isAdmin ? '管理员' : '正常' }}
          </n-tag>
        </n-descriptions-item>
      </n-descriptions>

      <n-divider />

      <n-alert type="info" title="操作历史" style="margin-bottom: 16px;">
        用户操作历史记录功能将在 Story 9.4 中实现
      </n-alert>

      <template #footer>
        <n-space justify="end">
          <n-button @click="$emit('update:show', false)">
            关闭
          </n-button>
          <n-button type="primary" @click="handleAdjustQuota">
            调整配额
          </n-button>
        </n-space>
      </template>
    </n-card>
  </n-modal>
</template>

<script setup lang="ts">
import { NModal, NCard, NDescriptions, NDescriptionsItem, NTag, NProgress, NButton, NSpace, NDivider, NAlert } from 'naive-ui'
import type { UserListItem } from '../../services/AdminService'

interface Props {
  show: boolean
  user: UserListItem | null
}

interface Emits {
  (e: 'update:show', value: boolean): void
  (e: 'adjustQuota', user: UserListItem): void  // Story 7.1 CRITICAL FIX: 添加配额调整事件
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN')
}

// Story 7.1 CRITICAL FIX: 实现配额调整功能，触发事件让父组件打开配额调整对话框
const handleAdjustQuota = () => {
  if (!user) return
  emit('adjustQuota', user)
}
</script>

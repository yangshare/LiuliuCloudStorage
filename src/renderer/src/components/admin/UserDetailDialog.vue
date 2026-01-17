<template>
  <el-dialog
    :model-value="show"
    @update:model-value="$emit('update:show', $event)"
    title="用户详情"
    width="600px"
  >
    <el-descriptions v-if="user" :column="2" bordered>
      <el-descriptions-item label="用户名">
        {{ user.username }}
      </el-descriptions-item>
      <el-descriptions-item label="角色">
        <el-tag :type="user.isAdmin ? 'warning' : 'success'">
          {{ user.isAdmin ? '管理员' : '普通用户' }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="配额总量">
        {{ formatBytes(user.quotaTotal) }}
      </el-descriptions-item>
      <el-descriptions-item label="已使用">
        {{ formatBytes(user.quotaUsed) }}
      </el-descriptions-item>
      <el-descriptions-item label="使用率" :span="2">
        <el-progress
          :percentage="user.usageRate"
          :color="getProgressColor(user.usageRate)"
        />
      </el-descriptions-item>
      <el-descriptions-item label="注册时间" :span="2">
        {{ formatDate(user.createdAt) }}
      </el-descriptions-item>
      <el-descriptions-item label="状态" :span="2">
        <el-tag :type="user.isAdmin ? 'warning' : 'success'">
          {{ user.isAdmin ? '管理员' : '正常' }}
        </el-tag>
      </el-descriptions-item>
    </el-descriptions>

    <el-divider />

    <el-alert type="info" title="操作历史" style="margin-bottom: 16px;" :closable="false">
      用户操作历史记录功能将在 Story 9.4 中实现
    </el-alert>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="$emit('update:show', false)">
          关闭
        </el-button>
        <el-button type="primary" @click="handleAdjustQuota">
          调整配额
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ElDialog, ElDescriptions, ElDescriptionsItem, ElTag, ElProgress, ElButton, ElDivider, ElAlert } from 'element-plus'
import type { UserListItem } from '../../services/AdminService'

interface Props {
  show: boolean
  user: UserListItem | null
}

interface Emits {
  (e: 'update:show', value: boolean): void
  (e: 'adjustQuota', user: UserListItem): void
}

const props = defineProps<Props>()
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

const getProgressColor = (percentage: number): string => {
  if (percentage > 90) return '#f56c6c'
  if (percentage > 70) return '#e6a23c'
  return '#67c23a'
}

const handleAdjustQuota = () => {
  if (!props.user) return
  emit('adjustQuota', props.user)
}
</script>

<style scoped>
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>

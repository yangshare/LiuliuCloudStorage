<template>
  <div class="download-progress-item">
    <el-space direction="vertical" :size="8" style="width: 100%">
      <!-- 文件名和操作按钮 -->
      <div class="progress-header">
        <el-text tag="b" size="default">{{ progress.fileName }}</el-text>
        <el-space align="center" :size="8">
          <el-tag
            :type="getStatusType(progress.status)"
            size="small"
            round
          >
            {{ getStatusText(progress.status) }}
          </el-tag>

          <!-- 进行中：显示取消按钮 -->
          <el-button
            v-if="progress.status === 'in_progress'"
            size="small"
            type="danger"
            plain
            @click="handleCancel"
          >
            取消
          </el-button>

          <!-- 等待中：显示移除按钮 -->
          <el-button
            v-if="progress.status === 'pending'"
            size="small"
            @click="handleRemove"
          >
            移除
          </el-button>

          <!-- 已失败：显示重试按钮 -->
          <el-button
            v-if="progress.status === 'failed'"
            size="small"
            type="primary"
            @click="handleResume"
          >
            重试
          </el-button>
        </el-space>
      </div>

      <!-- 进度条 -->
      <el-progress
        :percentage="progress.percentage || 0"
        :status="progress.status === 'completed' ? 'success' : undefined"
        :stroke-width="20"
        :color="getProgressColor(progress.status)"
      >
        <span class="progress-percentage">{{ progress.percentage || 0 }}%</span>
      </el-progress>

      <!-- 详细信息 -->
      <el-space :size="16" class="progress-details" wrap>
        <el-text type="info" size="small">
          {{ formatFileSize(progress.downloadedBytes || 0) }} / {{ formatFileSize(progress.totalBytes || 0) }}
        </el-text>
        <el-text type="info" size="small">
          {{ formatSpeed(progress.speed || 0) }}
        </el-text>
        <el-text v-if="progress.status === 'in_progress'" type="info" size="small">
          剩余: {{ formatTime(progress.eta || 0) }}
        </el-text>
        <el-text v-else-if="progress.status === 'completed'" type="success" size="small">
          完成
        </el-text>
        <el-text v-else-if="progress.status === 'failed'" type="danger" size="small">
          {{ progress.errorMessage || '下载失败' }}
        </el-text>
      </el-space>
    </el-space>
  </div>
</template>

<script setup lang="ts">
import { ElProgress, ElText, ElTag, ElButton, ElSpace } from 'element-plus'
import { formatFileSize, formatSpeed, formatTime } from '@/utils/formatters'
import { useTransferStore } from '@/stores/transferStore'

export interface DownloadProgressData {
  taskId: string | number
  fileName: string
  downloadedBytes: number
  totalBytes: number
  percentage: number
  speed: number
  eta: number
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  errorMessage?: string
}

const props = defineProps<{
  progress: DownloadProgressData
}>()

const transferStore = useTransferStore()

async function handleCancel() {
  try {
    await transferStore.cancelDownload(props.progress.taskId)
  } catch (error) {
    console.error('取消下载失败:', error)
  }
}

async function handleRemove() {
  try {
    await transferStore.cancelDownload(props.progress.taskId)
  } catch (error) {
    console.error('移除任务失败:', error)
  }
}

async function handleResume() {
  try {
    const taskId = typeof props.progress.taskId === 'string'
      ? parseInt(props.progress.taskId)
      : props.progress.taskId

    await transferStore.resumeDownload(taskId)
  } catch (error) {
    console.error('恢复下载失败:', error)
  }
}

function getStatusType(status: string): 'info' | 'success' | 'danger' | 'warning' {
  const types: Record<string, 'info' | 'success' | 'danger' | 'warning'> = {
    pending: 'info',
    in_progress: 'primary',
    completed: 'success',
    failed: 'danger'
  }
  return types[status] || 'info'
}

function getStatusText(status: string): string {
  const texts: Record<string, string> = {
    pending: '等待中',
    in_progress: '下载中',
    completed: '已完成',
    failed: '失败'
  }
  return texts[status] || '未知'
}

function getProgressColor(status: string): string {
  const colors: Record<string, string> = {
    pending: '#909399',
    in_progress: '#409eff',
    completed: '#67c23a',
    failed: '#f56c6c'
  }
  return colors[status] || '#409eff'
}
</script>

<style scoped>
.download-progress-item {
  padding: 12px;
  border-radius: 8px;
  background-color: var(--el-fill-color-blank);
  margin-bottom: 8px;
  border: 1px solid var(--el-border-color-light);
  transition: all 0.3s ease;
}

.download-progress-item:hover {
  border-color: var(--el-color-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
  flex-wrap: wrap;
  gap: 8px;
}

.progress-details {
  margin-top: 4px;
  flex-wrap: wrap;
}

.progress-percentage {
  font-size: 12px;
  font-weight: 600;
  color: white;
}
</style>

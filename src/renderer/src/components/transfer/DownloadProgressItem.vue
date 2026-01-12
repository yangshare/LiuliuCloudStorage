<template>
  <div class="download-progress-item">
    <n-space vertical :size="8">
      <!-- 文件名和操作按钮 -->
      <div class="progress-header">
        <n-text strong>{{ progress.fileName }}</n-text>
        <n-space align="center" :size="8">
          <n-tag
            :type="getStatusType(progress.status)"
            size="small"
            round
          >
            {{ getStatusText(progress.status) }}
          </n-tag>

          <!-- 进行中：显示取消按钮 -->
          <n-button
            v-if="progress.status === 'in_progress'"
            size="tiny"
            type="error"
            secondary
            @click="handleCancel"
          >
            取消
          </n-button>

          <!-- 等待中：显示移除按钮 -->
          <n-button
            v-if="progress.status === 'pending'"
            size="tiny"
            @click="handleRemove"
          >
            移除
          </n-button>

          <!-- 已失败：显示重试按钮 -->
          <n-button
            v-if="progress.status === 'failed'"
            size="tiny"
            type="primary"
            @click="handleResume"
          >
            重试
          </n-button>
        </n-space>
      </div>

      <!-- 进度条 -->
      <n-progress
        type="line"
        :percentage="progress.percentage || 0"
        :indicator-placement="'inside'"
        :processing="progress.status === 'in_progress'"
        :color="getProgressColor(progress.status)"
        :height="20"
        :border-radius="4"
      >
        <template #default>
          <span class="progress-percentage">{{ progress.percentage || 0 }}%</span>
        </template>
      </n-progress>

      <!-- 详细信息 -->
      <n-space :size="16" class="progress-details">
        <n-text depth="3" style="font-size: 12px; min-width: 120px">
          {{ formatFileSize(progress.downloadedBytes || 0) }} / {{ formatFileSize(progress.totalBytes || 0) }}
        </n-text>
        <n-text depth="3" style="font-size: 12px; min-width: 80px">
          {{ formatSpeed(progress.speed || 0) }}
        </n-text>
        <n-text v-if="progress.status === 'in_progress'" depth="3" style="font-size: 12px">
          剩余: {{ formatTime(progress.eta || 0) }}
        </n-text>
        <n-text v-else-if="progress.status === 'completed'" depth="3" type="success" style="font-size: 12px">
          完成
        </n-text>
        <n-text v-else-if="progress.status === 'failed'" depth="3" type="error" style="font-size: 12px">
          {{ progress.errorMessage || '下载失败' }}
        </n-text>
      </n-space>
    </n-space>
  </div>
</template>

<script setup lang="ts">
import { NProgress, NSpace, NText, NTag, NButton } from 'naive-ui'
import { formatFileSize, formatSpeed, formatTime } from '@/utils/formatters'
import { useTransferStore } from '@/stores/transferStore'

export interface DownloadProgressData {
  taskId: string | number  // 支持 string 和 number 类型（与 transferStore 一致）
  fileName: string
  downloadedBytes: number
  totalBytes: number
  percentage: number
  speed: number // bytes per second
  eta: number // estimated time arrival (seconds)
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  errorMessage?: string // 错误信息（失败时显示）
}

const props = defineProps<{
  progress: DownloadProgressData
}>()

const transferStore = useTransferStore()

/**
 * 取消下载（Story 4-6: 取消下载任务）
 */
async function handleCancel() {
  try {
    await transferStore.cancelDownload(props.progress.taskId)
  } catch (error) {
    console.error('取消下载失败:', error)
  }
}

/**
 * 移除等待中的任务
 */
async function handleRemove() {
  try {
    await transferStore.cancelDownload(props.progress.taskId)
  } catch (error) {
    console.error('移除任务失败:', error)
  }
}

/**
 * 重试/恢复下载（Story 4-5: 下载断点续传）
 */
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

function getStatusType(status: string): 'default' | 'info' | 'success' | 'error' | 'warning' {
  const types: Record<string, 'default' | 'info' | 'success' | 'error' | 'warning'> = {
    pending: 'default',
    in_progress: 'info',
    completed: 'success',
    failed: 'error'
  }
  return types[status] || 'default'
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
    pending: '#909399',      // 灰色 - 等待中
    in_progress: '#2080f0',  // 蓝色 - 下载中
    completed: '#18a058',    // 绿色 - 完成
    failed: '#f56c6c'        // 红色 - 失败
  }
  return colors[status] || '#2080f0'
}
</script>

<style scoped>
.download-progress-item {
  padding: 12px;
  border-radius: 8px;
  background-color: var(--n-color-modal);
  margin-bottom: 8px;
  border: 1px solid var(--n-border-color);
  transition: all 0.3s ease;
}

.download-progress-item:hover {
  border-color: var(--n-border-color-hover);
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

/* 进度条流光动画 */
.download-progress-item :deep(.n-progress-graph-line-fill) {
  position: relative;
  overflow: hidden;
}

.download-progress-item :deep(.n-progress-graph-line-fill::after) {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.3) 50%,
    transparent 100%
  );
  animation: progress-shimmer 2s ease-in-out infinite;
}

@keyframes progress-shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}
</style>

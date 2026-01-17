<template>
  <div class="transfer-item">
    <div class="file-info">
      <span class="file-name">{{ task.fileName }}</span>
      <span class="file-size">{{ formatSize(task.transferredSize) }} / {{ formatSize(task.fileSize) }}</span>
    </div>

    <el-progress
      type="line"
      :percentage="task.progress"
      :status="getStatus(task.status)"
      :show-indicator="true"
    />

    <div class="transfer-stats">
      <span class="speed">{{ formatSpeed(task.uploadSpeed) }}</span>
      <span class="time">{{ formatEstimatedTime(task.estimatedTime) }}</span>
    </div>

    <!-- 失败任务显示错误信息和恢复按钮 -->
    <div v-if="task.status === 'failed'" class="error-section">
      <div v-if="task.error" class="error-message">
        {{ task.error }}
      </div>
      <el-button
        v-if="task.resumable"
        size="small"
        type="primary"
        @click="handleResume"
        :loading="isResuming"
      >
        恢复上传
      </el-button>>
    </div>

    <!-- 取消按钮（只对 pending 和 in_progress 状态显示） -->
    <div v-if="task.status === 'pending' || task.status === 'in_progress'" class="action-section">
      <el-button
        size="small"
        type="error"
        @click="handleCancel"
        :loading="isCancelling"
      >
        取消
      </el-button>>
    </div>

    <!-- 状态提示 -->
    <div v-if="task.status === 'cancelled'" class="status-message cancelled">
      已取消
    </div>
    <div v-if="task.status === 'completed'" class="status-message completed">
      已完成
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElProgress, ElButton } from 'element-plus'
import { ElMessageBox, ElNotification } from 'element-plus'
import type { UploadTask } from '@/stores/transferStore'

interface Props {
  task: UploadTask
}

interface Emits {
  (e: 'resume', taskId: string | number): void
  (e: 'cancel', taskId: string | number): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const isResuming = ref(false)
const isCancelling = ref(false)
const dialog = ElMessageBox
const notification = ElNotification

async function handleResume() {
  isResuming.value = true
  try {
    emit('resume', props.task.id)
  } finally {
    isResuming.value = false
  }
}

async function handleCancel() {
  dialog.warning({
    title: '确认取消',
    content: `确定要取消上传 "${props.task.fileName}" 吗？`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      isCancelling.value = true
      try {
        emit('cancel', props.task.id)
        notification.success({
          title: '任务已取消',
          content: `文件 "${props.task.fileName}" 的上传已取消`,
          duration: 3000
        })
      } finally {
        isCancelling.value = false
      }
    }
  })
}

function formatSize(bytes: number): string {
  if (!isFinite(bytes) || bytes < 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatSpeed(bytesPerSecond: number): string {
  if (!isFinite(bytesPerSecond) || bytesPerSecond <= 0) return '计算中...'
  if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`
  if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(2)} KB/s`
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(2)} MB/s`
}

function formatEstimatedTime(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '剩余 计算中...'
  if (seconds < 60) return `剩余 ${Math.floor(seconds)}秒`
  if (seconds < 3600) return `剩余 ${Math.floor(seconds / 60)}分钟`
  return `剩余 ${Math.floor(seconds / 3600)}小时`
}

function getStatus(status: string) {
  if (status === 'completed') return 'success'
  if (status === 'failed') return 'error'
  if (status === 'cancelled') return 'warning'
  if (status === 'pending') return 'info'
  if (status === 'in_progress') return 'default'
  return 'default'
}
</script>

<style scoped>
.transfer-item {
  padding: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.file-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.file-name {
  font-weight: 500;
  color: #333;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  color: #666;
  font-size: 12px;
  margin-left: 12px;
}

.transfer-stats {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 12px;
  color: #999;
}

.speed {
  color: #18a058;
}

.time {
  color: #666;
}

.error-message {
  margin-top: 8px;
  padding: 8px;
  background: #fff2f0;
  border: 1px solid #ffccc7;
  border-radius: 4px;
  color: #ff4d4f;
  font-size: 12px;
}

.error-section {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-section {
  margin-top: 8px;
}

.status-message {
  margin-top: 8px;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 13px;
  text-align: center;
}

.status-message.cancelled {
  background: #fff7e6;
  color: #fa8c16;
  border: 1px solid #ffd591;
}

.status-message.completed {
  background: #f6ffed;
  color: #52c41a;
  border: 1px solid #b7eb8f;
}
</style>

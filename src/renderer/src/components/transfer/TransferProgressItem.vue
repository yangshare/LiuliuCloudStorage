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
      </el-button>
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
      </el-button>
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
  padding: 14px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: var(--radius-md);
  margin-bottom: 8px;
  transition: all 0.2s ease;
}

.transfer-item:hover {
  background: rgba(255, 255, 255, 0.7);
  box-shadow: var(--shadow-sm);
}

.file-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
}

.file-name {
  font-weight: 500;
  color: var(--netease-gray-7);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
}

.file-size {
  color: var(--netease-gray-5);
  font-size: 12px;
  margin-left: 12px;
}

/* 进度条样式 - 网易云红 */
:deep(.el-progress) {
  margin: 10px 0;
}

:deep(.el-progress__text) {
  font-size: 13px !important;
  font-weight: 500;
}

:deep(.el-progress.is-success .el-progress__text) {
  color: var(--netease-green) !important;
}

:deep(.el-progress.is-error .el-progress__text) {
  color: var(--netease-red) !important;
}

:deep(.el-progress-bar__outer) {
  background-color: rgba(0, 0, 0, 0.06) !important;
  border-radius: 4px !important;
}

:deep(.el-progress-bar__inner) {
  background: linear-gradient(90deg, var(--netease-red) 0%, var(--netease-red-light) 100%) !important;
  border-radius: 4px !important;
}

:deep(.el-progress.is-success .el-progress-bar__inner) {
  background: linear-gradient(90deg, var(--netease-green) 0%, #58D68D 100%) !important;
}

:deep(.el-progress.is-error .el-progress-bar__inner) {
  background: linear-gradient(90deg, var(--netease-red) 0%, #F78989 100%) !important;
}

.transfer-stats {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
  font-size: 12px;
  color: var(--netease-gray-5);
}

.speed {
  color: var(--netease-green);
  font-weight: 500;
}

.time {
  color: var(--netease-gray-5);
}

.error-message {
  margin-top: 10px;
  padding: 10px 12px;
  background: rgba(194, 12, 12, 0.08);
  border: 1px solid rgba(194, 12, 12, 0.2);
  border-radius: var(--radius-sm);
  color: var(--netease-red);
  font-size: 12px;
}

.error-section {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-section {
  margin-top: 10px;
}

.status-message {
  margin-top: 10px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  text-align: center;
  font-weight: 500;
}

.status-message.cancelled {
  background: rgba(250, 140, 22, 0.1);
  color: #FA8C16;
  border: 1px solid rgba(250, 140, 22, 0.2);
}

.status-message.completed {
  background: rgba(46, 204, 113, 0.1);
  color: var(--netease-green);
  border: 1px solid rgba(46, 204, 113, 0.2);
}

/* 按钮样式 */
:deep(.el-button--primary) {
  background: linear-gradient(135deg, var(--netease-red) 0%, var(--netease-red-light) 100%) !important;
  border: none !important;
  border-radius: var(--radius-sm) !important;
}

:deep(.el-button--danger) {
  background: linear-gradient(135deg, #F56C6C 0%, #F78989 100%) !important;
  border: none !important;
  border-radius: var(--radius-sm) !important;
}

:deep(.el-button--small) {
  padding: 6px 12px;
  font-size: 12px;
}
</style>

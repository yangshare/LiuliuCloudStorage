<template>
  <div class="download-progress-item">
    <el-space direction="vertical" :size="10" style="width: 100%">
      <!-- 文件名和操作按钮 -->
      <div class="progress-header">
        <!-- 文件名区域：图标 + 文件名 -->
        <div class="file-name-section">
          <el-icon :size="18" :color="getFileIconColor()">
            <component :is="getFileIcon()" />
          </el-icon>
          <el-tooltip
            :content="progress.fileName"
            placement="top"
            :disabled="!shouldTruncateFileName()"
          >
            <el-text tag="b" size="default" class="file-name">
              {{ displayFileName }}
            </el-text>
          </el-tooltip>
        </div>

        <el-space align="center" :size="8">
          <el-tag
            :type="getStatusType(progress.status)"
            size="small"
            round
          >
            {{ getStatusText(progress.status) }}
          </el-tag>

          <!-- 进行中：显示暂停和取消按钮 -->
          <template v-if="progress.status === 'in_progress'">
            <el-button
              size="small"
              :icon="VideoPause"
              @click="handlePause"
            >
              暂停
            </el-button>
            <el-button
              size="small"
              type="danger"
              plain
              @click="handleCancel"
            >
              取消
            </el-button>
          </template>

          <!-- 暂停状态：显示继续和移除按钮 -->
          <template v-if="progress.status === 'paused'">
            <el-button
              size="small"
              type="primary"
              :icon="VideoPlay"
              @click="handleResume"
            >
              继续
            </el-button>
            <el-button
              size="small"
              @click="handleRemove"
            >
              移除
            </el-button>
          </template>

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
            :icon="RefreshRight"
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
        :show-text="true"
      >
        <template #default="{ percentage }">
          <span class="progress-percentage">{{ percentage }}%</span>
        </template>
      </el-progress>

      <!-- 详细信息 -->
      <div class="progress-details-grid">
        <div class="detail-item">
          <el-icon :size="14"><Document /></el-icon>
          <el-text type="info" size="small">
            {{ formatFileSize(progress.downloadedBytes || 0) }} / {{ formatFileSize(progress.totalBytes || 0) }}
          </el-text>
        </div>

        <div class="detail-item" v-if="progress.status === 'in_progress' || progress.status === 'paused'">
          <el-icon :size="14"><Download /></el-icon>
          <el-text type="info" size="small">
            {{ formatSpeed(progress.speed || 0) }}
          </el-text>
        </div>

        <div class="detail-item" v-if="progress.status === 'in_progress'">
          <el-icon :size="14"><Clock /></el-icon>
          <el-text type="info" size="small">
            {{ formatTime(progress.eta || 0) }}
          </el-text>
        </div>

        <div class="detail-item" v-if="progress.status === 'completed'">
          <el-icon :size="14" color="#67c23a"><CircleCheck /></el-icon>
          <el-text type="success" size="small">下载完成</el-text>
        </div>

        <div class="detail-item" v-if="progress.status === 'failed'">
          <el-icon :size="14" color="#f56c6c"><CircleClose /></el-icon>
          <el-text type="danger" size="small">{{ progress.errorMessage || '下载失败' }}</el-text>
        </div>

        <div class="detail-item" v-if="progress.status === 'paused'">
          <el-icon :size="14"><Warning /></el-icon>
          <el-text type="warning" size="small">已暂停</el-text>
        </div>
      </div>
    </el-space>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ElProgress, ElText, ElTag, ElButton, ElSpace, ElTooltip, ElIcon } from 'element-plus'
import {
  Document,
  Download,
  VideoPlay,
  VideoPause,
  RefreshRight,
  Clock,
  CircleCheck,
  CircleClose,
  Warning,
  Files,
  Picture,
  VideoCamera,
  Headset,
  Folder,
  Film
} from '@element-plus/icons-vue'
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
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'paused'
  errorMessage?: string
}

const props = defineProps<{
  progress: DownloadProgressData
}>()

const transferStore = useTransferStore()

// 文件名截断显示
const MAX_FILE_NAME_LENGTH = 40

const displayFileName = computed(() => {
  const fileName = props.progress.fileName || '未知文件'
  if (fileName.length <= MAX_FILE_NAME_LENGTH) {
    return fileName
  }
  // 如果是UUID格式（长字符串），截取前16位和后8位
  if (fileName.length > 50) {
    return `${fileName.substring(0, 16)}...${fileName.substring(fileName.length - 8)}`
  }
  // 普通长文件名，截取中间部分
  const extIndex = fileName.lastIndexOf('.')
  if (extIndex > 0) {
    const ext = fileName.substring(extIndex)
    const name = fileName.substring(0, extIndex)
    return `${name.substring(0, 30)}...${ext}`
  }
  return `${fileName.substring(0, MAX_FILE_NAME_LENGTH - 3)}...`
})

function shouldTruncateFileName(): boolean {
  return (props.progress.fileName || '').length > MAX_FILE_NAME_LENGTH
}

// 根据文件扩展名获取图标
function getFileIcon() {
  const fileName = props.progress.fileName || ''
  const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase()

  const iconMap: Record<string, any> = {
    // 图片
    '.jpg': Picture, '.jpeg': Picture, '.png': Picture, '.gif': Picture,
    '.bmp': Picture, '.webp': Picture, '.svg': Picture, '.ico': Picture,
    // 视频
    '.mp4': VideoCamera, '.avi': VideoCamera, '.mkv': VideoCamera,
    '.mov': VideoCamera, '.wmv': VideoCamera, '.flv': VideoCamera,
    '.webm': VideoCamera, '.m4v': VideoCamera,
    // 音频
    '.mp3': Headset, '.wav': Headset, '.flac': Headset,
    '.aac': Headset, '.ogg': Headset, '.m4a': Headset,
    // 压缩文件
    '.zip': Folder, '.rar': Folder, '.7z': Folder,
    '.tar': Folder, '.gz': Folder, '.bz2': Folder,
    // 文档
    '.pdf': Document, '.doc': Document, '.docx': Document,
    '.xls': Document, '.xlsx': Document, '.ppt': Document,
    '.pptx': Document, '.txt': Document,
  }

  return iconMap[ext] || Files
}

// 根据文件类型获取图标颜色
function getFileIconColor(): string {
  const fileName = props.progress.fileName || ''
  const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase()

  const colorMap: Record<string, string> = {
    // 图片 - 紫色
    '.jpg': '#9c27b0', '.jpeg': '#9c27b0', '.png': '#9c27b0',
    '.gif': '#9c27b0', '.bmp': '#9c27b0', '.webp': '#9c27b0',
    // 视频 - 红色
    '.mp4': '#f44336', '.avi': '#f44336', '.mkv': '#f44336',
    '.mov': '#f44336', '.wmv': '#f44336', '.flv': '#f44336',
    // 音频 - 橙色
    '.mp3': '#ff9800', '.wav': '#ff9800', '.flac': '#ff9800',
    // 压缩文件 - 棕色
    '.zip': '#795548', '.rar': '#795548', '.7z': '#795548',
    // 文档 - 蓝色
    '.pdf': '#2196f3', '.doc': '#2196f3', '.docx': '#2196f3',
    '.xls': '#2196f3', '.xlsx': '#2196f3',
  }

  return colorMap[ext] || '#606266'
}

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

async function handlePause() {
  try {
    // 使用暂停队列功能，因为单个任务暂停API可能不存在
    await transferStore.pauseDownloadQueue()
  } catch (error) {
    console.error('暂停下载失败:', error)
  }
}

function getStatusType(status: string): 'info' | 'success' | 'danger' | 'warning' {
  const types: Record<string, 'info' | 'success' | 'danger' | 'warning'> = {
    pending: 'info',
    in_progress: 'primary',
    paused: 'warning',
    completed: 'success',
    failed: 'danger'
  }
  return types[status] || 'info'
}

function getStatusText(status: string): string {
  const texts: Record<string, string> = {
    pending: '等待中',
    in_progress: '下载中',
    paused: '已暂停',
    completed: '已完成',
    failed: '失败'
  }
  return texts[status] || '未知'
}

function getProgressColor(status: string): string {
  const colors: Record<string, string> = {
    pending: '#909399',
    in_progress: '#409eff',
    paused: '#e6a23c',
    completed: '#67c23a',
    failed: '#f56c6c'
  }
  return colors[status] || '#409eff'
}
</script>

<style scoped>
.download-progress-item {
  padding: 14px 16px;
  border-radius: 10px;
  background-color: var(--el-fill-color-blank);
  margin-bottom: 10px;
  border: 1px solid var(--el-border-color-light);
  transition: all 0.3s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.download-progress-item:hover {
  border-color: var(--el-color-primary);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.15);
  transform: translateY(-1px);
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  flex-wrap: wrap;
  gap: 10px;
}

/* 文件名区域样式 */
.file-name-section {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.file-name-section .el-icon {
  flex-shrink: 0;
}

.file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
  color: var(--el-text-color-primary);
}

/* 详细信息网格布局 */
.progress-details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 8px 16px;
  margin-top: 8px;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background-color: var(--el-fill-color-lighter);
  border-radius: 6px;
  transition: background-color 0.2s ease;
}

.detail-item:hover {
  background-color: var(--el-fill-color-light);
}

.detail-item .el-icon {
  flex-shrink: 0;
}

.progress-percentage {
  font-size: 12px;
  font-weight: 600;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

/* 响应式布局 */
@media (max-width: 600px) {
  .progress-details-grid {
    grid-template-columns: 1fr;
  }

  .progress-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .file-name-section {
    width: 100%;
  }
}
</style>

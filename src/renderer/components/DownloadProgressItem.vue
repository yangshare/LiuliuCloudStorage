/**
 * 下载进度项组件
 * 显示单个下载任务的进度
 */

<template>
  <div class="download-progress-item" :class="`status-${task.status}`">
    <!-- 文件信息 -->
    <div class="file-info">
      <el-icon :size="32" :color="getIconColor()">
        <Download />
      </el-icon>
      <div class="file-details">
        <div class="file-name" :title="task.fileName">
          {{ task.fileName }}
        </div>
        <div class="file-meta">
          {{ formatFileSize(task.fileSize) }}
          <span v-if="task.status === DownloadStatus.DOWNLOADING">
            · {{ formatSpeed(task.speed) }}
          </span>
        </div>
      </div>
    </div>

    <!-- 进度条 -->
    <div class="progress-container">
      <el-progress
        :percentage="task.progress.percentage"
        :status="getProgressStatus()"
        :show-text="false"
      />
      <div class="progress-text">
        <span v-if="task.status === DownloadStatus.DOWNLOADING">
          {{ task.progress.percentage }}%
          <template v-if="task.remainingTime > 0">
            · 剩余 {{ formatRemainingTime(task.remainingTime) }}
          </template>
        </span>
        <span v-else-if="task.status === DownloadStatus.COMPLETED">
          下载完成
        </span>
        <span v-else-if="task.status === DownloadStatus.FAILED">
          {{ task.error || '下载失败' }}
        </span>
        <span v-else-if="task.status === DownloadStatus.PAUSED">
          已暂停
        </span>
        <span v-else>
          等待中...
        </span>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="actions">
      <el-button-group v-if="task.status === DownloadStatus.DOWNLOADING">
        <el-tooltip content="暂停" placement="top">
          <el-button @click="$emit('pause', task.id)" circle>
            <el-icon><VideoPause /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="取消" placement="top">
          <el-button @click="$emit('cancel', task.id)" circle>
            <el-icon><Close /></el-icon>
          </el-button>
        </el-tooltip>
      </el-button-group>

      <el-button-group v-else-if="task.status === DownloadStatus.PAUSED">
        <el-tooltip content="继续" placement="top">
          <el-button @click="$emit('resume', task.id)" type="primary" circle>
            <el-icon><VideoPlay /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="取消" placement="top">
          <el-button @click="$emit('cancel', task.id)" circle>
            <el-icon><Close /></el-icon>
          </el-button>
        </el-tooltip>
      </el-button-group>

      <el-button-group v-else-if="task.status === DownloadStatus.FAILED">
        <el-tooltip content="重试" placement="top">
          <el-button @click="$emit('retry', task.id)" type="warning" circle>
            <el-icon><Refresh /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="取消" placement="top">
          <el-button @click="$emit('cancel', task.id)" circle>
            <el-icon><Close /></el-icon>
          </el-button>
        </el-tooltip>
      </el-button-group>

      <el-button-group v-else-if="task.status === DownloadStatus.COMPLETED">
        <el-tooltip content="打开文件" placement="top">
          <el-button @click="$emit('open', task)" circle>
            <el-icon><FolderOpened /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="打开文件夹" placement="top">
          <el-button @click="$emit('open-folder', task)" circle>
            <el-icon><Folder /></el-icon>
          </el-button>
        </el-tooltip>
      </el-button-group>
    </div>
  </div>
</template>

<script setup lang="ts">
import { DownloadStatus, IDownloadTask } from '@shared/types/download.types';
import {
  Download,
  VideoPlay,
  VideoPause,
  Close,
  Refresh,
  Folder,
  FolderOpened
} from '@element-plus/icons-vue';

interface Props {
  task: IDownloadTask;
}

interface Emits {
  (e: 'pause', taskId: string): void;
  (e: 'resume', taskId: string): void;
  (e: 'cancel', taskId: string): void;
  (e: 'retry', taskId: string): void;
  (e: 'open', task: IDownloadTask): void;
  (e: 'open-folder', task: IDownloadTask): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

const DownloadStatusEnum = DownloadStatus;

/**
 * 获取图标颜色
 */
const getIconColor = (): string => {
  return '#67c23a';
};

/**
 * 获取进度条状态
 */
const getProgressStatus = (): '' | 'success' | 'exception' | 'warning' => {
  switch (props.task.status) {
    case DownloadStatus.COMPLETED:
      return 'success';
    case DownloadStatus.FAILED:
      return 'exception';
    case DownloadStatus.PAUSED:
      return 'warning';
    default:
      return '';
  }
};

/**
 * 格式化文件大小
 */
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};

/**
 * 格式化下载速度
 */
const formatSpeed = (bytesPerSecond: number): string => {
  return formatFileSize(bytesPerSecond) + '/s';
};

/**
 * 格式化剩余时间
 */
const formatRemainingTime = (seconds: number): string => {
  if (seconds < 60) {
    return `${Math.round(seconds)} 秒`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} 分钟`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours} 小时 ${minutes} 分钟`;
  }
};
</script>

<style scoped>
.download-progress-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  transition: all 0.3s;
}

.download-progress-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.download-progress-item.status-completed {
  border-color: #67c23a;
}

.download-progress-item.status-failed {
  border-color: #f56c6c;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.file-details {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 4px;
}

.file-meta {
  font-size: 12px;
  color: #909399;
}

.progress-container {
  flex: 1;
  min-width: 200px;
  max-width: 400px;
}

.progress-text {
  font-size: 12px;
  color: #606266;
  margin-top: 4px;
  text-align: center;
}

.actions {
  flex-shrink: 0;
}
</style>

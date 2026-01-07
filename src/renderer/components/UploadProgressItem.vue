/**
 * 上传进度项组件
 * 显示单个上传任务的进度
 */

<template>
  <div class="upload-progress-item" :class="`status-${task.status}`">
    <!-- 文件信息 -->
    <div class="file-info">
      <el-icon :size="32" :color="getIconColor()">
        <component :is="getIcon()" />
      </el-icon>
      <div class="file-details">
        <div class="file-name" :title="task.file.name">
          {{ task.file.name }}
        </div>
        <div class="file-meta">
          {{ formatFileSize(task.file.size) }}
          <span v-if="task.status === UploadStatus.UPLOADING">
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
        <span v-if="task.status === UploadStatus.UPLOADING">
          {{ task.progress.percentage }}%
          <template v-if="task.remainingTime > 0">
            · 剩余 {{ formatRemainingTime(task.remainingTime) }}
          </template>
        </span>
        <span v-else-if="task.status === UploadStatus.COMPLETED">
          上传完成
        </span>
        <span v-else-if="task.status === UploadStatus.FAILED">
          {{ task.error || '上传失败' }}
        </span>
        <span v-else-if="task.status === UploadStatus.PAUSED">
          已暂停
        </span>
        <span v-else>
          等待中...
        </span>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="actions">
      <el-button-group v-if="task.status === UploadStatus.UPLOADING">
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

      <el-button-group v-else-if="task.status === UploadStatus.PAUSED">
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

      <el-button-group v-else-if="task.status === UploadStatus.FAILED">
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

      <el-button-group v-else-if="task.status === UploadStatus.COMPLETED">
        <el-tooltip content="查看" placement="top">
          <el-button @click="$emit('view', task)" circle>
            <el-icon><View /></el-icon>
          </el-button>
        </el-tooltip>
      </el-button-group>
    </div>
  </div>
</template>

<script setup lang="ts">
import { UploadStatus, IUploadTask } from '@shared/types/upload.types';
import {
  Document,
  Folder,
  VideoPlay,
  VideoPause,
  Close,
  Refresh,
  View,
  CircleCheck,
  CircleClose
} from '@element-plus/icons-vue';

interface Props {
  task: IUploadTask;
}

interface Emits {
  (e: 'pause', taskId: string): void;
  (e: 'resume', taskId: string): void;
  (e: 'cancel', taskId: string): void;
  (e: 'retry', taskId: string): void;
  (e: 'view', task: IUploadTask): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

const UploadStatusEnum = UploadStatus;

/**
 * 获取图标
 */
const getIcon = (): typeof Document | typeof Folder => {
  return Document;
};

/**
 * 获取图标颜色
 */
const getIconColor = (): string => {
  return '#409eff';
};

/**
 * 获取进度条状态
 */
const getProgressStatus = (): '' | 'success' | 'exception' | 'warning' => {
  switch (props.task.status) {
    case UploadStatus.COMPLETED:
      return 'success';
    case UploadStatus.FAILED:
      return 'exception';
    case UploadStatus.PAUSED:
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
 * 格式化上传速度
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
.upload-progress-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  transition: all 0.3s;
}

.upload-progress-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.upload-progress-item.status-completed {
  border-color: #67c23a;
}

.upload-progress-item.status-failed {
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

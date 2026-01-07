/**
 * 上传队列组件
 * 显示上传任务列表
 */

<template>
  <div class="upload-queue-container">
    <!-- 队列头部 -->
    <div class="queue-header">
      <div class="queue-title">
        <el-icon :size="20"><Upload /></el-icon>
        <span>上传队列</span>
        <el-badge v-if="activeCount > 0" :value="activeCount" class="badge" />
      </div>

      <div class="queue-actions">
        <el-button-group v-if="hasActiveTasks">
          <el-tooltip content="全部暂停" placement="bottom">
            <el-button @click="handlePauseAll" size="small">
              <el-icon><VideoPause /></el-icon>
              暂停全部
            </el-button>
          </el-tooltip>
          <el-tooltip content="全部取消" placement="bottom">
            <el-button @click="handleCancelAll" size="small" type="danger">
              <el-icon><Close /></el-icon>
              取消全部
            </el-button>
          </el-tooltip>
        </el-button-group>

        <el-tooltip content="清除已完成" placement="bottom" v-if="completedCount > 0">
          <el-button @click="handleClearCompleted" size="small">
            <el-icon><Delete /></el-icon>
            清除已完成
          </el-button>
        </el-tooltip>

        <el-tooltip content="关闭队列" placement="bottom">
          <el-button @click="$emit('close')" size="small" circle>
            <el-icon><Close /></el-icon>
          </el-button>
        </el-tooltip>
      </div>
    </div>

    <!-- 统计信息 -->
    <div v-if="showStats" class="queue-stats">
      <div class="stat-item">
        <span class="stat-label">总计:</span>
        <span class="stat-value">{{ uploadStats.total }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">上传中:</span>
        <span class="stat-value uploading">{{ uploadStats.uploading }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">已完成:</span>
        <span class="stat-value completed">{{ uploadStats.completed }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">失败:</span>
        <span class="stat-value failed">{{ uploadStats.failed }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">总速度:</span>
        <span class="stat-value">{{ formatSpeed(uploadStats.totalSpeed) }}</span>
      </div>
      <div class="stat-item" v-if="uploadStats.total > 0">
        <span class="stat-label">总进度:</span>
        <span class="stat-value">{{ uploadStats.totalProgress }}%</span>
      </div>
    </div>

    <!-- 任务列表 -->
    <div class="queue-list">
      <el-scrollbar height="400px">
        <div v-if="uploadQueue.length === 0" class="empty-state">
          <el-empty description="暂无上传任务" :image-size="80" />
        </div>

        <div v-else class="task-list">
          <UploadProgressItem
            v-for="task in uploadQueue"
            :key="task.id"
            :task="task"
            @pause="handlePause"
            @resume="handleResume"
            @cancel="handleCancel"
            @retry="handleRetry"
            @view="handleView"
          />
        </div>
      </el-scrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import {
  Upload,
  VideoPause,
  Close,
  Delete
} from '@element-plus/icons-vue';
import { UploadStatus, IUploadTask } from '@shared/types/upload.types';
import { useUpload } from '../composables/useUpload';
import UploadProgressItem from './UploadProgressItem.vue';

interface Emits {
  (e: 'close'): void;
}

const emit = defineEmits<Emits>();
const router = useRouter();

const {
  uploadQueue,
  uploadStats,
  activeUploads,
  completedUploads,
  pauseUpload,
  resumeUpload,
  cancelUpload,
  retryUpload,
  clearCompleted,
  cancelAllUploads,
  formatSpeed
} = useUpload();

const showStats = computed(() => uploadStats.value.total > 0);
const activeCount = computed(() => activeUploads.value.length);
const completedCount = computed(() => completedUploads.value.length);
const hasActiveTasks = computed(() => activeCount.value > 0);

/**
 * 暂停上传
 */
const handlePause = async (taskId: string): Promise<void> => {
  await pauseUpload(taskId);
};

/**
 * 恢复上传
 */
const handleResume = async (taskId: string): Promise<void> => {
  await resumeUpload(taskId);
};

/**
 * 取消上传
 */
const handleCancel = async (taskId: string): Promise<void> => {
  await cancelUpload(taskId);
};

/**
 * 重试上传
 */
const handleRetry = async (taskId: string): Promise<void> => {
  await retryUpload(taskId);
};

/**
 * 查看文件
 */
const handleView = (task: IUploadTask): void => {
  router.push({ path: '/files', query: { path: task.targetPath } });
};

/**
 * 暂停全部
 */
const handlePauseAll = async (): Promise<void> => {
  for (const task of activeUploads.value) {
    await pauseUpload(task.id);
  }
};

/**
 * 取消全部
 */
const handleCancelAll = async (): Promise<void> => {
  await cancelAllUploads();
};

/**
 * 清除已完成
 */
const handleClearCompleted = async (): Promise<void> => {
  await clearCompleted();
};
</script>

<style scoped>
.upload-queue-container {
  position: fixed;
  right: 20px;
  bottom: 20px;
  width: 600px;
  max-height: 600px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 1000;
}

.queue-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
  background: #f5f7fa;
}

.queue-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.queue-actions {
  display: flex;
  gap: 8px;
}

.queue-stats {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
  background: #fafafa;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
}

.stat-label {
  color: #909399;
}

.stat-value {
  font-weight: 600;
  color: #303133;
}

.stat-value.uploading {
  color: #409eff;
}

.stat-value.completed {
  color: #67c23a;
}

.stat-value.failed {
  color: #f56c6c;
}

.queue-list {
  flex: 1;
  overflow: hidden;
}

.empty-state {
  padding: 40px 20px;
  text-align: center;
}

.task-list {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>

/**
 * 下载队列组件
 * 显示下载任务列表
 */

<template>
  <div class="download-queue-container">
    <!-- 队列头部 -->
    <div class="queue-header">
      <div class="queue-title">
        <el-icon :size="20"><Download /></el-icon>
        <span>下载队列</span>
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
        <span class="stat-value">{{ downloadStats.total }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">下载中:</span>
        <span class="stat-value downloading">{{ downloadStats.downloading }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">已完成:</span>
        <span class="stat-value completed">{{ downloadStats.completed }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">失败:</span>
        <span class="stat-value failed">{{ downloadStats.failed }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">总速度:</span>
        <span class="stat-value">{{ formatSpeed(downloadStats.totalSpeed) }}</span>
      </div>
      <div class="stat-item" v-if="downloadStats.total > 0">
        <span class="stat-label">总进度:</span>
        <span class="stat-value">{{ downloadStats.totalProgress }}%</span>
      </div>
    </div>

    <!-- 任务列表 -->
    <div class="queue-list">
      <el-scrollbar height="400px">
        <div v-if="downloadQueue.length === 0" class="empty-state">
          <el-empty description="暂无下载任务" :image-size="80" />
        </div>

        <div v-else class="task-list">
          <DownloadProgressItem
            v-for="task in downloadQueue"
            :key="task.id"
            :task="task"
            @pause="handlePause"
            @resume="handleResume"
            @cancel="handleCancel"
            @retry="handleRetry"
            @open="handleOpen"
            @open-folder="handleOpenFolder"
          />
        </div>
      </el-scrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { shell } from 'electron';
import { Download, VideoPause, Close, Delete } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { DownloadStatus, IDownloadTask } from '@shared/types/download.types';
import { useDownload } from '../composables/useDownload';
import DownloadProgressItem from './DownloadProgressItem.vue';

interface Emits {
  (e: 'close'): void;
}

const emit = defineEmits<Emits>();

const {
  downloadQueue,
  downloadStats,
  activeDownloads,
  completedDownloads,
  pauseDownload,
  resumeDownload,
  cancelDownload,
  retryDownload,
  clearCompleted,
  cancelAllDownloads,
  formatSpeed
} = useDownload();

const showStats = computed(() => downloadStats.value.total > 0);
const activeCount = computed(() => activeDownloads.value.length);
const completedCount = computed(() => completedDownloads.value.length);
const hasActiveTasks = computed(() => activeCount.value > 0);

/**
 * 暂停下载
 */
const handlePause = async (taskId: string): Promise<void> => {
  await pauseDownload(taskId);
};

/**
 * 恢复下载
 */
const handleResume = async (taskId: string): Promise<void> => {
  await resumeDownload(taskId);
};

/**
 * 取消下载
 */
const handleCancel = async (taskId: string): Promise<void> => {
  await cancelDownload(taskId);
};

/**
 * 重试下载
 */
const handleRetry = async (taskId: string): Promise<void> => {
  await retryDownload(taskId);
};

/**
 * 打开文件
 */
const handleOpen = (task: IDownloadTask): void => {
  shell.openPath(task.savePath);
};

/**
 * 打开文件夹
 */
const handleOpenFolder = (task: IDownloadTask): void => {
  const path = require('path');
  shell.openPath(path.dirname(task.savePath));
};

/**
 * 暂停全部
 */
const handlePauseAll = async (): Promise<void> => {
  for (const task of activeDownloads.value) {
    await pauseDownload(task.id);
  }
};

/**
 * 取消全部
 */
const handleCancelAll = async (): Promise<void> => {
  await cancelAllDownloads();
};

/**
 * 清除已完成
 */
const handleClearCompleted = async (): Promise<void> => {
  await clearCompleted();
};
</script>

<style scoped>
.download-queue-container {
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

.stat-value.downloading {
  color: #67c23a;
}

.stat-value.completed {
  color: #409eff;
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

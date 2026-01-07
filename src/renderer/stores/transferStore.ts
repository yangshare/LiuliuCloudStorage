/**
 * 传输状态管理
 * 管理上传和下载任务队列、历史记录和统计信息
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  IUploadTask,
  IUploadStats,
  UploadStatus
} from '@shared/types/upload.types';
import {
  IDownloadTask,
  IDownloadStats,
  DownloadStatus
} from '@shared/types/download.types';
import {
  ITransferStats,
  ITransferHistoryItem,
  TransferType,
  ISpeedLimit,
  TransferPriority
} from '@shared/types/transfer.types';

export const useTransferStore = defineStore('transfer', () => {
  // 状态
  const uploadQueue = ref<IUploadTask[]>([]);
  const downloadQueue = ref<IDownloadTask[]>([]);
  const uploadStats = ref<IUploadStats>({
    total: 0,
    uploading: 0,
    completed: 0,
    failed: 0,
    paused: 0,
    totalSpeed: 0,
    totalProgress: 0
  });
  const downloadStats = ref<IDownloadStats>({
    total: 0,
    downloading: 0,
    completed: 0,
    failed: 0,
    paused: 0,
    totalSpeed: 0,
    totalProgress: 0
  });

  // 传输历史记录
  const transferHistory = ref<ITransferHistoryItem[]>([]);

  // 综合传输统计
  const transferStats = ref<ITransferStats>({
    uploadCount: 0,
    uploadCompleted: 0,
    uploadFailed: 0,
    uploadSpeed: 0,
    uploadTotalSize: 0,
    uploadUploadedSize: 0,
    downloadCount: 0,
    downloadCompleted: 0,
    downloadFailed: 0,
    downloadSpeed: 0,
    downloadTotalSize: 0,
    downloadDownloadedSize: 0,
    totalSpeed: 0,
    totalProgress: 0,
    activeCount: 0,
    todayUploadCount: 0,
    todayDownloadCount: 0,
    todayUploadSize: 0,
    todayDownloadSize: 0,
    lastUpdated: new Date().toISOString()
  });

  // 速度限制配置
  const speedLimit = ref<ISpeedLimit>({
    enabled: false,
    uploadLimit: 0,
    downloadLimit: 0
  });

  // 历史记录配置
  const historyConfig = ref({
    maxHistoryItems: 1000,
    retentionDays: 30
  });

  // 计算属性 - 上传任务
  const activeUploads = computed(() =>
    uploadQueue.value.filter(task =>
      task.status === UploadStatus.UPLOADING ||
      task.status === UploadStatus.PENDING
    )
  );

  const completedUploads = computed(() =>
    uploadQueue.value.filter(task => task.status === UploadStatus.COMPLETED)
  );

  const failedUploads = computed(() =>
    uploadQueue.value.filter(task => task.status === UploadStatus.FAILED)
  );

  const hasActiveUploads = computed(() => activeUploads.value.length > 0);
  const uploadCount = computed(() => uploadQueue.value.length);

  // 计算属性 - 下载任务
  const activeDownloads = computed(() =>
    downloadQueue.value.filter(task =>
      task.status === DownloadStatus.DOWNLOADING ||
      task.status === DownloadStatus.PENDING
    )
  );

  const completedDownloads = computed(() =>
    downloadQueue.value.filter(task => task.status === DownloadStatus.COMPLETED)
  );

  const failedDownloads = computed(() =>
    downloadQueue.value.filter(task => task.status === DownloadStatus.FAILED)
  );

  const hasActiveDownloads = computed(() => activeDownloads.value.length > 0);

  // 计算属性 - 综合统计
  const totalActiveCount = computed(() =>
    activeUploads.value.length + activeDownloads.value.length
  );

  const totalCompletedCount = computed(() =>
    completedUploads.value.length + completedDownloads.value.length
  );

  const totalFailedCount = computed(() =>
    failedUploads.value.length + failedDownloads.value.length
  );

  const totalSpeed = computed(() =>
    uploadStats.value.totalSpeed + downloadStats.value.totalSpeed
  );

  // 计算属性 - 历史记录
  const todayHistory = computed(() => {
    const today = new Date().toDateString();
    return transferHistory.value.filter(item =>
      new Date(item.startTime).toDateString() === today
    );
  });

  const recentHistory = computed(() =>
    transferHistory.value.slice(0, 50) // 最近50条记录
  );

  /**
   * 添加上传任务
   */
  function addUploadTask(task: IUploadTask): void {
    uploadQueue.value.push(task);
    updateUploadStats();
  }

  /**
   * 批量添加上传任务
   */
  function addUploadTasks(tasks: IUploadTask[]): void {
    uploadQueue.value.push(...tasks);
    updateUploadStats();
  }

  /**
   * 更新上传任务
   */
  function updateUploadTask(taskId: string, updates: Partial<IUploadTask>): void {
    const index = uploadQueue.value.findIndex(t => t.id === taskId);
    if (index !== -1) {
      uploadQueue.value[index] = {
        ...uploadQueue.value[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      // 如果任务完成，记录完成时间
      if (updates.status === UploadStatus.COMPLETED && !uploadQueue.value[index].completedAt) {
        uploadQueue.value[index].completedAt = new Date().toISOString();
      }

      updateUploadStats();
    }
  }

  /**
   * 移除上传任务
   */
  function removeUploadTask(taskId: string): void {
    const index = uploadQueue.value.findIndex(t => t.id === taskId);
    if (index !== -1) {
      uploadQueue.value.splice(index, 1);
      updateUploadStats();
    }
  }

  /**
   * 批量移除已完成的任务
   */
  function removeCompletedUploads(): void {
    uploadQueue.value = uploadQueue.value.filter(
      task => task.status !== UploadStatus.COMPLETED
    );
    updateUploadStats();
  }

  /**
   * 清空上传队列
   */
  function clearUploadQueue(): void {
    uploadQueue.value = [];
    updateUploadStats();
  }

  /**
   * 获取上传任务
   */
  function getUploadTask(taskId: string): IUploadTask | undefined {
    return uploadQueue.value.find(t => t.id === taskId);
  }

  /**
   * 更新上传统计
   */
  function updateUploadStats(): void {
    const stats: IUploadStats = {
      total: uploadQueue.value.length,
      uploading: 0,
      completed: 0,
      failed: 0,
      paused: 0,
      totalSpeed: 0,
      totalProgress: 0
    };

    let totalSize = 0;
    let totalUploaded = 0;

    for (const task of uploadQueue.value) {
      switch (task.status) {
        case UploadStatus.UPLOADING:
        case UploadStatus.PENDING:
          stats.uploading++;
          stats.totalSpeed += task.speed;
          break;
        case UploadStatus.COMPLETED:
          stats.completed++;
          totalUploaded += task.progress.total;
          break;
        case UploadStatus.FAILED:
          stats.failed++;
          break;
        case UploadStatus.PAUSED:
          stats.paused++;
          break;
      }

      totalSize += task.progress.total;
      totalUploaded += task.progress.uploaded;
    }

    stats.totalProgress = totalSize > 0 ? Math.round((totalUploaded / totalSize) * 100) : 0;

    uploadStats.value = stats;
  }

  /**
   * 添加下载任务
   */
  function addDownloadTask(task: IUploadTask): void {
    downloadQueue.value.push(task);
  }

  /**
   * 更新下载任务
   */
  function updateDownloadTask(taskId: string, updates: Partial<IUploadTask>): void {
    const index = downloadQueue.value.findIndex(t => t.id === taskId);
    if (index !== -1) {
      downloadQueue.value[index] = {
        ...downloadQueue.value[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      if (updates.status === UploadStatus.COMPLETED && !downloadQueue.value[index].completedAt) {
        downloadQueue.value[index].completedAt = new Date().toISOString();
      }
    }
  }

  /**
   * 移除下载任务
   */
  function removeDownloadTask(taskId: string): void {
    const index = downloadQueue.value.findIndex(t => t.id === taskId);
    if (index !== -1) {
      downloadQueue.value.splice(index, 1);
    }
  }

  /**
   * 清空下载队列
   */
  function clearDownloadQueue(): void {
    downloadQueue.value = [];
  }

  /**
   * 更新下载统计
   */
  function updateDownloadStats(): void {
    const stats: IDownloadStats = {
      total: downloadQueue.value.length,
      downloading: 0,
      completed: 0,
      failed: 0,
      paused: 0,
      totalSpeed: 0,
      totalProgress: 0
    };

    let totalSize = 0;
    let totalDownloaded = 0;

    for (const task of downloadQueue.value) {
      switch (task.status) {
        case DownloadStatus.DOWNLOADING:
        case DownloadStatus.PENDING:
          stats.downloading++;
          stats.totalSpeed += task.speed;
          break;
        case DownloadStatus.COMPLETED:
          stats.completed++;
          totalDownloaded += task.progress.total;
          break;
        case DownloadStatus.FAILED:
          stats.failed++;
          break;
        case DownloadStatus.PAUSED:
          stats.paused++;
          break;
      }

      totalSize += task.progress.total;
      totalDownloaded += task.progress.downloaded;
    }

    stats.totalProgress = totalSize > 0 ? Math.round((totalDownloaded / totalSize) * 100) : 0;

    downloadStats.value = stats;
  }

  /**
   * 更新综合传输统计
   */
  function updateTransferStats(): void {
    updateUploadStats();
    updateDownloadStats();

    const stats: ITransferStats = {
      uploadCount: uploadQueue.value.length,
      uploadCompleted: uploadStats.value.completed,
      uploadFailed: uploadStats.value.failed,
      uploadSpeed: uploadStats.value.totalSpeed,
      uploadTotalSize: uploadQueue.value.reduce((sum, t) => sum + t.progress.total, 0),
      uploadUploadedSize: uploadQueue.value.reduce((sum, t) => sum + t.progress.uploaded, 0),
      downloadCount: downloadQueue.value.length,
      downloadCompleted: downloadStats.value.completed,
      downloadFailed: downloadStats.value.failed,
      downloadSpeed: downloadStats.value.totalSpeed,
      downloadTotalSize: downloadQueue.value.reduce((sum, t) => sum + t.progress.total, 0),
      downloadDownloadedSize: downloadQueue.value.reduce((sum, t) => sum + t.progress.downloaded, 0),
      totalSpeed: uploadStats.value.totalSpeed + downloadStats.value.totalSpeed,
      totalProgress: 0,
      activeCount: totalActiveCount.value,
      todayUploadCount: 0,
      todayDownloadCount: 0,
      todayUploadSize: 0,
      todayDownloadSize: 0,
      lastUpdated: new Date().toISOString()
    };

    // 计算总进度
    const totalSize = stats.uploadTotalSize + stats.downloadTotalSize;
    const totalTransferred = stats.uploadUploadedSize + stats.downloadDownloadedSize;
    stats.totalProgress = totalSize > 0 ? Math.round((totalTransferred / totalSize) * 100) : 0;

    // 计算今日统计
    const today = new Date().toDateString();
    for (const item of transferHistory.value) {
      if (new Date(item.startTime).toDateString() === today) {
        if (item.type === TransferType.UPLOAD) {
          stats.todayUploadCount++;
          stats.todayUploadSize += item.fileSize;
        } else {
          stats.todayDownloadCount++;
          stats.todayDownloadSize += item.fileSize;
        }
      }
    }

    transferStats.value = stats;
  }

  /**
   * 添加历史记录
   */
  function addHistoryItem(item: ITransferHistoryItem): void {
    transferHistory.value.unshift(item);

    // 限制历史记录数量
    if (transferHistory.value.length > historyConfig.value.maxHistoryItems) {
      transferHistory.value = transferHistory.value.slice(0, historyConfig.value.maxHistoryItems);
    }

    // 清理过期记录
    cleanExpiredHistory();
  }

  /**
   * 清理过期历史记录
   */
  function cleanExpiredHistory(): void {
    const now = Date.now();
    const retentionMs = historyConfig.value.retentionDays * 24 * 60 * 60 * 1000;

    transferHistory.value = transferHistory.value.filter(item => {
      const endTime = item.endTime ? new Date(item.endTime).getTime() : now;
      return now - endTime < retentionMs;
    });
  }

  /**
   * 清空历史记录
   */
  function clearHistory(): void {
    transferHistory.value = [];
  }

  /**
   * 移除指定历史记录
   */
  function removeHistoryItem(itemId: string): void {
    const index = transferHistory.value.findIndex(item => item.id === itemId);
    if (index !== -1) {
      transferHistory.value.splice(index, 1);
    }
  }

  /**
   * 设置速度限制
   */
  function setSpeedLimit(limit: Partial<ISpeedLimit>): void {
    speedLimit.value = {
      ...speedLimit.value,
      ...limit
    };
  }

  /**
   * 切换速度限制启用状态
   */
  function toggleSpeedLimit(): void {
    speedLimit.value.enabled = !speedLimit.value.enabled;
  }

  /**
   * 批量操作上传任务
   */
  function batchUploadOperation(operation: string, taskIds: string[]): void {
    for (const taskId of taskIds) {
      const task = uploadQueue.value.find(t => t.id === taskId);
      if (!task) continue;

      switch (operation) {
        case 'pause':
          updateUploadTask(taskId, { status: UploadStatus.PAUSED });
          break;
        case 'resume':
          updateUploadTask(taskId, { status: UploadStatus.PENDING });
          break;
        case 'cancel':
          removeUploadTask(taskId);
          break;
        case 'retry':
          if (task.status === UploadStatus.FAILED) {
            updateUploadTask(taskId, {
              status: UploadStatus.PENDING,
              error: undefined,
              retryCount: task.retryCount + 1
            });
          }
          break;
        case 'remove':
          removeUploadTask(taskId);
          break;
      }
    }
    updateTransferStats();
  }

  /**
   * 批量操作下载任务
   */
  function batchDownloadOperation(operation: string, taskIds: string[]): void {
    for (const taskId of taskIds) {
      const task = downloadQueue.value.find(t => t.id === taskId);
      if (!task) continue;

      switch (operation) {
        case 'pause':
          updateDownloadTask(taskId, { status: DownloadStatus.PAUSED });
          break;
        case 'resume':
          updateDownloadTask(taskId, { status: DownloadStatus.PENDING });
          break;
        case 'cancel':
          removeDownloadTask(taskId);
          break;
        case 'retry':
          if (task.status === DownloadStatus.FAILED) {
            updateDownloadTask(taskId, {
              status: DownloadStatus.PENDING,
              error: undefined,
              retryCount: task.retryCount + 1
            });
          }
          break;
        case 'remove':
          removeDownloadTask(taskId);
          break;
      }
    }
    updateTransferStats();
  }

  /**
   * 清除所有已完成任务
   */
  function clearAllCompleted(): void {
    removeCompletedUploads();
    downloadQueue.value = downloadQueue.value.filter(
      task => task.status !== DownloadStatus.COMPLETED
    );
    updateTransferStats();
  }

  return {
    // 状态
    uploadQueue,
    downloadQueue,
    uploadStats,
    downloadStats,
    transferHistory,
    transferStats,
    speedLimit,
    historyConfig,
    // 计算属性 - 上传
    activeUploads,
    completedUploads,
    failedUploads,
    hasActiveUploads,
    uploadCount,
    // 计算属性 - 下载
    activeDownloads,
    completedDownloads,
    failedDownloads,
    hasActiveDownloads,
    // 计算属性 - 综合
    totalActiveCount,
    totalCompletedCount,
    totalFailedCount,
    totalSpeed,
    // 计算属性 - 历史
    todayHistory,
    recentHistory,
    // 方法 - 上传
    addUploadTask,
    addUploadTasks,
    updateUploadTask,
    removeUploadTask,
    removeCompletedUploads,
    clearUploadQueue,
    getUploadTask,
    updateUploadStats,
    // 方法 - 下载
    addDownloadTask,
    updateDownloadTask,
    removeDownloadTask,
    clearDownloadQueue,
    updateDownloadStats,
    // 方法 - 综合
    updateTransferStats,
    clearAllCompleted,
    // 方法 - 历史
    addHistoryItem,
    removeHistoryItem,
    clearHistory,
    cleanExpiredHistory,
    // 方法 - 速度限制
    setSpeedLimit,
    toggleSpeedLimit,
    // 方法 - 批量操作
    batchUploadOperation,
    batchDownloadOperation
  };
});

/**
 * 文件下载 Composable
 * 封装文件下载逻辑
 */

import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import {
  IDownloadTask,
  IDownloadOptions,
  DownloadStatus
} from '@shared/types/download.types';
import { IFileItem } from '@shared/types/filesystem.types';
import { useTransferStore } from '../stores/transferStore';

export function useDownload() {
  const transferStore = useTransferStore();
  const downloading = ref(false);
  const error = ref<string | null>(null);

  /**
   * 生成任务 ID
   */
  const generateTaskId = (): string => {
    return `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  /**
   * 创建下载任务
   */
  const createDownloadTask = (
    file: IFileItem,
    savePath: string,
    options?: Partial<IDownloadOptions>
  ): IDownloadTask => {
    const now = new Date().toISOString();
    return {
      id: generateTaskId(),
      remotePath: file.path || '/',
      fileName: file.name,
      savePath,
      fileSize: file.size,
      status: DownloadStatus.PENDING,
      progress: {
        downloaded: 0,
        total: file.size,
        percentage: 0
      },
      speed: 0,
      remainingTime: 0,
      retryCount: 0,
      maxRetries: options?.maxRetries || 3,
      createdAt: now,
      updatedAt: now
    };
  };

  /**
   * 选择保存路径
   */
  const selectSavePath = async (defaultFileName?: string): Promise<string | null> => {
    try {
      const response = await window.electronAPI.download.selectPath(defaultFileName);
      if (response.success && response.savePath) {
        return response.savePath;
      }
      return null;
    } catch (err) {
      ElMessage.error('选择保存路径失败');
      return null;
    }
  };

  /**
   * 开始下载
   */
  const startDownload = async (
    files: IFileItem[],
    savePath?: string,
    options?: Partial<IDownloadOptions>
  ): Promise<void> => {
    try {
      downloading.value = true;
      error.value = null;

      // 如果没有指定保存路径，让用户选择
      let finalSavePath = savePath;
      if (!finalSavePath && files.length === 1) {
        finalSavePath = await selectSavePath(files[0].name);
        if (!finalSavePath) {
          throw new Error('未选择保存路径');
        }
      }

      // 创建下载请求
      const requests = files.map(file => ({
        remotePath: file.path || '/',
        fileName: file.name,
        savePath: finalSavePath
      }));

      // 调用主进程下载 API
      const response = await window.electronAPI.download.start(requests, options);

      if (response.success) {
        ElMessage.success(`已添加 ${files.length} 个文件到下载队列`);
      } else {
        throw new Error(response.message || '下载失败');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '下载失败';
      error.value = errorMessage;
      ElMessage.error(errorMessage);
    } finally {
      downloading.value = false;
    }
  };

  /**
   * 单文件下载
   */
  const downloadFile = async (
    file: IFileItem,
    savePath?: string,
    options?: Partial<IDownloadOptions>
  ): Promise<void> => {
    await startDownload([file], savePath, options);
  };

  /**
   * 批量下载
   */
  const downloadFiles = async (
    files: IFileItem[],
    savePath?: string,
    options?: Partial<IDownloadOptions>
  ): Promise<void> => {
    await startDownload(files, savePath, options);
  };

  /**
   * 暂停下载
   */
  const pauseDownload = async (taskId: string): Promise<void> => {
    try {
      const response = await window.electronAPI.download.pause(taskId);
      if (response.success) {
        ElMessage.success('已暂停下载');
      } else {
        ElMessage.error(response.message || '暂停失败');
      }
    } catch (err) {
      ElMessage.error('暂停失败');
    }
  };

  /**
   * 恢复下载
   */
  const resumeDownload = async (taskId: string): Promise<void> => {
    try {
      const response = await window.electronAPI.download.resume(taskId);
      if (response.success) {
        ElMessage.success('已恢复下载');
      } else {
        ElMessage.error(response.message || '恢复失败');
      }
    } catch (err) {
      ElMessage.error('恢复失败');
    }
  };

  /**
   * 取消下载
   */
  const cancelDownload = async (taskId: string): Promise<void> => {
    try {
      const response = await window.electronAPI.download.cancel(taskId);
      if (response.success) {
        ElMessage.success('已取消下载');
      } else {
        ElMessage.error(response.message || '取消失败');
      }
    } catch (err) {
      ElMessage.error('取消失败');
    }
  };

  /**
   * 重试失败的下载
   */
  const retryDownload = async (taskId: string): Promise<void> => {
    try {
      const response = await window.electronAPI.download.retry(taskId);
      if (response.success) {
        ElMessage.success('已重新下载');
      } else {
        ElMessage.error(response.message || '重试失败');
      }
    } catch (err) {
      ElMessage.error('重试失败');
    }
  };

  /**
   * 清除已完成任务
   */
  const clearCompleted = async (): Promise<void> => {
    try {
      const response = await window.electronAPI.download.clearCompleted();
      if (response.success) {
        ElMessage.success('已清除已完成任务');
      } else {
        ElMessage.error(response.message || '清除失败');
      }
    } catch (err) {
      ElMessage.error('清除失败');
    }
  };

  /**
   * 批量取消下载
   */
  const cancelAllDownloads = async (): Promise<void> => {
    const activeTasks = transferStore.activeDownloads;
    for (const task of activeTasks) {
      await cancelDownload(task.id);
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

  return {
    // 状态
    downloading: downloading as { value: boolean },
    error: error as { value: string | null },
    // 计算属性（从 store）
    downloadQueue: computed(() => transferStore.downloadQueue),
    downloadStats: computed(() => transferStore.downloadStats),
    activeDownloads: computed(() => transferStore.activeDownloads),
    completedDownloads: computed(() => transferStore.completedDownloads),
    failedDownloads: computed(() => transferStore.failedDownloads),
    hasActiveDownloads: computed(() => transferStore.hasActiveDownloads),
    // 方法
    selectSavePath,
    downloadFile,
    downloadFiles,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    retryDownload,
    clearCompleted,
    cancelAllDownloads,
    formatFileSize,
    formatSpeed,
    formatRemainingTime
  };
}

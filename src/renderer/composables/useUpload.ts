/**
 * 文件上传 Composable
 * 封装文件上传逻辑
 */

import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import {
  IUploadTask,
  IUploadFile,
  IUploadOptions,
  UploadStatus
} from '@shared/types/upload.types';
import { useTransferStore } from '../stores/transferStore';

export function useUpload() {
  const transferStore = useTransferStore();
  const uploading = ref(false);
  const error = ref<string | null>(null);

  /**
   * 生成任务 ID
   */
  const generateTaskId = (): string => {
    return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  /**
   * 创建上传任务
   */
  const createUploadTask = (
    file: IUploadFile,
    targetPath: string,
    options?: Partial<IUploadOptions>
  ): IUploadTask => {
    const now = new Date().toISOString();
    return {
      id: generateTaskId(),
      file,
      targetPath,
      status: UploadStatus.PENDING,
      progress: {
        uploaded: 0,
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
   * 开始上传
   */
  const startUpload = async (
    files: IUploadFile[],
    targetPath: string,
    options?: Partial<IUploadOptions>
  ): Promise<void> => {
    try {
      uploading.value = true;
      error.value = null;

      // 创建上传任务
      const tasks: IUploadTask[] = files.map(file =>
        createUploadTask(file, targetPath, options)
      );

      // 添加到队列
      transferStore.addUploadTasks(tasks);

      // 调用主进程上传 API
      const response = await window.electronAPI.upload.start(
        files.map(f => ({
          filePath: f.path,
          targetPath,
          fileName: f.name
        })),
        options
      );

      if (response.success) {
        ElMessage.success(`已添加 ${files.length} 个文件到上传队列`);
      } else {
        throw new Error(response.message || '上传失败');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '上传失败';
      error.value = errorMessage;
      ElMessage.error(errorMessage);
    } finally {
      uploading.value = false;
    }
  };

  /**
   * 单文件上传
   */
  const uploadFile = async (
    file: IUploadFile,
    targetPath: string,
    options?: Partial<IUploadOptions>
  ): Promise<void> => {
    await startUpload([file], targetPath, options);
  };

  /**
   * 批量上传
   */
  const uploadFiles = async (
    files: IUploadFile[],
    targetPath: string,
    options?: Partial<IUploadOptions>
  ): Promise<void> => {
    await startUpload(files, targetPath, options);
  };

  /**
   * 暂停上传
   */
  const pauseUpload = async (taskId: string): Promise<void> => {
    try {
      const response = await window.electronAPI.upload.pause(taskId);
      if (response.success) {
        transferStore.updateUploadTask(taskId, {
          status: UploadStatus.PAUSED
        });
        ElMessage.success('已暂停上传');
      } else {
        ElMessage.error(response.message || '暂停失败');
      }
    } catch (err) {
      ElMessage.error('暂停失败');
    }
  };

  /**
   * 恢复上传
   */
  const resumeUpload = async (taskId: string): Promise<void> => {
    try {
      const response = await window.electronAPI.upload.resume(taskId);
      if (response.success) {
        transferStore.updateUploadTask(taskId, {
          status: UploadStatus.UPLOADING
        });
        ElMessage.success('已恢复上传');
      } else {
        ElMessage.error(response.message || '恢复失败');
      }
    } catch (err) {
      ElMessage.error('恢复失败');
    }
  };

  /**
   * 取消上传
   */
  const cancelUpload = async (taskId: string): Promise<void> => {
    try {
      const response = await window.electronAPI.upload.cancel(taskId);
      if (response.success) {
        transferStore.updateUploadTask(taskId, {
          status: UploadStatus.CANCELLED
        });
        transferStore.removeUploadTask(taskId);
        ElMessage.success('已取消上传');
      } else {
        ElMessage.error(response.message || '取消失败');
      }
    } catch (err) {
      ElMessage.error('取消失败');
    }
  };

  /**
   * 重试失败的上传
   */
  const retryUpload = async (taskId: string): Promise<void> => {
    try {
      const response = await window.electronAPI.upload.retry(taskId);
      if (response.success) {
        transferStore.updateUploadTask(taskId, {
          status: UploadStatus.PENDING,
          retryCount: transferStore.getUploadTask(taskId)?.retryCount || 0
        });
        ElMessage.success('已重新上传');
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
      const response = await window.electronAPI.upload.clearCompleted();
      if (response.success) {
        transferStore.removeCompletedUploads();
        ElMessage.success('已清除已完成任务');
      } else {
        ElMessage.error(response.message || '清除失败');
      }
    } catch (err) {
      ElMessage.error('清除失败');
    }
  };

  /**
   * 批量取消上传
   */
  const cancelAllUploads = async (): Promise<void> => {
    const activeTasks = transferStore.activeUploads;
    for (const task of activeTasks) {
      await cancelUpload(task.id);
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

  return {
    // 状态
    uploading: uploading as { value: boolean },
    error: error as { value: string | null },
    // 计算属性（从 store）
    uploadQueue: computed(() => transferStore.uploadQueue),
    uploadStats: computed(() => transferStore.uploadStats),
    activeUploads: computed(() => transferStore.activeUploads),
    completedUploads: computed(() => transferStore.completedUploads),
    failedUploads: computed(() => transferStore.failedUploads),
    hasActiveUploads: computed(() => transferStore.hasActiveUploads),
    // 方法
    uploadFile,
    uploadFiles,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    retryUpload,
    clearCompleted,
    cancelAllUploads,
    formatFileSize,
    formatSpeed,
    formatRemainingTime
  };
}

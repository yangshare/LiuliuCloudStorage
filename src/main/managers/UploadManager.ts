/**
 * 上传管理器
 * 管理上传队列、进度和状态
 */

import { ipcMain, BrowserWindow } from 'electron';
import { readFileSync } from 'fs';
import {
  IUploadTask,
  IUploadFile,
  IUploadOptions,
  UploadStatus
} from '@shared/types/upload.types';
import { AlistService } from '../services/AlistService';

export class UploadManager {
  private static instance: UploadManager;
  private uploadQueue: Map<string, IUploadTask> = new Map();
  private activeUploads: Set<string> = new Set();
  private alistService: AlistService;
  private defaultOptions: IUploadOptions = {
    concurrency: 3,
    maxRetries: 3,
    retryDelay: 2000,
    timeout: 60000
  };

  private constructor() {
    this.alistService = AlistService.getInstance();
  }

  static getInstance(): UploadManager {
    if (!UploadManager.instance) {
      UploadManager.instance = new UploadManager();
    }
    return UploadManager.instance;
  }

  /**
   * 添加上传任务
   */
  addUploadTasks(
    files: IUploadFile[],
    targetPath: string,
    options?: Partial<IUploadOptions>
  ): string[] {
    const taskIds: string[] = [];
    const opts = { ...this.defaultOptions, ...options };

    for (const file of files) {
      const taskId = this.generateTaskId();
      const now = new Date().toISOString();

      const task: IUploadTask = {
        id: taskId,
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
        maxRetries: opts.maxRetries || 3,
        createdAt: now,
        updatedAt: now
      };

      this.uploadQueue.set(taskId, task);
      taskIds.push(taskId);
    }

    // 开始处理队列
    this.processQueue(opts);

    return taskIds;
  }

  /**
   * 处理上传队列
   */
  private async processQueue(options: IUploadOptions): Promise<void> {
    const concurrency = options.concurrency || 3;

    // 查找待处理任务
    const pendingTasks = Array.from(this.uploadQueue.values())
      .filter(task => task.status === UploadStatus.PENDING)
      .slice(0, concurrency - this.activeUploads.size);

    for (const task of pendingTasks) {
      if (this.activeUploads.size >= concurrency) break;

      this.activeUploads.add(task.id);
      this.uploadFile(task, options);
    }
  }

  /**
   * 上传单个文件
   */
  private async uploadFile(task: IUploadTask, options: IUploadOptions): Promise<void> {
    try {
      // 更新状态为上传中
      this.updateTaskStatus(task.id, UploadStatus.UPLOADING);

      // 读取文件内容
      const fileContent = readFileSync(task.file.path);

      // 调用 Alist 上传 API
      const response = await this.alistService.uploadFile(
        task.targetPath,
        task.file.name,
        fileContent,
        (progress) => {
          // 进度回调
          this.updateTaskProgress(task.id, {
            uploaded: progress.loaded,
            total: progress.total,
            percentage: Math.round((progress.loaded / progress.total) * 100)
          });
        }
      );

      if (response.code === 200) {
        // 上传成功
        this.updateTaskStatus(task.id, UploadStatus.COMPLETED);
        this.sendCompletedEvent(task);
      } else {
        throw new Error(response.message || '上传失败');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '上传失败';

      if (task.retryCount < task.maxRetries) {
        // 重试
        task.retryCount++;
        this.updateTaskStatus(task.id, UploadStatus.PENDING);
        setTimeout(() => {
          this.uploadFile(task, options);
        }, options.retryDelay);
      } else {
        // 失败
        this.updateTaskStatus(task.id, UploadStatus.FAILED, errorMessage);
        this.sendFailedEvent(task);
      }
    } finally {
      this.activeUploads.delete(task.id);
      // 继续处理队列
      this.processQueue(options);
    }
  }

  /**
   * 暂停上传
   */
  pauseUpload(taskId: string): boolean {
    const task = this.uploadQueue.get(taskId);
    if (task && (task.status === UploadStatus.PENDING || task.status === UploadStatus.UPLOADING)) {
      this.updateTaskStatus(taskId, UploadStatus.PAUSED);
      this.activeUploads.delete(taskId);
      return true;
    }
    return false;
  }

  /**
   * 恢复上传
   */
  resumeUpload(taskId: string): boolean {
    const task = this.uploadQueue.get(taskId);
    if (task && task.status === UploadStatus.PAUSED) {
      this.updateTaskStatus(taskId, UploadStatus.PENDING);
      this.processQueue(this.defaultOptions);
      return true;
    }
    return false;
  }

  /**
   * 取消上传
   */
  cancelUpload(taskId: string): boolean {
    const task = this.uploadQueue.get(taskId);
    if (task) {
      this.activeUploads.delete(taskId);
      this.updateTaskStatus(taskId, UploadStatus.CANCELLED);
      this.uploadQueue.delete(taskId);
      return true;
    }
    return false;
  }

  /**
   * 重试上传
   */
  retryUpload(taskId: string): boolean {
    const task = this.uploadQueue.get(taskId);
    if (task && task.status === UploadStatus.FAILED) {
      task.retryCount = 0;
      this.updateTaskStatus(taskId, UploadStatus.PENDING);
      this.processQueue(this.defaultOptions);
      return true;
    }
    return false;
  }

  /**
   * 清除已完成任务
   */
  clearCompleted(): number {
    let count = 0;
    for (const [taskId, task] of this.uploadQueue.entries()) {
      if (task.status === UploadStatus.COMPLETED) {
        this.uploadQueue.delete(taskId);
        count++;
      }
    }
    return count;
  }

  /**
   * 更新任务状态
   */
  private updateTaskStatus(taskId: string, status: UploadStatus, error?: string): void {
    const task = this.uploadQueue.get(taskId);
    if (task) {
      task.status = status;
      task.updatedAt = new Date().toISOString();
      if (error) {
        task.error = error;
      }
      this.sendProgressEvent(task);
    }
  }

  /**
   * 更新任务进度
   */
  private updateTaskProgress(taskId: string, progress: { uploaded: number; total: number; percentage: number }): void {
    const task = this.uploadQueue.get(taskId);
    if (task) {
      task.progress = progress;

      // 计算速度
      const now = Date.now();
      const created = new Date(task.createdAt).getTime();
      const elapsed = (now - created) / 1000;
      if (elapsed > 0) {
        task.speed = Math.round(progress.uploaded / elapsed);

        // 计算剩余时间
        const remaining = progress.total - progress.uploaded;
        if (task.speed > 0) {
          task.remainingTime = Math.round(remaining / task.speed);
        }
      }

      task.updatedAt = new Date().toISOString();
      this.sendProgressEvent(task);
    }
  }

  /**
   * 发送进度事件
   */
  private sendProgressEvent(task: IUploadTask): void {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      mainWindow.webContents.send('upload:progress', task);
    }
  }

  /**
   * 发送完成事件
   */
  private sendCompletedEvent(task: IUploadTask): void {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      mainWindow.webContents.send('upload:completed', task);
    }
  }

  /**
   * 发送失败事件
   */
  private sendFailedEvent(task: IUploadTask): void {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      mainWindow.webContents.send('upload:failed', task);
    }
  }

  /**
   * 生成任务 ID
   */
  private generateTaskId(): string {
    return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取所有任务
   */
  getAllTasks(): IUploadTask[] {
    return Array.from(this.uploadQueue.values());
  }

  /**
   * 获取任务
   */
  getTask(taskId: string): IUploadTask | undefined {
    return this.uploadQueue.get(taskId);
  }
}

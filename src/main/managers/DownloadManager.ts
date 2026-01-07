/**
 * 下载管理器
 * 管理下载队列、进度和状态
 */

import { ipcMain, BrowserWindow, dialog } from 'electron';
import { createWriteStream, ensureDirSync, existsSync } from 'fs-extra';
import { join, dirname } from 'path';
import {
  IDownloadTask,
  IDownloadOptions,
  DownloadStatus
} from '@shared/types/download.types';
import { AlistService } from '../services/AlistService';

export class DownloadManager {
  private static instance: DownloadManager;
  private downloadQueue: Map<string, IDownloadTask> = new Map();
  private activeDownloads: Set<string> = new Set();
  private alistService: AlistService;
  private defaultOptions: IDownloadOptions = {
    concurrency: 3,
    maxRetries: 3,
    retryDelay: 2000,
    timeout: 60000,
    overwrite: false
  };

  private constructor() {
    this.alistService = AlistService.getInstance();
  }

  static getInstance(): DownloadManager {
    if (!DownloadManager.instance) {
      DownloadManager.instance = new DownloadManager();
    }
    return DownloadManager.instance;
  }

  /**
   * 选择保存路径
   */
  async selectSavePath(defaultFileName?: string): Promise<string | null> {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (!mainWindow) return null;

    const result = await dialog.showSaveDialog(mainWindow, {
      title: '选择保存位置',
      defaultPath: defaultFileName,
      buttonLabel: '保存'
    });

    return result.canceled ? null : result.filePath || null;
  }

  /**
   * 添加下载任务
   */
  addDownloadTasks(
    requests: Array<{ remotePath: string; fileName: string; savePath?: string }>,
    options?: Partial<IDownloadOptions>
  ): string[] {
    const taskIds: string[] = [];
    const opts = { ...this.defaultOptions, ...options };

    for (const req of requests) {
      const taskId = this.generateTaskId();
      const now = new Date().toISOString();

      const task: IDownloadTask = {
        id: taskId,
        remotePath: req.remotePath,
        fileName: req.fileName,
        savePath: req.savePath || '',
        fileSize: 0,
        status: DownloadStatus.PENDING,
        progress: {
          downloaded: 0,
          total: 0,
          percentage: 0
        },
        speed: 0,
        remainingTime: 0,
        retryCount: 0,
        maxRetries: opts.maxRetries || 3,
        createdAt: now,
        updatedAt: now
      };

      this.downloadQueue.set(taskId, task);
      taskIds.push(taskId);
    }

    // 开始处理队列
    this.processQueue(opts);

    return taskIds;
  }

  /**
   * 处理下载队列
   */
  private async processQueue(options: IDownloadOptions): Promise<void> {
    const concurrency = options.concurrency || 3;

    // 查找待处理任务
    const pendingTasks = Array.from(this.downloadQueue.values())
      .filter(task => task.status === DownloadStatus.PENDING)
      .slice(0, concurrency - this.activeDownloads.size);

    for (const task of pendingTasks) {
      if (this.activeDownloads.size >= concurrency) break;

      this.activeDownloads.add(task.id);
      this.downloadFile(task, options);
    }
  }

  /**
   * 下载单个文件
   */
  private async downloadFile(task: IDownloadTask, options: IDownloadOptions): Promise<void> {
    try {
      // 更新状态为下载中
      this.updateTaskStatus(task.id, DownloadStatus.DOWNLOADING);

      // 确保目录存在
      const saveDir = dirname(task.savePath);
      ensureDirSync(saveDir);

      // 调用 Alist 下载 API 获取文件流
      const response = await this.alistService.download(task.remotePath);

      // 创建写入流
      const writeStream = createWriteStream(task.savePath);

      // 获取文件大小
      const contentLength = response.headers['content-length'];
      task.progress.total = parseInt(contentLength || '0', 10);
      task.fileSize = task.progress.total;

      let downloaded = 0;
      const startTime = Date.now();

      // 管道传输数据
      response.data.on('data', (chunk: Buffer) => {
        downloaded += chunk.length;
        const progress = {
          downloaded,
          total: task.progress.total,
          percentage: task.progress.total > 0
            ? Math.round((downloaded / task.progress.total) * 100)
            : 0
        };
        this.updateTaskProgress(task.id, progress);
      });

      // 将响应流写入文件
      response.data.pipe(writeStream);

      // 等待写入完成
      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      // 下载成功
      this.updateTaskStatus(task.id, DownloadStatus.COMPLETED);
      this.sendCompletedEvent(task);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '下载失败';

      if (task.retryCount < task.maxRetries) {
        // 重试
        task.retryCount++;
        this.updateTaskStatus(task.id, DownloadStatus.PENDING);
        setTimeout(() => {
          this.downloadFile(task, options);
        }, options.retryDelay);
      } else {
        // 失败
        this.updateTaskStatus(task.id, DownloadStatus.FAILED, errorMessage);
        this.sendFailedEvent(task);
      }
    } finally {
      this.activeDownloads.delete(task.id);
      // 继续处理队列
      this.processQueue(options);
    }
  }

  /**
   * 暂停下载
   */
  pauseDownload(taskId: string): boolean {
    const task = this.downloadQueue.get(taskId);
    if (task && (task.status === DownloadStatus.PENDING || task.status === DownloadStatus.DOWNLOADING)) {
      this.updateTaskStatus(taskId, DownloadStatus.PAUSED);
      this.activeDownloads.delete(taskId);
      return true;
    }
    return false;
  }

  /**
   * 恢复下载
   */
  resumeDownload(taskId: string): boolean {
    const task = this.downloadQueue.get(taskId);
    if (task && task.status === DownloadStatus.PAUSED) {
      this.updateTaskStatus(taskId, DownloadStatus.PENDING);
      this.processQueue(this.defaultOptions);
      return true;
    }
    return false;
  }

  /**
   * 取消下载
   */
  cancelDownload(taskId: string): boolean {
    const task = this.downloadQueue.get(taskId);
    if (task) {
      this.activeDownloads.delete(taskId);
      this.updateTaskStatus(taskId, DownloadStatus.CANCELLED);
      this.downloadQueue.delete(taskId);
      return true;
    }
    return false;
  }

  /**
   * 重试下载
   */
  retryDownload(taskId: string): boolean {
    const task = this.downloadQueue.get(taskId);
    if (task && task.status === DownloadStatus.FAILED) {
      task.retryCount = 0;
      this.updateTaskStatus(taskId, DownloadStatus.PENDING);
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
    for (const [taskId, task] of this.downloadQueue.entries()) {
      if (task.status === DownloadStatus.COMPLETED) {
        this.downloadQueue.delete(taskId);
        count++;
      }
    }
    return count;
  }

  /**
   * 更新任务状态
   */
  private updateTaskStatus(taskId: string, status: DownloadStatus, error?: string): void {
    const task = this.downloadQueue.get(taskId);
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
  private updateTaskProgress(taskId: string, progress: { downloaded: number; total: number; percentage: number }): void {
    const task = this.downloadQueue.get(taskId);
    if (task) {
      task.progress = progress;

      // 计算速度
      const now = Date.now();
      const created = new Date(task.createdAt).getTime();
      const elapsed = (now - created) / 1000;
      if (elapsed > 0) {
        task.speed = Math.round(progress.downloaded / elapsed);

        // 计算剩余时间
        const remaining = progress.total - progress.downloaded;
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
  private sendProgressEvent(task: IDownloadTask): void {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      mainWindow.webContents.send('download:progress', task);
    }
  }

  /**
   * 发送完成事件
   */
  private sendCompletedEvent(task: IDownloadTask): void {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      mainWindow.webContents.send('download:completed', task);
    }
  }

  /**
   * 发送失败事件
   */
  private sendFailedEvent(task: IDownloadTask): void {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      mainWindow.webContents.send('download:failed', task);
    }
  }

  /**
   * 生成任务 ID
   */
  private generateTaskId(): string {
    return `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取所有任务
   */
  getAllTasks(): IDownloadTask[] {
    return Array.from(this.downloadQueue.values());
  }

  /**
   * 获取任务
   */
  getTask(taskId: string): IDownloadTask | undefined {
    return this.downloadQueue.get(taskId);
  }
}

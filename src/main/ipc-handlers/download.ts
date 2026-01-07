/**
 * 下载 IPC 处理器
 * 处理渲染进程的下载请求
 */

import { ipcMain } from 'electron';
import { DownloadManager } from '../managers/DownloadManager';
import { IDownloadOptions } from '@shared/types/download.types';

export function registerDownloadHandlers(): void {
  const downloadManager = DownloadManager.getInstance();

  /**
   * 开始下载
   */
  ipcMain.handle('download:start', async (_event, requests: any[], options?: Partial<IDownloadOptions>) => {
    try {
      const taskIds = downloadManager.addDownloadTasks(requests, options);

      return {
        success: true,
        message: `已添加 ${requests.length} 个文件到下载队列`,
        taskIds
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '下载失败';
      return {
        success: false,
        message
      };
    }
  });

  /**
   * 选择保存路径
   */
  ipcMain.handle('download:select-path', async (_event, defaultFileName?: string) => {
    try {
      const savePath = await downloadManager.selectSavePath(defaultFileName);
      return {
        success: true,
        savePath
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '选择路径失败';
      return {
        success: false,
        message
      };
    }
  });

  /**
   * 暂停下载
   */
  ipcMain.handle('download:pause', async (_event, taskId: string) => {
    try {
      const success = downloadManager.pauseDownload(taskId);
      return {
        success,
        message: success ? '已暂停下载' : '暂停失败'
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '暂停失败';
      return {
        success: false,
        message
      };
    }
  });

  /**
   * 恢复下载
   */
  ipcMain.handle('download:resume', async (_event, taskId: string) => {
    try {
      const success = downloadManager.resumeDownload(taskId);
      return {
        success,
        message: success ? '已恢复下载' : '恢复失败'
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '恢复失败';
      return {
        success: false,
        message
      };
    }
  });

  /**
   * 取消下载
   */
  ipcMain.handle('download:cancel', async (_event, taskId: string) => {
    try {
      const success = downloadManager.cancelDownload(taskId);
      return {
        success,
        message: success ? '已取消下载' : '取消失败'
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '取消失败';
      return {
        success: false,
        message
      };
    }
  });

  /**
   * 重试下载
   */
  ipcMain.handle('download:retry', async (_event, taskId: string) => {
    try {
      const success = downloadManager.retryDownload(taskId);
      return {
        success,
        message: success ? '已重新下载' : '重试失败'
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '重试失败';
      return {
        success: false,
        message
      };
    }
  });

  /**
   * 清除已完成任务
   */
  ipcMain.handle('download:clear-completed', async () => {
    try {
      const count = downloadManager.clearCompleted();
      return {
        success: true,
        message: `已清除 ${count} 个已完成任务`
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '清除失败';
      return {
        success: false,
        message
      };
    }
  });
}

/**
 * 上传 IPC 处理器
 * 处理渲染进程的上传请求
 */

import { ipcMain } from 'electron';
import { UploadManager } from '../managers/UploadManager';
import { IUploadFile, IUploadOptions } from '@shared/types/upload.types';

export function registerUploadHandlers(): void {
  const uploadManager = UploadManager.getInstance();

  /**
   * 开始上传
   */
  ipcMain.handle('upload:start', async (_event, requests: any[], options?: Partial<IUploadOptions>) => {
    try {
      const files: IUploadFile[] = requests.map(req => ({
        name: req.fileName || req.filePath.split('/').pop() || 'unknown',
        path: req.filePath,
        size: 0, // 从文件读取
        type: 'application/octet-stream',
        lastModified: new Date().toISOString()
      }));

      const taskIds = uploadManager.addUploadTasks(files, requests[0]?.targetPath || '/', options);

      return {
        success: true,
        message: `已添加 ${files.length} 个文件到上传队列`,
        taskIds
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '上传失败';
      return {
        success: false,
        message
      };
    }
  });

  /**
   * 暂停上传
   */
  ipcMain.handle('upload:pause', async (_event, taskId: string) => {
    try {
      const success = uploadManager.pauseUpload(taskId);
      return {
        success,
        message: success ? '已暂停上传' : '暂停失败'
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
   * 恢复上传
   */
  ipcMain.handle('upload:resume', async (_event, taskId: string) => {
    try {
      const success = uploadManager.resumeUpload(taskId);
      return {
        success,
        message: success ? '已恢复上传' : '恢复失败'
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
   * 取消上传
   */
  ipcMain.handle('upload:cancel', async (_event, taskId: string) => {
    try {
      const success = uploadManager.cancelUpload(taskId);
      return {
        success,
        message: success ? '已取消上传' : '取消失败'
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
   * 重试上传
   */
  ipcMain.handle('upload:retry', async (_event, taskId: string) => {
    try {
      const success = uploadManager.retryUpload(taskId);
      return {
        success,
        message: success ? '已重新上传' : '重试失败'
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
  ipcMain.handle('upload:clear-completed', async () => {
    try {
      const count = uploadManager.clearCompleted();
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

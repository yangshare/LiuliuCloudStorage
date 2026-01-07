/**
 * 文件系统相关的 IPC 处理器
 * 集成路径虚拟化和权限验证
 */

import { ipcMain } from 'electron';
import { alistService } from '../services/AlistService';
import { sessionManager } from '../managers/SessionManager';
import { SecurityAuditDAO } from '../db/securityAudit.dao';

/**
 * 注册文件系统相关的 IPC 处理器
 */
export function registerFilesystemHandlers(): void {
  /**
   * 列出文件处理器
   */
  ipcMain.handle('fs:list', async (_event, path: string = '/') => {
    try {
      // 检查是否已登录
      const session = sessionManager.getCurrentSession();
      if (!session) {
        return {
          success: false,
          message: '未登录'
        };
      }

      const result = await alistService.listFiles(path);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '列出文件失败';

      // 记录安全日志
      const session = sessionManager.getCurrentSession();
      if (session) {
        SecurityAuditDAO.logPermissionDenied(session.username, path);
      }

      return {
        success: false,
        message: errorMessage
      };
    }
  });

  /**
   * 创建目录处理器
   */
  ipcMain.handle('fs:mkdir', async (_event, path: string) => {
    try {
      const session = sessionManager.getCurrentSession();
      if (!session) {
        return {
          success: false,
          message: '未登录'
        };
      }

      // 验证路径安全性
      const { PathTransform } = await import('@shared/utils/pathTransform');
      if (PathTransform.containsPathTraversal(path)) {
        SecurityAuditDAO.logPathTraversalAttempt(session.username, path);
        return {
          success: false,
          message: '路径包含非法字符'
        };
      }

      const result = await alistService.mkdir(path);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '创建目录失败';
      return {
        success: false,
        message: errorMessage
      };
    }
  });

  /**
   * 重命名处理器
   */
  ipcMain.handle('fs:rename', async (_event, path: string, newName: string) => {
    try {
      const session = sessionManager.getCurrentSession();
      if (!session) {
        return {
          success: false,
          message: '未登录'
        };
      }

      const result = await alistService.rename(path, newName);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '重命名失败';
      return {
        success: false,
        message: errorMessage
      };
    }
  });

  /**
   * 删除处理器
   */
  ipcMain.handle('fs:delete', async (_event, path: string) => {
    try {
      const session = sessionManager.getCurrentSession();
      if (!session) {
        return {
          success: false,
          message: '未登录'
        };
      }

      const result = await alistService.delete(path);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '删除失败';
      return {
        success: false,
        message: errorMessage
      };
    }
  });

  /**
   * 上传文件处理器
   */
  ipcMain.handle('fs:upload', async (_event, fileData: ArrayBuffer, filename: string, targetPath: string) => {
    try {
      const session = sessionManager.getCurrentSession();
      if (!session) {
        return {
          success: false,
          message: '未登录'
        };
      }

      const buffer = Buffer.from(fileData);
      const fullPath = targetPath.endsWith('/') ? `${targetPath}${filename}` : `${targetPath}/${filename}`;

      const result = await alistService.upload(buffer, fullPath);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '上传失败';
      return {
        success: false,
        message: errorMessage
      };
    }
  });

  /**
   * 下载文件处理器
   */
  ipcMain.handle('fs:download', async (_event, path: string) => {
    try {
      const session = sessionManager.getCurrentSession();
      if (!session) {
        return {
          success: false,
          message: '未登录'
        };
      }

      const result = await alistService.download(path);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '下载失败';
      return {
        success: false,
        message: errorMessage
      };
    }
  });

  /**
   * 获取用户配置处理器
   */
  ipcMain.handle('user:get-config', async () => {
    try {
      const session = sessionManager.getCurrentSession();
      if (!session) {
        return {
          success: false,
          message: '未登录'
        };
      }

      const { userConfigManager } = await import('../managers/UserConfigManager');
      const config = userConfigManager.getConfig(session.username);

      if (config) {
        return {
          success: true,
          data: {
            basePath: config.basePath,
            permissions: config.permissions
          }
        };
      } else {
        return {
          success: false,
          message: '用户配置不存在'
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取配置失败';
      return {
        success: false,
        message: errorMessage
      };
    }
  });
}

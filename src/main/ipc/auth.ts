/**
 * 认证相关的 IPC 处理器
 */

import { ipcMain } from 'electron';
import { alistService } from '../services/AlistService';
import { orchestrationService } from '../services/OrchestrationService';
import { sessionManager } from '../managers/SessionManager';
import { tokenManager } from '../managers/TokenManager';
import { IAuthRequest, IRegisterRequest, IResetPasswordRequest } from '@shared/types/auth.types';

/**
 * 注册认证相关的 IPC 处理器
 */
export function registerAuthHandlers(): void {
  /**
   * 登录处理器
   */
  ipcMain.handle('auth:login', async (_event, request: IAuthRequest) => {
    try {
      // 调用 Alist 登录 API
      const response = await alistService.login(request);

      if (response.code === 200) {
        // 创建会话
        const token = response.data.token;
        sessionManager.createSession(request.username, token);

        // 设置 Token
        tokenManager.setToken(token);

        return {
          success: true,
          message: '登录成功',
          data: {
            username: request.username
          }
        };
      } else {
        return {
          success: false,
          message: response.message || '登录失败'
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '登录失败'
      };
    }
  });

  /**
   * 注册处理器
   */
  ipcMain.handle('auth:register', async (_event, request: IRegisterRequest) => {
    try {
      // 调用 n8n 注册 Webhook
      const response = await orchestrationService.register(request);

      if (response.success) {
        return {
          success: true,
          message: response.message || '注册成功',
          data: response.data
        };
      } else {
        return {
          success: false,
          message: response.message || '注册失败'
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '注册失败'
      };
    }
  });

  /**
   * 登出处理器
   */
  ipcMain.handle('auth:logout', async () => {
    try {
      // 清除会话
      sessionManager.clearCurrentSession();

      // 清除 Token
      tokenManager.clearToken();

      return {
        success: true,
        message: '登出成功'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '登出失败'
      };
    }
  });

  /**
   * 密码重置处理器
   */
  ipcMain.handle('auth:reset-password', async (_event, request: IResetPasswordRequest) => {
    try {
      // 调用 n8n 密码重置 Webhook
      const response = await orchestrationService.resetPassword(request);

      if (response.success) {
        return {
          success: true,
          message: response.message || '密码重置成功'
        };
      } else {
        return {
          success: false,
          message: response.message || '密码重置失败'
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '密码重置失败'
      };
    }
  });

  /**
   * 获取当前会话处理器
   */
  ipcMain.handle('auth:get-session', async () => {
    try {
      const session = sessionManager.getCurrentSession();

      if (session) {
        return {
          success: true,
          data: {
            username: session.username,
            isAuthenticated: true
          }
        };
      } else {
        return {
          success: true,
          data: {
            isAuthenticated: false
          }
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '获取会话失败'
      };
    }
  });
}

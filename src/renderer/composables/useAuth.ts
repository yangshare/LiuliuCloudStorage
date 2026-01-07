/**
 * 用户认证 Composable
 * 封装登录、注册、登出等逻辑
 */

import { ref } from 'vue';
import { useUserStore } from '../stores/userStore';
import {
  IAuthRequest,
  IRegisterRequest,
  IResetPasswordRequest
} from '@shared/types/auth.types';

/**
 * 使用认证
 */
export function useAuth() {
  const userStore = useUserStore();

  // 加载状态
  const loading = ref(false);
  const error = ref<string | null>(null);

  /**
   * 登录
   */
  const login = async (request: IAuthRequest): Promise<{ success: boolean; message?: string }> => {
    loading.value = true;
    error.value = null;

    try {
      const response = await window.electronAPI.auth.login(request);

      if (response.success && response.data) {
        // 登录成功，更新用户状态
        userStore.login(response.data.token || '', {
          username: response.data.username
        });
      } else {
        error.value = response.message || '登录失败';
      }

      loading.value = false;
      return response;
    } catch (err) {
      loading.value = false;
      const errorMessage = err instanceof Error ? err.message : '登录失败';
      error.value = errorMessage;
      return { success: false, message: errorMessage };
    }
  };

  /**
   * 注册
   */
  const register = async (
    request: IRegisterRequest
  ): Promise<{ success: boolean; message?: string }> => {
    loading.value = true;
    error.value = null;

    try {
      const response = await window.electronAPI.auth.register(request);
      loading.value = false;

      if (!response.success) {
        error.value = response.message || '注册失败';
      }

      return response;
    } catch (err) {
      loading.value = false;
      const errorMessage = err instanceof Error ? err.message : '注册失败';
      error.value = errorMessage;
      return { success: false, message: errorMessage };
    }
  };

  /**
   * 登出
   */
  const logout = async (): Promise<{ success: boolean; message?: string }> => {
    loading.value = true;
    error.value = null;

    try {
      const response = await window.electronAPI.auth.logout();

      if (response.success) {
        // 登出成功，清除用户状态
        userStore.logout();
      } else {
        error.value = response.message || '登出失败';
      }

      loading.value = false;
      return response;
    } catch (err) {
      loading.value = false;
      const errorMessage = err instanceof Error ? err.message : '登出失败';
      error.value = errorMessage;
      return { success: false, message: errorMessage };
    }
  };

  /**
   * 密码重置
   */
  const resetPassword = async (
    request: IResetPasswordRequest
  ): Promise<{ success: boolean; message?: string }> => {
    loading.value = true;
    error.value = null;

    try {
      const response = await window.electronAPI.auth.resetPassword(request);
      loading.value = false;

      if (!response.success) {
        error.value = response.message || '密码重置失败';
      }

      return response;
    } catch (err) {
      loading.value = false;
      const errorMessage = err instanceof Error ? err.message : '密码重置失败';
      error.value = errorMessage;
      return { success: false, message: errorMessage };
    }
  };

  /**
   * 获取当前会话
   */
  const getSession = async (): Promise<{ isAuthenticated: boolean; username?: string }> => {
    try {
      const response = await window.electronAPI.auth.getSession();

      if (response.success && response.data) {
        if (response.data.isAuthenticated) {
          // 已登录，更新用户状态
          userStore.login('', {
            username: response.data.username
          });
        }
        return {
          isAuthenticated: response.data.isAuthenticated,
          username: response.data.username
        };
      }

      return { isAuthenticated: false };
    } catch (err) {
      console.error('Failed to get session:', err);
      return { isAuthenticated: false };
    }
  };

  /**
   * 清除错误
   */
  const clearError = (): void => {
    error.value = null;
  };

  return {
    // 状态
    loading,
    error,
    // 计算属性
    isLoggedIn: userStore.isLoggedIn,
    userInfo: userStore.userInfo,
    // 方法
    login,
    register,
    logout,
    resetPassword,
    getSession,
    clearError
  };
}

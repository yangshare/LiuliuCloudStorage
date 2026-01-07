/**
 * 用户状态管理
 * 使用 Pinia 管理用户认证状态和配置
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { IUserInfo } from '@shared/types/auth.types';
import { IUserConfig } from '@shared/types/multi-tenant.types';

export const useUserStore = defineStore('user', () => {
  // 状态
  const token = ref<string>('');
  const userInfo = ref<IUserInfo | null>(null);
  const userConfig = ref<IUserConfig | null>(null);

  // 计算属性
  const isLoggedIn = computed(() => !!token.value && !!userInfo.value);
  const basePath = computed(() => userConfig.value?.basePath || '');

  /**
   * 设置 Token
   */
  function setToken(newToken: string): void {
    token.value = newToken;
  }

  /**
   * 设置用户信息
   */
  function setUserInfo(info: IUserInfo): void {
    userInfo.value = info;
  }

  /**
   * 登录
   */
  function login(newToken: string, info: IUserInfo): void {
    setToken(newToken);
    setUserInfo(info);
  }

  /**
   * 登出
   */
  function logout(): void {
    token.value = '';
    userInfo.value = null;
  }

  /**
   * 更新用户信息
   */
  function updateUserInfo(info: Partial<IUserInfo>): void {
    if (userInfo.value) {
      userInfo.value = { ...userInfo.value, ...info };
    }
  }

  /**
   * 设置用户配置
   */
  function setUserConfig(config: IUserConfig): void {
    userConfig.value = config;
  }

  /**
   * 加载用户配置
   */
  async function loadUserConfig(): Promise<void> {
    try {
      const response = await window.electronAPI.user.getConfig();
      if (response.success && response.data) {
        // 这里 username 需要从会话中获取
        const username = userInfo.value?.username || 'current_user';
        userConfig.value = {
          username,
          basePath: response.data.basePath,
          permissions: response.data.permissions,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }
    } catch (error) {
      console.error('加载用户配置失败:', error);
    }
  }

  return {
    // 状态
    token,
    userInfo,
    userConfig,
    // 计算属性
    isLoggedIn,
    basePath,
    // 方法
    setToken,
    setUserInfo,
    login,
    logout,
    updateUserInfo,
    setUserConfig,
    loadUserConfig
  };
});

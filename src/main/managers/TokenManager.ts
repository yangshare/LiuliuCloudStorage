/**
 * Token 管理器
 * 管理 Token 的自动刷新、过期检测等
 */

import { alistService } from '../services/AlistService';

/**
 * Token 管理器类
 */
export class TokenManager {
  private static instance: TokenManager;
  private refreshTimer: NodeJS.Timeout | null = null;
  private readonly REFRESH_INTERVAL = 4 * 60 * 1000; // 4 分钟刷新一次（Token 通常 5 分钟过期）

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  /**
   * 设置 Token
   */
  public setToken(token: string): void {
    alistService.setToken(token);
    this.startAutoRefresh();
  }

  /**
   * 获取 Token
   */
  public getToken(): string {
    return alistService.getToken();
  }

  /**
   * 清除 Token
   */
  public clearToken(): void {
    this.stopAutoRefresh();
    alistService.clearToken();
  }

  /**
   * 检查 Token 是否过期
   */
  public isTokenExpired(): boolean {
    // 简单实现：如果无法获取 Token，认为已过期
    return !alistService.isAuthenticated();
  }

  /**
   * 启动自动刷新
   */
  private startAutoRefresh(): void {
    // 清除现有定时器
    this.stopAutoRefresh();

    // 设置新的定时器
    this.refreshTimer = setInterval(() => {
      this.refreshToken();
    }, this.REFRESH_INTERVAL);
  }

  /**
   * 停止自动刷新
   */
  private stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * 刷新 Token
   * 注意：Alist 的 Token 刷新机制需要根据实际 API 实现
   * 这里提供基础框架
   */
  private async refreshToken(): Promise<void> {
    try {
      // TODO: 实现 Token 刷新逻辑
      // 目前 Alist 可能不支持 Token 刷新，需要重新登录
      console.log('Token refresh check');
    } catch (error) {
      console.error('Failed to refresh token:', error);
      // Token 刷新失败，触发重新登录
      this.clearToken();
    }
  }
}

/**
 * 导出 Token 管理器实例
 */
export const tokenManager = TokenManager.getInstance();

/**
 * 会话管理器
 * 管理用户登录会话，包括会话创建、恢复、清理等
 */

import { randomUUID } from 'crypto';
import { IUserSession, IUserInfo } from '@shared/types/auth.types';
import { SessionDAO } from '../db/session.dao';
import { safeStorage } from 'electron';
import { app } from 'electron';

/**
 * 会话管理器类
 */
export class SessionManager {
  private static instance: SessionManager;
  private currentSession: IUserSession | null = null;

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  /**
   * 创建会话
   */
  public createSession(username: string, token: string): IUserSession {
    // 生成唯一会话 ID 和设备 ID
    const sessionId = randomUUID();
    const deviceId = this.getOrCreateDeviceId();
    const now = new Date().toISOString();

    // 创建会话对象
    const session: IUserSession = {
      id: sessionId,
      username,
      token,
      createdAt: now,
      lastActiveAt: now,
      deviceId
    };

    // 加密 Token 并保存到数据库
    const encryptedToken = this.encryptToken(token);
    const sessionToSave = { ...session, token: encryptedToken };

    // 保存到数据库
    SessionDAO.save(sessionToSave);

    // 保存到内存（明文 Token，仅用于当前会话）
    this.currentSession = session;

    return session;
  }

  /**
   * 恢复会话
   * 应用启动时从数据库恢复最新的会话
   */
  public restoreSession(): IUserSession | null {
    try {
      // 获取最近的会话
      const sessions = SessionDAO.findAll();
      if (sessions.length === 0) {
        return null;
      }

      const latestSession = sessions[0];

      // 解密 Token
      const decryptedToken = this.decryptToken(latestSession.token);

      // 创建会话对象（使用解密后的 Token）
      this.currentSession = {
        ...latestSession,
        token: decryptedToken
      };

      // 更新最后活跃时间
      this.updateLastActive();

      return this.currentSession;
    } catch (error) {
      console.error('Failed to restore session:', error);
      return null;
    }
  }

  /**
   * 获取当前会话
   */
  public getCurrentSession(): IUserSession | null {
    return this.currentSession;
  }

  /**
   * 获取当前用户信息
   */
  public getCurrentUser(): IUserInfo | null {
    if (!this.currentSession) {
      return null;
    }
    return {
      username: this.currentSession.username
    };
  }

  /**
   * 更新会话最后活跃时间
   */
  public updateLastActive(): void {
    if (this.currentSession) {
      this.currentSession.lastActiveAt = new Date().toISOString();
      SessionDAO.updateLastActive(this.currentSession.id);
    }
  }

  /**
   * 清除当前会话
   */
  public clearCurrentSession(): void {
    if (this.currentSession) {
      // 从数据库删除
      SessionDAO.delete(this.currentSession.id);
      this.currentSession = null;
    }
  }

  /**
   * 清除用户的所有会话
   */
  public clearAllSessions(username: string): void {
    SessionDAO.deleteByUsername(username);
    this.currentSession = null;
  }

  /**
   * 检查是否已登录
   */
  public isAuthenticated(): boolean {
    return !!this.currentSession;
  }

  /**
   * 加密 Token
   */
  private encryptToken(token: string): string {
    if (safeStorage.isEncryptionAvailable()) {
      const buffer = Buffer.from(token, 'utf-8');
      const encrypted = safeStorage.encryptString(buffer);
      return encrypted.toString('base64');
    }
    // 如果加密不可用，直接返回（开发环境）
    return token;
  }

  /**
   * 解密 Token
   */
  private decryptToken(encryptedToken: string): string {
    if (safeStorage.isEncryptionAvailable()) {
      try {
        const buffer = Buffer.from(encryptedToken, 'base64');
        const decrypted = safeStorage.decryptString(buffer);
        return decrypted.toString('utf-8');
      } catch (error) {
        console.error('Failed to decrypt token:', error);
        throw new Error('Token 解密失败');
      }
    }
    // 如果加密不可用，直接返回（开发环境）
    return encryptedToken;
  }

  /**
   * 获取或创建设备 ID
   */
  private getOrCreateDeviceId(): string {
    const userDataPath = app.getPath('userData');
    const deviceIdFile = require('path').join(userDataPath, '.device-id');

    try {
      const fs = require('fs');
      if (fs.existsSync(deviceIdFile)) {
        return fs.readFileSync(deviceIdFile, 'utf-8').trim();
      }
      // 创建新的设备 ID
      const newDeviceId = randomUUID();
      fs.writeFileSync(deviceIdFile, newDeviceId, 'utf-8');
      return newDeviceId;
    } catch (error) {
      console.error('Failed to get/create device ID:', error);
      return randomUUID();
    }
  }
}

/**
 * 导出会话管理器实例
 */
export const sessionManager = SessionManager.getInstance();

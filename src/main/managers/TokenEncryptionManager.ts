/**
 * Token 加密管理器
 * 使用 Electron safeStorage API 加密存储用户 Token
 */

import { safeStorage } from 'electron';
import { IEncryptedToken } from '@shared/types/security.types';

export class TokenEncryptionManager {
  private static instance: TokenEncryptionManager;
  private isEncryptionAvailable: boolean = false;

  private constructor() {
    // 检查 safeStorage 是否可用
    this.isEncryptionAvailable = safeStorage.isEncryptionAvailable();
    if (!this.isEncryptionAvailable) {
      console.warn('safeStorage is not available on this platform');
    }
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): TokenEncryptionManager {
    if (!TokenEncryptionManager.instance) {
      TokenEncryptionManager.instance = new TokenEncryptionManager();
    }
    return TokenEncryptionManager.instance;
  }

  /**
   * 加密 Token
   */
  public encryptToken(token: string): string {
    if (!this.isEncryptionAvailable) {
      throw new Error('Encryption is not available');
    }

    try {
      const buffer = Buffer.from(token, 'utf-8');
      const encryptedBuffer = safeStorage.encryptString(buffer);
      return encryptedBuffer.toString('base64');
    } catch (error) {
      console.error('Failed to encrypt token:', error);
      throw new Error('Token encryption failed');
    }
  }

  /**
   * 解密 Token
   */
  public decryptToken(encryptedToken: string): string {
    if (!this.isEncryptionAvailable) {
      throw new Error('Encryption is not available');
    }

    try {
      const encryptedBuffer = Buffer.from(encryptedToken, 'base64');
      const decryptedBuffer = safeStorage.decryptString(encryptedBuffer);
      return decryptedBuffer.toString('utf-8');
    } catch (error) {
      console.error('Failed to decrypt token:', error);
      throw new Error('Token decryption failed');
    }
  }

  /**
   * 加密字符串（通用）
   */
  public encryptString(text: string): string {
    if (!this.isEncryptionAvailable) {
      throw new Error('Encryption is not available');
    }

    try {
      const buffer = Buffer.from(text, 'utf-8');
      const encryptedBuffer = safeStorage.encryptString(buffer);
      return encryptedBuffer.toString('base64');
    } catch (error) {
      console.error('Failed to encrypt string:', error);
      throw new Error('String encryption failed');
    }
  }

  /**
   * 解密字符串（通用）
   */
  public decryptString(encryptedText: string): string {
    if (!this.isEncryptionAvailable) {
      throw new Error('Encryption is not available');
    }

    try {
      const encryptedBuffer = Buffer.from(encryptedText, 'base64');
      const decryptedBuffer = safeStorage.decryptString(encryptedBuffer);
      return decryptedBuffer.toString('utf-8');
    } catch (error) {
      console.error('Failed to decrypt string:', error);
      throw new Error('String decryption failed');
    }
  }

  /**
   * 检查加密是否可用
   */
  public isAvailable(): boolean {
    return this.isEncryptionAvailable;
  }

  /**
   * 加密 Token 并创建存储对象
   */
  public createEncryptedToken(
    userId: number,
    username: string,
    token: string,
    expiresIn?: number
  ): IEncryptedToken {
    const now = new Date();
    const expiresAt = expiresIn
      ? new Date(now.getTime() + expiresIn * 1000)
      : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 默认 30 天

    return {
      userId,
      username,
      encryptedToken: this.encryptToken(token),
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString()
    };
  }

  /**
   * 从加密的 Token 对象中解密
   */
  public decryptEncryptedToken(encrypted: IEncryptedToken): string {
    return this.decryptToken(encrypted.encryptedToken);
  }
}

// 导出单例实例
export const tokenEncryptionManager = TokenEncryptionManager.getInstance();

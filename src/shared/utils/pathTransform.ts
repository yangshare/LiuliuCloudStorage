/**
 * 路径转换工具
 * 实现虚拟路径和物理路径之间的转换，包含安全验证
 */

import { IPathValidationResult } from '@shared/types/multi-tenant.types';

/**
 * 路径转换工具类
 */
export class PathTransform {
  /**
   * 将虚拟路径转换为物理路径
   * @param virtualPath 用户看到的虚拟路径 (如: /documents/photo.jpg)
   * @param basePath 用户的基础路径 (如: /root/users/username)
   * @returns 转换后的物理路径
   */
  public static virtualToPhysical(virtualPath: string, basePath: string): string {
    // 标准化虚拟路径
    const normalized = this.normalizePath(virtualPath);

    // 检查路径安全性
    this.validatePathSecurity(normalized);

    // 拼接基础路径和虚拟路径
    // 如果虚拟路径是根路径，直接返回基础路径
    if (normalized === '/' || normalized === '') {
      return basePath;
    }

    // 移除开头的斜杠，然后拼接
    const relativePath = normalized.startsWith('/') ? normalized.slice(1) : normalized;
    return `${basePath}/${relativePath}`;
  }

  /**
   * 将物理路径转换为虚拟路径
   * @param physicalPath 实际的物理路径 (如: /root/users/username/documents/photo.jpg)
   * @param basePath 用户的基础路径 (如: /root/users/username)
   * @returns 转换后的虚拟路径
   */
  public static physicalToVirtual(physicalPath: string, basePath: string): string {
    // 标准化路径
    const normalizedPhysical = this.normalizePath(physicalPath);
    const normalizedBase = this.normalizePath(basePath);

    // 验证物理路径是否在基础路径下
    if (!normalizedPhysical.startsWith(normalizedBase)) {
      throw new Error('物理路径不在用户基础路径范围内');
    }

    // 如果物理路径就是基础路径，返回根路径
    if (normalizedPhysical === normalizedBase) {
      return '/';
    }

    // 提取相对路径
    const relativePath = normalizedPhysical.slice(normalizedBase.length);
    return relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  }

  /**
   * 验证路径访问权限
   * @param path 要访问的路径
   * @param basePath 用户的基础路径
   * @returns 验证结果
   */
  public static validatePathAccess(path: string, basePath: string): IPathValidationResult {
    try {
      // 标准化路径
      const normalizedPath = this.normalizePath(path);

      // 检查路径穿越攻击
      if (this.containsPathTraversal(normalizedPath)) {
        return {
          valid: false,
          error: '检测到路径穿越攻击尝试'
        };
      }

      // 检查是否为绝对路径
      if (this.isAbsolutePath(normalizedPath)) {
        return {
          valid: false,
          error: '不允许使用绝对路径'
        };
      }

      // 转换为物理路径
      const physicalPath = this.virtualToPhysical(normalizedPath, basePath);

      // 验证物理路径是否在基础路径下
      if (!physicalPath.startsWith(basePath)) {
        return {
          valid: false,
          error: '访问路径超出用户权限范围'
        };
      }

      return {
        valid: true,
        physicalPath
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : '路径验证失败'
      };
    }
  }

  /**
   * 标准化路径
   * @param path 原始路径
   * @returns 标准化后的路径
   */
  private static normalizePath(path: string): string {
    if (!path) {
      return '/';
    }

    // 移除多余的斜杠
    let normalized = path.replace(/\/+/g, '/');

    // 移除结尾的斜杠（根路径除外）
    if (normalized !== '/' && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }

    return normalized;
  }

  /**
   * 验证路径安全性
   * @param path 要验证的路径
   * @throws 如果路径不安全则抛出错误
   */
  private static validatePathSecurity(path: string): void {
    // 检查路径穿越
    if (this.containsPathTraversal(path)) {
      throw new Error('路径包含非法字符 (../)');
    }

    // 检查绝对路径
    if (this.isAbsolutePath(path)) {
      throw new Error('不允许使用绝对路径');
    }

    // 检查特殊字符
    const invalidChars = ['\0', '\\', ':', '*', '?', '"', '<', '>', '|'];
    for (const char of invalidChars) {
      if (path.includes(char)) {
        throw new Error(`路径包含非法字符: ${char}`);
      }
    }
  }

  /**
   * 检测路径穿越攻击
   * @param path 要检查的路径
   * @returns 是否包含路径穿越
   */
  public static containsPathTraversal(path: string): boolean {
    return path.includes('../') || path.includes('..\\');
  }

  /**
   * 检测是否为绝对路径
   * @param path 要检查的路径
   * @returns 是否为绝对路径
   */
  private static isAbsolutePath(path: string): boolean {
    // Unix/Linux 绝对路径
    if (path.startsWith('/')) {
      // 根路径除外
      if (path === '/') {
        return false;
      }
      // 检查是否是双斜杠开头的网络路径
      if (path.startsWith('//')) {
        return true;
      }
      // 单斜杠开头在虚拟路径中是相对路径
      return false;
    }

    // Windows 绝对路径 (如 C:\)
    if (/^[A-Za-z]:\\/.test(path)) {
      return true;
    }

    return false;
  }

  /**
   * 安全地连接路径
   * @param base 基础路径
   * @param relative 相对路径
   * @returns 连接后的路径
   */
  public static joinPath(base: string, relative: string): string {
    const normalizedBase = this.normalizePath(base);
    const normalizedRelative = this.normalizePath(relative);

    // 如果相对路径是根路径
    if (normalizedRelative === '/') {
      return normalizedBase;
    }

    // 移除相对路径开头的斜杠
    const relativePath = normalizedRelative.startsWith('/')
      ? normalizedRelative.slice(1)
      : normalizedRelative;

    return `${normalizedBase}/${relativePath}`;
  }
}

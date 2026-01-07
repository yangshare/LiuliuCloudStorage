/**
 * Alist API 服务封装
 * 支持路径虚拟化和多租户隔离
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { IAuthRequest, IAuthResponse } from '@shared/types/auth.types';
import { config } from '@shared/constants/config';
import { PathTransform } from '@shared/utils/pathTransform';
import { userConfigManager } from '../managers/UserConfigManager';

/**
 * Alist 服务类
 */
export class AlistService {
  private static instance: AlistService;
  private client: AxiosInstance;
  private token: string = '';

  private constructor() {
    // 创建 axios 实例
    this.client = axios.create({
      baseURL: config.alist.baseUrl,
      timeout: config.alist.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // 添加请求拦截器
    this.client.interceptors.request.use(
      (config) => {
        // 自动附加 Token
        if (this.token) {
          config.headers.Authorization = this.token;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // 添加响应拦截器
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        // 处理 Token 过期
        if (error.response?.status === 401) {
          // Token 过期，清除本地 Token
          this.token = '';
          // 可以在这里触发登出逻辑
          return Promise.reject(new Error('Token已过期，请重新登录'));
        }
        return Promise.reject(error);
      }
    );
  }

  static getInstance(): AlistService {
    if (!AlistService.instance) {
      AlistService.instance = new AlistService();
    }
    return AlistService.instance;
  }

  /**
   * 用户登录
   */
  public async login(request: IAuthRequest): Promise<IAuthResponse> {
    try {
      const response = await this.client.post<IAuthResponse>('/api/auth/login', request);
      const { data } = response;

      // 保存 Token
      if (data.code === 200 && data.data.token) {
        this.token = data.data.token;
      }

      return data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`登录失败: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * 设置 Token
   */
  public setToken(token: string): void {
    this.token = token;
  }

  /**
   * 获取 Token
   */
  public getToken(): string {
    return this.token;
  }

  /**
   * 清除 Token
   */
  public clearToken(): void {
    this.token = '';
  }

  /**
   * 检查是否已登录
   */
  public isAuthenticated(): boolean {
    return !!this.token;
  }

  /**
   * 获取当前用户名
   */
  private getCurrentUsername(): string {
    // 从 Token 或会话中获取用户名
    // 这里简化实现，实际应该从会话管理器获取
    return 'current_user'; // 临时实现
  }

  /**
   * 转换虚拟路径为物理路径
   */
  private toPhysicalPath(virtualPath: string): string {
    const username = this.getCurrentUsername();
    const basePath = userConfigManager.getBasePath(username);
    return PathTransform.virtualToPhysical(virtualPath, basePath);
  }

  /**
   * 验证路径访问权限
   */
  private validatePath(virtualPath: string): void {
    const username = this.getCurrentUsername();
    const basePath = userConfigManager.getBasePath(username);
    const result = PathTransform.validatePathAccess(virtualPath, basePath);

    if (!result.valid) {
      throw new Error(result.error || '路径访问被拒绝');
    }
  }

  /**
   * 列出文件
   * @param virtualPath 虚拟路径
   */
  public async listFiles(virtualPath: string = '/'): Promise<any> {
    // 验证路径
    this.validatePath(virtualPath);

    // 转换为物理路径
    const physicalPath = this.toPhysicalPath(virtualPath);

    try {
      const response = await this.client.post('/api/fs/list', {
        path: physicalPath,
        password: '',
        page: 1,
        per_page: 0,
        refresh: false
      });

      // 转换返回的路径为虚拟路径
      if (response.data.code === 200 && response.data.data.content) {
        const username = this.getCurrentUsername();
        const basePath = userConfigManager.getBasePath(username);

        response.data.data.content = response.data.data.content.map((item: any) => ({
          ...item,
          // 如果有路径字段，转换为虚拟路径
          path: item.path ? PathTransform.physicalToVirtual(item.path, basePath) : virtualPath
        }));
      }

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`列出文件失败: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * 创建目录
   * @param virtualPath 虚拟路径
   */
  public async mkdir(virtualPath: string): Promise<any> {
    // 验证路径
    this.validatePath(virtualPath);

    // 转换为物理路径
    const physicalPath = this.toPhysicalPath(virtualPath);

    try {
      const response = await this.client.post('/api/fs/mkdir', {
        path: physicalPath
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`创建目录失败: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * 重命名文件/目录
   * @param virtualPath 虚拟路径
   * @param newName 新名称
   */
  public async rename(virtualPath: string, newName: string): Promise<any> {
    // 验证路径
    this.validatePath(virtualPath);

    // 转换为物理路径
    const physicalPath = this.toPhysicalPath(virtualPath);

    try {
      const response = await this.client.post('/api/fs/rename', {
        path: physicalPath,
        new_name: newName
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`重命名失败: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * 删除文件/目录
   * @param virtualPath 虚拟路径
   */
  public async delete(virtualPath: string): Promise<any> {
    // 验证路径
    this.validatePath(virtualPath);

    // 转换为物理路径
    const physicalPath = this.toPhysicalPath(virtualPath);

    try {
      const response = await this.client.post('/api/fs/remove', {
        path: physicalPath,
        dir: virtualPath.endsWith('/') // 简单判断是否为目录
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`删除失败: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * 上传文件
   * @param file 文件
   * @param virtualPath 目标虚拟路径
   */
  public async upload(file: Buffer | File, virtualPath: string, onProgress?: (progress: number) => void): Promise<any> {
    // 验证路径
    this.validatePath(virtualPath);

    // 转换为物理路径
    const physicalPath = this.toPhysicalPath(virtualPath);

    try {
      const response = await this.client.put('/api/fs/put', file, {
        headers: {
          'File-Path': encodeURIComponent(physicalPath),
          'Content-Type': 'application/octet-stream',
          'As-Task': 'true'
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(progress);
          }
        }
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`上传失败: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * 上传文件到指定路径
   * @param targetPath 目标虚拟路径
   * @param fileName 文件名
   * @param fileData 文件数据
   * @param onProgress 进度回调
   */
  public async uploadFile(
    targetPath: string,
    fileName: string,
    fileData: Buffer,
    onProgress?: (progress: { loaded: number; total: number }) => void
  ): Promise<any> {
    // 验证路径
    this.validatePath(targetPath);

    // 构建完整路径
    const fullPath = `${targetPath}/${fileName}`.replace(/\/+/g, '/');

    // 转换为物理路径
    const physicalPath = this.toPhysicalPath(fullPath);

    try {
      const response = await this.client.put('/api/fs/put', fileData, {
        headers: {
          'File-Path': encodeURIComponent(physicalPath),
          'Content-Type': 'application/octet-stream',
          'As-Task': 'true'
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            onProgress({
              loaded: progressEvent.loaded,
              total: progressEvent.total
            });
          }
        }
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`上传失败: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * 下载文件
   * @param virtualPath 虚拟路径
   */
  public async download(virtualPath: string): Promise<any> {
    // 验证路径
    this.validatePath(virtualPath);

    // 转换为物理路径
    const physicalPath = this.toPhysicalPath(virtualPath);

    try {
      const response = await this.client.post('/api/fs/get', {
        path: physicalPath
      }, {
        responseType: 'stream'
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`下载失败: ${error.message}`);
      }
      throw error;
    }
  }
}

/**
 * 导出服务实例
 */
export const alistService = new AlistService();

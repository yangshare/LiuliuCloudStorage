/**
 * n8n 编排服务封装
 * 处理用户注册、密码重置等需要调用 Alist Admin API 的操作
 */

import axios, { AxiosError } from 'axios';
import {
  IRegisterRequest,
  IRegisterResponse,
  IResetPasswordRequest,
  IResetPasswordResponse
} from '@shared/types/auth.types';
import { config } from '@shared/constants/config';

/**
 * n8n 编排服务类
 */
export class OrchestrationService {
  private client: axios.AxiosInstance;

  constructor() {
    // 创建 axios 实例
    this.client = axios.create({
      baseURL: config.n8n.baseUrl,
      timeout: config.alist.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * 用户注册
   * 调用 n8n Webhook，由 n8n 调用 Alist Admin API 创建用户和目录
   */
  public async register(request: IRegisterRequest): Promise<IRegisterResponse> {
    try {
      const webhookUrl = config.n8n.baseUrl + config.n8n.webhookPath.register;
      const response = await this.client.post<IRegisterResponse>(webhookUrl, request);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // 处理网络错误
        if (error.code === 'ECONNREFUSED') {
          throw new Error('无法连接到注册服务，请检查 n8n 是否运行');
        }
        throw new Error(`注册失败: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * 密码重置
   * 调用 n8n Webhook，由 n8n 调用 Alist Admin API 重置密码
   */
  public async resetPassword(request: IResetPasswordRequest): Promise<IResetPasswordResponse> {
    try {
      const webhookUrl = config.n8n.baseUrl + config.n8n.webhookPath.resetPassword;
      const response = await this.client.post<IResetPasswordResponse>(webhookUrl, request);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // 处理网络错误
        if (error.code === 'ECONNREFUSED') {
          throw new Error('无法连接到密码重置服务，请检查 n8n 是否运行');
        }
        throw new Error(`密码重置失败: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * 健康检查
   * 检查 n8n 服务是否可用
   */
  public async healthCheck(): Promise<boolean> {
    try {
      // 尝试连接 n8n
      await this.client.get('/');
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * 导出服务实例
 */
export const orchestrationService = new OrchestrationService();

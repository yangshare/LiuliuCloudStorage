import axios from 'axios'
import { alistService, ListFilesResponse } from './AlistService'

/**
 * 配额计算服务
 * 负责计算用户的实际存储使用量
 */
export class QuotaCalculationService {
  private n8nWebhookUrl: string

  // Story 6.2 MEDIUM FIX: 最大递归深度限制，防止栈溢出
  private readonly MAX_RECURSION_DEPTH = 50

  constructor() {
    this.n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678'
  }

  /**
   * 计算用户配额使用量
   * @param userId 用户ID
   * @param username 用户名
   * @returns 配额使用量（字节）
   */
  async calculateQuota(userId: number, username: string): Promise<number> {
    try {
      const userPath = '/alist/'

      // 方法1: 尝试通过 n8n Webhook 计算配额（更准确）
      try {
        const response = await axios.post(`${this.n8nWebhookUrl}/api/quota/calculate`, {
          userId,
          username,
          path: userPath
        }, {
          timeout: 5000 // 5秒超时
        })

        if (response.data && response.data.quotaUsed !== undefined) {
          console.log('[QuotaCalculationService] 使用 n8n Webhook 计算配额:', response.data.quotaUsed)
          return response.data.quotaUsed
        }
      } catch (n8nError) {
        console.warn('[QuotaCalculationService] n8n Webhook 调用失败，降级到 Alist API:', n8nError)
      }

      // 方法2: 降级方案 - 通过 Alist API 递归计算目录大小
      const dirSize = await this.getDirectorySize(userPath)
      console.log('[QuotaCalculationService] 使用 Alist API 计算配额:', dirSize)
      return dirSize

    } catch (error) {
      console.error('[QuotaCalculationService] 计算配额失败:', error)
      throw new Error('计算配额失败')
    }
  }

  /**
   * 递归获取目录大小（通过 Alist API）
   * Story 6.2 MEDIUM FIX: 添加深度限制防止栈溢出
   *
   * @param path 目录路径
   * @param currentDepth 当前递归深度（内部使用）
   * @returns 目录总大小（字节）
   */
  private async getDirectorySize(path: string, currentDepth: number = 0): Promise<number> {
    // Story 6.2 MEDIUM FIX: 深度限制检查
    if (currentDepth > this.MAX_RECURSION_DEPTH) {
      console.warn(`[QuotaCalculationService] 达到最大递归深度 ${this.MAX_RECURSION_DEPTH}，停止计算: ${path}`)
      return 0
    }

    try {
      const files: ListFilesResponse = await alistService.listFiles(path)

      let totalSize = 0

      for (const file of files.content) {
        if (file.isDir) {
          // 递归计算子目录大小（传递深度+1）
          const subPath = `${path}${file.name}/`
          const subDirSize = await this.getDirectorySize(subPath, currentDepth + 1)
          totalSize += subDirSize
        } else {
          // 累加文件大小
          totalSize += file.size
        }
      }

      return totalSize

    } catch (error) {
      console.error(`[QuotaCalculationService] 获取目录大小失败 (${path}, depth: ${currentDepth}):`, error)
      return 0
    }
  }

  /**
   * 获取单个路径的直接文件大小（不递归）
   * @param path 文件或目录路径
   * @returns 大小（字节）
   */
  async getPathSize(path: string): Promise<number> {
    try {
      const files: ListFilesResponse = await alistService.listFiles(path)
      return files.content.reduce((total, file) => total + file.size, 0)
    } catch (error) {
      console.error(`[QuotaCalculationService] 获取路径大小失败 (${path}):`, error)
      return 0
    }
  }
}

export const quotaCalculationService = new QuotaCalculationService()

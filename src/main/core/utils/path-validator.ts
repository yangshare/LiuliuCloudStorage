import * as fs from 'fs'
import * as path from 'path'

export interface ValidationResult {
  valid: boolean
  error?: string
  canCreate?: boolean
}

/**
 * 路径验证工具类
 * 用于验证文件路径的有效性和可写性
 */
export class PathValidator {
  /**
   * 验证路径是否可写
   * @param targetPath 目标文件路径
   * @returns 验证结果
   */
  static validateWritablePath(targetPath: string): ValidationResult {
    try {
      const dir = path.dirname(targetPath)

      // 检查目录是否存在
      if (!fs.existsSync(dir)) {
        return {
          valid: false,
          error: '目录不存在',
          canCreate: true
        }
      }

      // 检查是否可写
      try {
        fs.accessSync(dir, fs.constants.W_OK)
      } catch {
        return {
          valid: false,
          error: '目录不可写'
        }
      }

      return { valid: true }
    } catch (error: any) {
      return {
        valid: false,
        error: error.message
      }
    }
  }

  /**
   * 递归创建目录
   * @param filePath 文件路径
   */
  static ensureDirectoryExists(filePath: string): void {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }
}

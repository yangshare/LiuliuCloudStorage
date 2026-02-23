import { ipcMain } from 'electron'
import { getConfig, isConfigComplete, saveConfig, reinitializeServices } from '../../config'
import type { AppConfig } from '../../config'
import { loggerService } from '../../services/LoggerService'

/**
 * 安全的错误消息转换（过滤敏感信息）
 */
function sanitizeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  // 过滤文件路径
  return message
    .replace(/[A-Za-z]:\\[^\s]+/g, '[路径]')
    .replace(/\/[^\s]+/g, '[路径]')
    .replace(/Token[:=]\s*\S+/gi, 'Token=[已隐藏]')
    .replace(/token[=:]\s*\S+/gi, 'token=[已隐藏]')
}

/**
 * 注册配置相关 IPC 处理器
 */
export function registerConfigHandlers(): void {
  // 检查配置状态
  ipcMain.handle('config:check', () => {
    const result = isConfigComplete()
    const config = getConfig()
    loggerService.info('ConfigIPC', `配置检查: complete=${result.complete}, missing=${JSON.stringify(result.missing)}, alistBaseUrl=${config.alistBaseUrl || '空'}, ambApiBaseUrl=${config.ambApiBaseUrl || '空'}`)
    return result
  })

  // 获取当前配置
  ipcMain.handle('config:get', () => {
    return getConfig()
  })

  // 保存配置
  ipcMain.handle('config:save', (_event, newConfig: Partial<AppConfig>) => {
    try {
      saveConfig(newConfig)
      return { success: true }
    } catch (error) {
      return { success: false, error: sanitizeErrorMessage(error) }
    }
  })

  // 重新初始化服务
  ipcMain.handle('config:reinit', () => {
    try {
      reinitializeServices()
      return { success: true }
    } catch (error) {
      return { success: false, error: sanitizeErrorMessage(error) }
    }
  })
}

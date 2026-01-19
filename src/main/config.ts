import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { loggerService } from './services/LoggerService'

/**
 * 应用配置接口
 */
export interface AppConfig {
  /** Alist 服务器地址 */
  alistBaseUrl: string
  /** N8N 工作流服务器地址 */
  n8nBaseUrl: string
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: AppConfig = {
  alistBaseUrl: 'http://10.2.3.7:5244',
  n8nBaseUrl: 'http://10.2.3.7:5678'
}

/**
 * 配置文件路径
 */
let configPath: string | null = null
let cachedConfig: AppConfig | null = null

/**
 * 获取配置文件路径
 */
function getConfigPath(): string {
  if (configPath) {
    return configPath
  }

  const userDataPath = app.getPath('userData')
  configPath = join(userDataPath, 'config.json')
  return configPath
}

/**
 * 创建默认配置文件
 */
function createDefaultConfigFile(filePath: string): void {
  try {
    writeFileSync(filePath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8')
    loggerService.info('Config', `已创建默认配置文件: ${filePath}`)
  } catch (error) {
    loggerService.error('Config', `创建配置文件失败: ${error}`)
  }
}

/**
 * 读取配置文件
 * 优先级: 环境变量 > 配置文件 > 默认值
 * 如果配置文件不存在，自动创建默认配置文件
 */
export function loadConfig(): AppConfig {
  // 如果已缓存，直接返回
  if (cachedConfig) {
    return cachedConfig
  }

  const config = { ...DEFAULT_CONFIG }
  const filePath = getConfigPath()

  // 检查配置文件是否存在
  if (!existsSync(filePath)) {
    loggerService.info('Config', `配置文件不存在，将创建默认配置文件`)
    createDefaultConfigFile(filePath)
  } else {
    // 读取现有配置文件
    try {
      const fileContent = readFileSync(filePath, 'utf-8')
      const fileConfig = JSON.parse(fileContent) as Partial<AppConfig>

      // 合并配置文件中的值
      if (fileConfig.alistBaseUrl !== undefined) {
        config.alistBaseUrl = fileConfig.alistBaseUrl
      }
      if (fileConfig.n8nBaseUrl !== undefined) {
        config.n8nBaseUrl = fileConfig.n8nBaseUrl
      }

      loggerService.info('Config', `已加载配置文件: ${filePath}`)
    } catch (error) {
      loggerService.warn('Config', `读取配置文件失败，使用默认配置: ${error}`)
    }
  }

  // 环境变量优先级最高
  if (process.env.ALIST_BASE_URL) {
    config.alistBaseUrl = process.env.ALIST_BASE_URL
    loggerService.info('Config', `使用环境变量覆盖 ALIST_BASE_URL`)
  }
  if (process.env.N8N_BASE_URL) {
    config.n8nBaseUrl = process.env.N8N_BASE_URL
    loggerService.info('Config', `使用环境变量覆盖 N8N_BASE_URL`)
  }

  loggerService.info('Config', `配置加载完成 - Alist: ${config.alistBaseUrl}, N8N: ${config.n8nBaseUrl}`)

  cachedConfig = config
  return config
}

/**
 * 获取配置文件路径（供外部使用）
 */
export function getConfigFilePath(): string {
  return getConfigPath()
}

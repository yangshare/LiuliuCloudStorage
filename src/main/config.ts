import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, renameSync, unlinkSync } from 'fs'
import { loggerService } from './services/LoggerService'
import { alistService } from './services/AlistService'
import { orchestrationService } from './services/OrchestrationService'

/**
 * 应用配置接口
 */
export interface AppConfig {
  /** Alist 服务器地址 */
  alistBaseUrl: string
  /** N8N 工作流服务器地址 */
  n8nBaseUrl: string
  /** AMB API 服务器地址（分享转存接口） */
  ambApiBaseUrl: string
  /** AMB 转存 Token（可选） */
  ambTransferToken?: string
  /** 加密密钥（64位十六进制字符串，可选） */
  encryptionKey?: string
  /** 日志级别（默认 info） */
  logLevel?: 'error' | 'warn' | 'info' | 'debug'
  /** 开发模式：启用更新测试（仅未打包时生效） */
  testUpdate?: boolean
}

/**
 * URL 字段名称（需要验证格式）
 */
const URL_FIELDS: (keyof AppConfig)[] = ['alistBaseUrl', 'n8nBaseUrl', 'ambApiBaseUrl']

/**
 * 验证 URL 格式（只允许 http/https 协议）
 */
function isValidUrl(value: string): boolean {
  if (!value || value.trim() === '') return false
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * 规范化 URL（移除末尾斜杠，确保一致性）
 */
function normalizeUrl(value: string): string {
  if (!value) return value
  // 移除末尾的斜杠
  return value.replace(/\/+$/, '')
}

/**
 * 默认配置（空值，触发配置向导）
 */
const DEFAULT_CONFIG: AppConfig = {
  alistBaseUrl: '',
  n8nBaseUrl: '',
  ambApiBaseUrl: '',
  ambTransferToken: '',
  encryptionKey: '',
  logLevel: 'info',
  testUpdate: false
}

/**
 * 必须配置的字段
 */
const REQUIRED_FIELDS: (keyof AppConfig)[] = [
  'alistBaseUrl',
  'ambApiBaseUrl'
]

/**
 * 配置文件路径
 */
let configPath: string | null = null
let cachedConfig: AppConfig | null = null
let isWriting = false  // 并发写入保护

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
      if (fileConfig.ambApiBaseUrl !== undefined) {
        config.ambApiBaseUrl = fileConfig.ambApiBaseUrl
      }
      if (fileConfig.ambTransferToken !== undefined) {
        config.ambTransferToken = fileConfig.ambTransferToken
      }
      if (fileConfig.encryptionKey !== undefined) {
        config.encryptionKey = fileConfig.encryptionKey
      }
      if (fileConfig.logLevel !== undefined) {
        config.logLevel = fileConfig.logLevel
      }
      if (fileConfig.testUpdate !== undefined) {
        config.testUpdate = fileConfig.testUpdate
      }

      loggerService.info('Config', `已加载配置文件: ${filePath}`)
    } catch (error) {
      loggerService.warn('Config', `读取配置文件失败，使用默认配置: ${error}`)
    }
  }

  // 记录配置加载完成（敏感信息只显示是否配置，不显示具体值）
  const tokenStatus = config.ambTransferToken ? '已配置' : '未配置'
  loggerService.info('Config', `配置加载完成 - Alist: ${config.alistBaseUrl || '未配置'}, N8N: ${config.n8nBaseUrl || '未配置'}, AMB: ${config.ambApiBaseUrl || '未配置'}, TransferToken: ${tokenStatus}`)

  cachedConfig = config
  return config
}

/**
 * 获取当前配置（带缓存）
 */
export function getConfig(): AppConfig {
  if (cachedConfig) {
    return cachedConfig
  }
  return loadConfig()
}

/**
 * 检查配置是否完整
 * @returns { complete: boolean, missing: string[] }
 */
export function isConfigComplete(): { complete: boolean; missing: string[] } {
  const config = getConfig()
  const missing: string[] = []

  for (const field of REQUIRED_FIELDS) {
    if (!config[field] || config[field].trim() === '') {
      missing.push(field)
    }
  }

  return {
    complete: missing.length === 0,
    missing
  }
}

/**
 * 保存配置
 * @param newConfig 新的配置（部分更新）
 * @throws Error 如果 URL 格式无效或写入失败
 */
export function saveConfig(newConfig: Partial<AppConfig>): void {
  // 并发保护：防止同时写入
  if (isWriting) {
    throw new Error('配置正在保存中，请稍后重试')
  }

  const config = getConfig()
  const updatedConfig = { ...config }

  // 合并新配置并验证 URL 格式
  if (newConfig.alistBaseUrl !== undefined) {
    if (newConfig.alistBaseUrl && !isValidUrl(newConfig.alistBaseUrl)) {
      throw new Error('Alist 服务地址格式无效，必须是有效的 http/https URL')
    }
    updatedConfig.alistBaseUrl = normalizeUrl(newConfig.alistBaseUrl)
  }
  if (newConfig.n8nBaseUrl !== undefined) {
    if (newConfig.n8nBaseUrl && !isValidUrl(newConfig.n8nBaseUrl)) {
      throw new Error('N8N 工作流地址格式无效，必须是有效的 http/https URL')
    }
    updatedConfig.n8nBaseUrl = normalizeUrl(newConfig.n8nBaseUrl)
  }
  if (newConfig.ambApiBaseUrl !== undefined) {
    if (newConfig.ambApiBaseUrl && !isValidUrl(newConfig.ambApiBaseUrl)) {
      throw new Error('AMB API 地址格式无效，必须是有效的 http/https URL')
    }
    updatedConfig.ambApiBaseUrl = normalizeUrl(newConfig.ambApiBaseUrl)
  }
  if (newConfig.ambTransferToken !== undefined) {
    updatedConfig.ambTransferToken = newConfig.ambTransferToken
  }
  if (newConfig.encryptionKey !== undefined) {
    // 验证加密密钥格式（64位十六进制）
    if (newConfig.encryptionKey && !/^[a-fA-F0-9]{64}$/.test(newConfig.encryptionKey)) {
      throw new Error('加密密钥格式无效，必须是64位十六进制字符串')
    }
    updatedConfig.encryptionKey = newConfig.encryptionKey
  }
  if (newConfig.logLevel !== undefined) {
    const validLevels = ['error', 'warn', 'info', 'debug']
    if (newConfig.logLevel && !validLevels.includes(newConfig.logLevel)) {
      throw new Error(`日志级别无效，必须是 ${validLevels.join(', ')} 之一`)
    }
    updatedConfig.logLevel = newConfig.logLevel
  }
  if (newConfig.testUpdate !== undefined) {
    updatedConfig.testUpdate = newConfig.testUpdate
  }

  // 原子写入：先写入临时文件，再重命名（Windows 上 renameSync 会自动覆盖）
  const filePath = getConfigPath()
  const tempPath = `${filePath}.tmp`

  isWriting = true
  try {
    // 写入临时文件
    writeFileSync(tempPath, JSON.stringify(updatedConfig, null, 2), 'utf-8')

    // 原子操作：重命名临时文件（会自动覆盖目标文件）
    renameSync(tempPath, filePath)

    cachedConfig = updatedConfig
    loggerService.info('Config', `配置已保存: ${filePath}`)
  } catch (error) {
    // 清理临时文件
    try {
      if (existsSync(tempPath)) {
        unlinkSync(tempPath)
      }
    } catch {
      // 忽略清理错误
    }
    loggerService.error('Config', `保存配置失败: ${error}`)
    throw error
  } finally {
    isWriting = false
  }
}

/**
 * 重新初始化依赖配置的服务
 * 在配置更新后调用
 */
export function reinitializeServices(): void {
  const config = getConfig()

  try {
    // 重新初始化 Alist 服务
    alistService.initialize(config.alistBaseUrl)
    loggerService.info('Config', `Alist 服务已重新初始化: ${config.alistBaseUrl}`)

    // 重新初始化 Orchestration 服务
    orchestrationService.initialize(config.n8nBaseUrl)
    loggerService.info('Config', `Orchestration 服务已重新初始化: ${config.n8nBaseUrl}`)

    loggerService.info('Config', '所有服务重新初始化完成')
  } catch (error) {
    loggerService.error('Config', `重新初始化服务失败: ${error}`)
    throw error
  }
}

/**
 * 获取配置文件路径（供外部使用）
 */
export function getConfigFilePath(): string {
  return getConfigPath()
}

/**
 * 清除配置缓存（用于测试或强制重新加载）
 */
export function clearConfigCache(): void {
  cachedConfig = null
}

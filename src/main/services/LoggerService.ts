import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync } from 'fs'
import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'

/**
 * 从配置文件读取日志级别（避免循环依赖）
 */
function getLogLevelFromConfig(): string {
  try {
    const userDataPath = app.getPath('userData')
    const configPath = join(userDataPath, 'config.json')
    if (existsSync(configPath)) {
      const content = readFileSync(configPath, 'utf-8')
      const config = JSON.parse(content)
      if (config.logLevel && ['error', 'warn', 'info', 'debug'].includes(config.logLevel)) {
        return config.logLevel
      }
    }
  } catch {
    // 配置文件读取失败，使用默认值
  }
  return 'info'
}

/**
 * 日志级别枚举
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

/**
 * 日志服务类
 * 负责应用日志记录、按天切割、自动清理
 */
export class LoggerService {
  private static instance: LoggerService | null = null
  private logger: winston.Logger
  private logsDir: string

  private constructor() {
    // 确定日志目录位置：exe 同级目录下的 logs 文件夹
    this.logsDir = this.getLogsDirectory()

    // 确保 logs 目录存在
    this.ensureLogsDirectory()

    // 创建 logger 实例
    this.logger = winston.createLogger({
      level: getLogLevelFromConfig(),
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.printf(({ timestamp, level, message, label, stack }) => {
          // 格式: [时间戳] [级别] [模块] 消息内容
          let log = `[${timestamp}] [${level.toUpperCase()}]`

          if (label) {
            log += ` [${label}]`
          }

          log += ` ${message}`

          if (stack) {
            log += `\n${stack}`
          }

          return log
        })
      ),
      transports: [
        // 控制台输出（开发环境带颜色）
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, label }) => {
              let log = `[${timestamp}] [${level}]`

              if (label) {
                log += ` [${label}]`
              }

              log += ` ${message}`
              return log
            })
          )
        }),
        // 文件输出（按天切割）
        new DailyRotateFile({
          dirname: this.logsDir,
          filename: '%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '30d', // 保留30天
          utc: true
        }),
        // 错误日志单独存储
        new DailyRotateFile({
          dirname: this.logsDir,
          filename: 'error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          maxSize: '20m',
          maxFiles: '30d', // 保留30天
          utc: true
        })
      ]
    })
  }

  static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService()
    }
    return LoggerService.instance
  }

  /**
   * 获取日志目录路径
   * 用户数据目录下的 logs 文件夹
   */
  private getLogsDirectory(): string {
    // 开发环境：使用项目根目录下的 logs
    if (!app.isPackaged) {
      return join(process.cwd(), 'logs')
    }

    // 生产环境：使用用户数据目录下的 logs（避免 Program Files 权限问题）
    return join(app.getPath('userData'), 'logs')
  }

  /**
   * 确保 logs 目录存在
   */
  private ensureLogsDirectory(): void {
    if (!existsSync(this.logsDir)) {
      try {
        mkdirSync(this.logsDir, { recursive: true })
        this.info('LoggerService', `日志目录已创建: ${this.logsDir}`)
      } catch (error) {
        console.error('[LoggerService] 创建日志目录失败:', error)
      }
    }
  }

  /**
   * 记录错误日志
   */
  error(module: string, message: string, error?: Error): void {
    const errorMessage = error ? `${message}\n${error.stack || error.message}` : message
    this.logger.error(errorMessage, { label: module })
  }

  /**
   * 记录警告日志
   */
  warn(module: string, message: string): void {
    this.logger.warn(message, { label: module })
  }

  /**
   * 记录信息日志
   */
  info(module: string, message: string): void {
    this.logger.info(message, { label: module })
  }

  /**
   * 记录调试日志
   */
  debug(module: string, message: string): void {
    this.logger.debug(message, { label: module })
  }

  /**
   * 获取日志目录路径（供外部使用）
   */
  getLogsDir(): string {
    return this.logsDir
  }
}

// 导出单例
export const loggerService = LoggerService.getInstance()

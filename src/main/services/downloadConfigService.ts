import { app } from 'electron'
import { join } from 'path'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { eq } from 'drizzle-orm'
import { getDatabase } from '../database'
import { downloadConfig } from '../database/schema'
import type { DownloadConfig } from '../database/schema'

export interface DownloadConfigUpdate {
  defaultPath?: string
  autoCreateDateFolder?: boolean
}

/**
 * 获取下载配置
 */
export function getConfig(): DownloadConfig {
  const db = drizzle(getDatabase())
  const config = db.select().from(downloadConfig).where(eq(downloadConfig.id, 1)).get()

  if (!config) {
    throw new Error('Download config not found')
  }

  return config
}

/**
 * 更新下载配置
 */
export function updateConfig(updates: DownloadConfigUpdate): DownloadConfig {
  const db = drizzle(getDatabase())
  const now = new Date()

  const updateData: any = {
    updatedAt: now
  }

  if (updates.defaultPath !== undefined) {
    updateData.defaultPath = updates.defaultPath
  }

  if (updates.autoCreateDateFolder !== undefined) {
    updateData.autoCreateDateFolder = updates.autoCreateDateFolder
  }

  db.update(downloadConfig)
    .set(updateData)
    .where(eq(downloadConfig.id, 1))
    .run()

  return getConfig()
}

/**
 * 重置为默认配置
 */
export function resetToDefault(): DownloadConfig {
  const downloadsPath = app.getPath('downloads')
  const defaultPath = join(downloadsPath, '溜溜网盘')

  return updateConfig({
    defaultPath: defaultPath,
    autoCreateDateFolder: false
  })
}

export const downloadConfigService = {
  getConfig,
  updateConfig,
  resetToDefault
}

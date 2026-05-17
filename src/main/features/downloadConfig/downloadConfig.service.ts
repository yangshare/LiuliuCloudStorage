import { downloadConfigService } from '../../services/downloadConfigService'
import { IPCError, IPCErrorCode } from '../../core/ipc/error-handler'
import fs from 'fs/promises'
import path from 'path'
import { shell } from 'electron'

export class DownloadConfigFeatureService {
  async selectDirectory(selectedPath: string) {
    try {
      await fs.access(selectedPath)
      await fs.access(selectedPath, fs.constants.W_OK)
      const config = downloadConfigService.updateConfig({ defaultPath: selectedPath })
      return { success: true as const, path: config.defaultPath }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return { success: false as const, error: '目录不存在', needsCreation: true, path: selectedPath }
      }
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        return { success: false as const, error: '没有写入权限，请选择其他目录' }
      }
      return { success: false as const, error: error.message }
    }
  }

  getConfig() {
    return downloadConfigService.getConfig()
  }

  updateConfig(updates: any) {
    return downloadConfigService.updateConfig(updates)
  }

  async openDirectory(dirPath: string) {
    try {
      await fs.access(dirPath)
      await shell.openPath(dirPath)
      return { success: true as const }
    } catch {
      return { success: false as const, error: '目录不存在' }
    }
  }

  async openFileDirectory(filePath: string) {
    try {
      let dirPath: string
      try {
        const stat = await fs.stat(filePath)
        dirPath = stat.isDirectory() ? filePath : path.dirname(filePath)
      } catch {
        dirPath = path.dirname(filePath)
      }
      await fs.access(dirPath)
      const errMsg = await shell.openPath(dirPath)
      if (errMsg) return { success: false as const, error: errMsg }
      return { success: true as const }
    } catch (error: unknown) {
      return { success: false as const, error: error instanceof Error ? error.message : '目录不存在' }
    }
  }

  async createDirectory(dirPath: string) {
    try {
      await fs.mkdir(dirPath, { recursive: true })
      const config = downloadConfigService.updateConfig({ defaultPath: dirPath })
      return { success: true as const, path: config.defaultPath }
    } catch (error: any) {
      return { success: false as const, error: error.message }
    }
  }

  resetToDefault() {
    try {
      const config = downloadConfigService.resetToDefault()
      return { success: true as const, config }
    } catch (error: any) {
      return { success: false as const, error: error.message }
    }
  }
}

export const downloadConfigFeatureService = new DownloadConfigFeatureService()

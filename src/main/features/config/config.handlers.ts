import { ipcMain } from 'electron'
import { configFeatureService } from './config.service'
import { loggerService } from '../../services/LoggerService'

export function registerConfigHandlers(): void {
  ipcMain.handle('config:check', () => {
    const result = configFeatureService.checkConfig()
    const config = configFeatureService.getConfig()
    loggerService.info('ConfigIPC', `配置检查: complete=${result.complete}, missing=${JSON.stringify(result.missing)}, alistBaseUrl=${config.alistBaseUrl || '空'}, ambApiBaseUrl=${config.ambApiBaseUrl || '空'}`)
    return result
  })

  ipcMain.handle('config:get', () => {
    return configFeatureService.getConfig()
  })

  ipcMain.handle('config:save', (_event, newConfig) => {
    return configFeatureService.saveConfig(newConfig)
  })

  ipcMain.handle('config:reinit', () => {
    return configFeatureService.reinitializeServices()
  })
}

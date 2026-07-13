import { getConfig, isConfigComplete, saveConfig, reinitializeServices } from '../../config'
import type { AppConfig } from '../../config'

function sanitizeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message
    .replace(/[A-Za-z]:\\[^\s]+/g, '[路径]')
    .replace(/\/[^\s]+/g, '[路径]')
    .replace(/Token[:=]\s*\S+/gi, 'Token=[已隐藏]')
    .replace(/token[=:]\s*\S+/gi, 'token=[已隐藏]')
}

export class ConfigFeatureService {
  checkConfig() {
    return isConfigComplete()
  }

  getConfig() {
    return getConfig()
  }

  saveConfig(newConfig: Partial<AppConfig>) {
    try {
      saveConfig(newConfig)
      return { success: true as const }
    } catch (error) {
      return { success: false as const, error: sanitizeErrorMessage(error) }
    }
  }

  reinitializeServices() {
    try {
      reinitializeServices()
      return { success: true as const }
    } catch (error) {
      return { success: false as const, error: sanitizeErrorMessage(error) }
    }
  }
}

export const configFeatureService = new ConfigFeatureService()

import { registerDownloadConfigHandlers } from './downloadConfig.handlers'

export function initDownloadConfigModule() {
  registerDownloadConfigHandlers()
}

export { downloadConfigFeatureService } from './downloadConfig.service'

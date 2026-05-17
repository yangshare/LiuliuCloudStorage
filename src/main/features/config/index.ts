import { registerConfigHandlers } from './config.handlers'

export function initConfigModule() {
  registerConfigHandlers()
}

export { configFeatureService } from './config.service'

import { registerActivityHandlers } from './activity.handlers'

export function initActivityModule() {
  registerActivityHandlers()
}

export { activityFeatureService } from './activity.service'

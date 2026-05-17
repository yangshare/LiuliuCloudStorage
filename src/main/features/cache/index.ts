import { registerCacheHandlers } from './cache.handlers'

export function initCacheModule() {
  registerCacheHandlers()
}

export { cacheFeatureService } from './cache.service'

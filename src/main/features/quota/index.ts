// src/main/features/quota/index.ts

import { registerQuotaHandlers } from './quota.handlers'

export function initQuotaModule() {
  registerQuotaHandlers()
}

export { quotaService } from './quota.service'

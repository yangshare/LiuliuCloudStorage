// src/main/features/shareTransfer/index.ts

import { registerShareTransferHandlers } from './shareTransfer.handlers'

export function initShareTransferModule() {
  registerShareTransferHandlers()
}

export { shareTransferFeatureService } from './shareTransfer.service'

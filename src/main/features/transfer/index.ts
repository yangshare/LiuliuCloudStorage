import { registerTransferHandlers } from './transfer.handlers'

export function initTransferModule() {
  registerTransferHandlers()
}

export { transferService } from './transfer.service'
export { queueService } from './queue.service'

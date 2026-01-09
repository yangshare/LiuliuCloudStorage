import { registerAuthHandlers } from './handlers/auth'
import { registerFileHandlers } from './handlers/file'
import { registerTransferHandlers } from './handlers/transfer'
import { registerQuotaHandlers } from './handlers/quota'
import { registerDialogHandlers } from './handlers/dialog'

export function registerAllHandlers(): void {
  registerAuthHandlers()
  registerFileHandlers()
  registerTransferHandlers()
  registerQuotaHandlers()
  registerDialogHandlers()
}

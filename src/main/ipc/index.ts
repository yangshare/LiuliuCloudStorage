import { registerAuthHandlers } from './handlers/auth'
import { registerFileHandlers } from './handlers/file'
import { registerTransferHandlers } from './handlers/transfer'
import { registerQuotaHandlers } from './handlers/quota'
import { registerDialogHandlers } from './handlers/dialog'
import { registerTrayHandlers } from './handlers/tray'
import { registerNotificationHandlers } from './handlers/notification'
import { registerAppHandlers } from './handlers/app'
import { registerActivityHandlers } from './handlers/activity'
import { registerDownloadConfigHandlers } from './handlers/downloadConfig'
import { registerUpdateHandlers } from './handlers/update'
import { registerCacheHandlers } from './handlers/cache'

export function registerAllHandlers(): void {
  registerAuthHandlers()
  registerFileHandlers()
  registerTransferHandlers()
  registerQuotaHandlers()
  registerDialogHandlers()
  registerTrayHandlers()
  registerNotificationHandlers()
  registerAppHandlers()
  registerActivityHandlers()
  registerDownloadConfigHandlers()
  registerUpdateHandlers()
  registerCacheHandlers()
}

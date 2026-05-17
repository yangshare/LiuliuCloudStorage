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
import { registerShareTransferHandlers } from './handlers/shareTransfer'
import { registerConfigHandlers } from './handlers/config'
import { registerAutoSyncHandlers } from './handlers/autoSync'
import { initAuthModule } from '../features/auth'
import { initFileModule } from '../features/file'
import { initTransferModule } from '../features/transfer'

export function registerAllHandlers(): void {
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
  registerShareTransferHandlers()
  registerConfigHandlers()
  registerAutoSyncHandlers()
  initAuthModule()
  initFileModule()
  initTransferModule()
}

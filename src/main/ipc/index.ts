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
import { registerShareTransferHandlers } from './handlers/shareTransfer'
import { registerConfigHandlers } from './handlers/config'
import { registerAutoSyncHandlers } from './handlers/autoSync'
// import { initAuthModule } from '../features/auth'

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
  registerShareTransferHandlers()
  registerConfigHandlers()
  registerAutoSyncHandlers()
  // TODO: 新架构 auth handlers 暂时不启用，等完成完整业务逻辑后再切换
  // initAuthModule()
}

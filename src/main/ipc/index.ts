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
import { initQuotaModule } from '../features/quota'
import { initShareTransferModule } from '../features/shareTransfer'
import { initAutoSyncModule } from '../features/autoSync'
import { initActivityModule } from '../features/activity'
import { initDownloadConfigModule } from '../features/downloadConfig'
import { initCacheModule } from '../features/cache'
import { initConfigModule } from '../features/config'

export function registerAllHandlers(): void {
  registerTransferHandlers()  // 旧的（先注册，后由新模块覆盖）
  registerQuotaHandlers()
  registerDialogHandlers()
  registerTrayHandlers()
  registerNotificationHandlers()
  registerAppHandlers()
  registerActivityHandlers()
  registerDownloadConfigHandlers()
  registerUpdateHandlers()
  registerCacheHandlers()
  registerShareTransferHandlers()  // 旧的（先注册，后由新模块覆盖）
  registerConfigHandlers()
  registerAutoSyncHandlers()
  initAuthModule()    // 新的（覆盖旧 auth）
  initFileModule()    // 新的（覆盖旧 file）
  initTransferModule() // 新的（覆盖旧的 transfer handlers）
  initQuotaModule()    // 新的（覆盖旧的 quota handlers）
  initShareTransferModule() // 新的（覆盖旧的 shareTransfer handlers）
  initAutoSyncModule() // 新的（覆盖旧的 autoSync handlers）
  initActivityModule() // 新的（覆盖旧的 activity handlers）
  initDownloadConfigModule() // 新的（覆盖旧的 downloadConfig handlers）
  initCacheModule() // 新的（覆盖旧的 cache handlers）
  initConfigModule() // 新的（覆盖旧的 config handlers）
}

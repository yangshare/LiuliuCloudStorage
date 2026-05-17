import { registerDialogHandlers } from './handlers/dialog'
import { registerTrayHandlers } from './handlers/tray'
import { registerNotificationHandlers } from './handlers/notification'
import { registerAppHandlers } from './handlers/app'
import { registerUpdateHandlers } from './handlers/update'
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
  // 未迁移到 Feature-Based 架构的模块（保留旧 handlers）
  registerDialogHandlers()
  registerTrayHandlers()
  registerNotificationHandlers()
  registerAppHandlers()
  registerUpdateHandlers()

  // Feature-Based 架构模块（新 handlers 覆盖旧 handlers）
  initAuthModule()
  initFileModule()
  initTransferModule()
  initQuotaModule()
  initShareTransferModule()
  initAutoSyncModule()
  initActivityModule()
  initDownloadConfigModule()
  initCacheModule()
  initConfigModule()
}

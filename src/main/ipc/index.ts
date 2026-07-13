import { initAppModule } from '../features/app'
import { initDialogModule } from '../features/dialog'
import { initTrayModule } from '../features/tray'
import { initNotificationModule } from '../features/notification'
import { initUpdateModule } from '../features/update'
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
  initAppModule()
  initDialogModule()
  initTrayModule()
  initNotificationModule()
  initUpdateModule()
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

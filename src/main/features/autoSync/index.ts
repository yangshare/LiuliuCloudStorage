// src/main/features/autoSync/index.ts

import { BrowserWindow } from 'electron'
import { autoSyncService, type AutoSyncProgressEvent } from './auto-sync.core.service'
import { registerAutoSyncHandlers } from './autoSync.handlers'

function broadcastProgress(planId: number, event: AutoSyncProgressEvent): void {
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send('autoSync:event:progress', { planId, ...event })
  })
}

export function initAutoSyncModule() {
  // 配置进度回调广播
  autoSyncService.setProgressCallback((planId, event) => {
    broadcastProgress(planId, event)
  })

  registerAutoSyncHandlers()
}

export { autoSyncFeatureService } from './autoSync.service'

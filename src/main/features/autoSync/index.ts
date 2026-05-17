// src/main/features/autoSync/index.ts

import { BrowserWindow } from 'electron'
import { autoSyncService, type AutoSyncProgressEvent } from '../../services/AutoSyncService'
import { registerAutoSyncHandlers } from './autoSync.handlers'

function broadcastProgress(planId: number, event: AutoSyncProgressEvent): void {
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send('autoSync:progress', { planId, ...event })
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

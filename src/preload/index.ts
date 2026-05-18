import { contextBridge, ipcRenderer } from 'electron'

// 回调映射：用于正确移除 IPC 监听器（解决匿名包装函数导致的内存泄漏）
const listenerMap = new Map<Function, Function>()

function wrapListener(callback: Function): (...args: any[]) => void {
  const wrapped = (_event: any, ...args: any[]) => (callback as any)(...args)
  listenerMap.set(callback, wrapped)
  return wrapped
}

function unwrapListener(callback: Function): Function {
  const wrapped = listenerMap.get(callback)
  if (wrapped) {
    listenerMap.delete(callback)
    return wrapped
  }
  return callback
}

// 允许的 IPC 通道白名单
const validChannels = [
  'auth:session:login', 'auth:session:logout', 'auth:session:check', 'auth:user:current',
  'auth:get-users', 'auth:get-storage-stats', 'auth:preference:login',
  'file:item:list', 'file:directory:create', 'file:item:delete', 'file:item:batchDelete', 'file:item:rename', 'file:directory:getAllFiles',
  'transfer:upload:file', 'transfer:download:file', 'transfer:download:saveAs', 'transfer:upload:cancel', 'transfer:task:list', 'transfer:upload:progress',
  'transfer:upload:add-to-queue', 'transfer:upload:queue-status', 'transfer:upload:restore-queue',
  'transfer:upload:completed', 'transfer:upload:failed', 'transfer:upload:cancelled',
  'transfer:upload:resume', 'transfer:upload:auto-retry-all',
  'transfer:download:progress', 'transfer:download:completed', 'transfer:download:failed', 'transfer:download:cancelled', 'transfer:download:auth-failed',
  'transfer:download:init-queue', 'transfer:download:queue', 'transfer:download:batch-queue', 'transfer:download:get-queue',
  'transfer:download:pause-queue', 'transfer:download:resume-queue', 'transfer:download:clear-queue',
  'transfer:download:clear-pending', 'transfer:download:clear-active',
  'transfer:download:resume', 'transfer:download:cancel', 'transfer:download:cancel-all',
  'transfer:queue:updated',
  'quota:usage:get', 'quota:usage:update', 'quota:usage:calculate', 'quota:admin:update',
  'crypto:encrypt', 'crypto:decrypt', 'crypto:isReady',
  'dialog:file:open',
  'tray:status:update-transfer', 'tray:status:update-counts', 'tray:window:show', 'tray:window:hide', 'tray:action:quick-upload',
  'notification:app:show', 'app:version:get', 'app:launch:set-login-item-settings', 'app:launch:get-login-item-settings', 'app:logs:open-directory',
  'activity:log:create', 'activity:log:get-user-logs', 'activity:log:get-all-logs', 'activity:analytics:get-dau', 'activity:analytics:get-user-stats',
  'downloadConfig:directory:select', 'downloadConfig:data:get', 'downloadConfig:data:update', 'downloadConfig:directory:open', 'downloadConfig:directory:openFile', 'downloadConfig:data:reset', 'downloadConfig:directory:create',
  'cache:info:get', 'cache:data:clear',
  'update:action:check', 'update:action:install-now', 'update:action:install-on-quit',
  'update:event:available', 'update:event:not-available', 'update:event:download-progress', 'update:event:downloaded', 'update:event:error',
  'shareTransfer:task:exec', 'shareTransfer:task:list', 'shareTransfer:task:latest', 'shareTransfer:task:complete', 'shareTransfer:task:delete', 'shareTransfer:task:batchDelete',
  'autoSync:plan:createAndRun', 'autoSync:plan:list', 'autoSync:plan:update', 'autoSync:plan:pause', 'autoSync:plan:resume',
  'autoSync:plan:delete', 'autoSync:plan:run', 'autoSync:run:list', 'autoSync:run:startup', 'autoSync:plan:resetBaseline',
  'autoSync:event:progress',
  'config:status:check', 'config:data:get', 'config:data:save', 'config:data:reinit'
]

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,

  invoke: (channel: string, ...args: unknown[]) => {
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args)
    }
    return Promise.reject(new Error(`Invalid channel: ${channel}`))
  },

  on: (channel: string, callback: (...args: unknown[]) => void) => {
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, wrapListener(callback))
    }
  },

  removeListener: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener(channel, unwrapListener(callback) as never)
  },

  auth: {
    login: (username: string, password: string, autoLogin: boolean = false) => ipcRenderer.invoke('auth:session:login', username, password, autoLogin),
    logout: () => ipcRenderer.invoke('auth:session:logout'),
    checkSession: () => ipcRenderer.invoke('auth:session:check'),
    getCurrentUser: () => ipcRenderer.invoke('auth:user:current'),
    getUsers: (params?: { page?: number; pageSize?: number; search?: string }) => ipcRenderer.invoke('auth:get-users', params),
    getStorageStats: () => ipcRenderer.invoke('auth:get-storage-stats'),
    getLoginPreferences: () => ipcRenderer.invoke('auth:preference:login')
  },

  file: {
    list: (path: string) => ipcRenderer.invoke('file:item:list', path),
    mkdir: (path: string) => ipcRenderer.invoke('file:directory:create', path),
    delete: (dir: string, fileName: string) => ipcRenderer.invoke('file:item:delete', dir, fileName),
    batchDelete: (dir: string, fileNames: string[]) => ipcRenderer.invoke('file:item:batchDelete', dir, fileNames),
    rename: (path: string, newName: string) => ipcRenderer.invoke('file:item:rename', path, newName),
    getAllFilesInDirectory: (remotePath: string) => ipcRenderer.invoke('file:directory:getAllFiles', remotePath)
  },

  transfer: {
    upload: (filePath: string, remotePath: string, userId: number, userToken: string, username: string, localTaskId: string) =>
      ipcRenderer.invoke('transfer:upload:file', { filePath, remotePath, userId, userToken, username, localTaskId }),
    download: (remotePath: string, fileName: string, userId: number, userToken: string, username: string, savePath?: string) =>
      ipcRenderer.invoke('transfer:download:file', { remotePath, fileName, userId, userToken, username, savePath }),
    saveAs: (fileName: string, userId: number) =>
      ipcRenderer.invoke('transfer:download:saveAs', { fileName, userId }),
    addToQueue: (task: { id: number; filePath: string; remotePath: string; userId: number; userToken: string; username: string; fileName: string; fileSize: number }) =>
      ipcRenderer.invoke('transfer:upload:add-to-queue', task),
    getQueueStatus: () => ipcRenderer.invoke('transfer:upload:queue-status'),
    list: (userId: number) => ipcRenderer.invoke('transfer:task:list', userId),
    restoreQueue: (userId: number, userToken: string) =>
      ipcRenderer.invoke('transfer:upload:restore-queue', { userId, userToken }),
    resume: (taskId: number, userId: number, userToken: string, username: string) =>
      ipcRenderer.invoke('transfer:upload:resume', { taskId, userId, userToken, username }),
    autoRetryAll: (userId: number, userToken: string, username: string) =>
      ipcRenderer.invoke('transfer:upload:auto-retry-all', { userId, userToken, username }),
    cancel: (taskId: number) =>
      ipcRenderer.invoke('transfer:upload:cancel', taskId),
    onProgress: (callback: (data: { taskId: string | number, progress: number }) => void) =>
      ipcRenderer.on('transfer:upload:progress', wrapListener(callback)),
    removeProgressListener: (callback: (data: { taskId: string | number, progress: number }) => void) =>
      ipcRenderer.removeListener('transfer:upload:progress', unwrapListener(callback) as never),
    onCompleted: (callback: (data: { taskId: string | number, fileName: string }) => void) =>
      ipcRenderer.on('transfer:upload:completed', wrapListener(callback)),
    onFailed: (callback: (data: { taskId: string | number, fileName: string, error: string }) => void) =>
      ipcRenderer.on('transfer:upload:failed', wrapListener(callback)),
    onCancelled: (callback: (data: { taskId: string | number, fileName: string }) => void) =>
      ipcRenderer.on('transfer:upload:cancelled', wrapListener(callback)),
    onDownloadProgress: (callback: (data: { taskId: string, fileName: string, progress: number, downloadedBytes: number, totalBytes: number, speed: number }) => void) =>
      ipcRenderer.on('transfer:download:progress', wrapListener(callback)),
    onDownloadCompleted: (callback: (data: { taskId: string, fileName: string, savePath: string }) => void) =>
      ipcRenderer.on('transfer:download:completed', wrapListener(callback)),
    onDownloadFailed: (callback: (data: { taskId: string, fileName: string, error: string }) => void) =>
      ipcRenderer.on('transfer:download:failed', wrapListener(callback)),
    removeCompletedListener: (callback: (data: { taskId: string | number, fileName: string }) => void) =>
      ipcRenderer.removeListener('transfer:upload:completed', unwrapListener(callback) as never),
    removeFailedListener: (callback: (data: { taskId: string | number, fileName: string, error: string }) => void) =>
      ipcRenderer.removeListener('transfer:upload:failed', unwrapListener(callback) as never),
    removeCancelledListener: (callback: (data: { taskId: string | number, fileName: string }) => void) =>
      ipcRenderer.removeListener('transfer:upload:cancelled', unwrapListener(callback) as never),
    removeDownloadProgressListener: (callback: (data: { taskId: string, fileName: string, progress: number, downloadedBytes: number, totalBytes: number, speed: number }) => void) =>
      ipcRenderer.removeListener('transfer:download:progress', unwrapListener(callback) as never),
    removeDownloadCompletedListener: (callback: (data: { taskId: string, fileName: string, savePath: string }) => void) =>
      ipcRenderer.removeListener('transfer:download:completed', unwrapListener(callback) as never),
    removeDownloadFailedListener: (callback: (data: { taskId: string, fileName: string, error: string }) => void) =>
      ipcRenderer.removeListener('transfer:download:failed', unwrapListener(callback) as never),
    onDownloadCancelled: (callback: (data: { taskId: string | number }) => void) =>
      ipcRenderer.on('transfer:download:cancelled', wrapListener(callback)),
    removeDownloadCancelledListener: (callback: (data: { taskId: string | number }) => void) =>
      ipcRenderer.removeListener('transfer:download:cancelled', unwrapListener(callback) as never),
    onDownloadAuthFailed: (callback: (data: { error: string }) => void) =>
      ipcRenderer.on('transfer:download:auth-failed', wrapListener(callback)),
    removeDownloadAuthFailedListener: (callback: (data: { error: string }) => void) =>
      ipcRenderer.removeListener('transfer:download:auth-failed', unwrapListener(callback) as never),
    // 下载队列管理
    initDownloadQueue: (params: { userId: number; userToken: string }) =>
      ipcRenderer.invoke('transfer:download:init-queue', params),
    queueDownload: (task: { id: string; remotePath: string; fileName: string; savePath?: string; userId: number; userToken: string; priority?: number }) =>
      ipcRenderer.invoke('transfer:download:queue', task),
    batchQueueDownload: (params: { remotePaths: string[] }) =>
      ipcRenderer.invoke('transfer:download:batch-queue', params),
    getDownloadQueue: () =>
      ipcRenderer.invoke('transfer:download:get-queue'),
    pauseDownloadQueue: () =>
      ipcRenderer.invoke('transfer:download:pause-queue'),
    resumeDownloadQueue: () =>
      ipcRenderer.invoke('transfer:download:resume-queue'),
    clearDownloadQueue: () =>
      ipcRenderer.invoke('transfer:download:clear-queue'),
    clearPendingQueue: () =>
      ipcRenderer.invoke('transfer:download:clear-pending'),
    clearActiveQueue: () =>
      ipcRenderer.invoke('transfer:download:clear-active'),
    // 恢复和取消下载
    resumeDownload: (taskId: number) =>
      ipcRenderer.invoke('transfer:download:resume', { taskId }),
    cancelDownload: (taskId: string | number) =>
      ipcRenderer.invoke('transfer:download:cancel', { taskId }),
    cancelAllDownloads: (userId: number) =>
      ipcRenderer.invoke('transfer:download:cancel-all', { userId }),
    onQueueUpdated: (callback: (data: { pending: any[]; active: any[]; completed: any[]; failed: any[]; counts?: { pending: number; active: number; completed: number; failed: number } }) => void) =>
      ipcRenderer.on('transfer:queue:updated', wrapListener(callback)),
    removeQueueUpdatedListener: (callback: (data: { pending: any[]; active: any[]; completed: any[]; failed: any[]; counts?: { pending: number; active: number; completed: number; failed: number } }) => void) =>
      ipcRenderer.removeListener('transfer:queue:updated', unwrapListener(callback) as never)
  },

  dialog: {
    openFile: (options?: { directory?: boolean }) => ipcRenderer.invoke('dialog:file:open', options)
  },

  quota: {
    get: () => ipcRenderer.invoke('quota:usage:get'),
    update: (quotaUsed: number) => ipcRenderer.invoke('quota:usage:update', quotaUsed),
    calculate: () => ipcRenderer.invoke('quota:usage:calculate'),
    adminUpdate: (userId: number, quotaTotal: number) => ipcRenderer.invoke('quota:admin:update', userId, quotaTotal)
  },

  tray: {
    updateTransferStatus: (isTransferring: boolean) => ipcRenderer.invoke('tray:status:update-transfer', isTransferring),
    updateTransferCounts: (uploadCount: number, downloadCount: number) => ipcRenderer.invoke('tray:status:update-counts', uploadCount, downloadCount),
    showWindow: () => ipcRenderer.invoke('tray:window:show'),
    hideWindow: () => ipcRenderer.invoke('tray:window:hide'),
    // Story 8.3: 监听托盘快速上传消息
    onTrayQuickUpload: (callback: () => void) => ipcRenderer.on('tray:action:quick-upload', wrapListener(callback))
  },

  notification: {
    show: (options: { title: string; body: string }) => ipcRenderer.invoke('notification:app:show', options)
  },

  app: {
    getVersion: () => ipcRenderer.invoke('app:version:get'),
    setLoginItemSettings: (settings: { openAtLogin: boolean }) => ipcRenderer.invoke('app:launch:set-login-item-settings', settings),
    getLoginItemSettings: () => ipcRenderer.invoke('app:launch:get-login-item-settings'),
    openLogsDirectory: () => ipcRenderer.invoke('app:logs:open-directory')
  },

  activity: {
    log: (params: { userId: number; actionType: string; fileCount?: number; fileSize?: number; ipAddress?: string; userAgent?: string; details?: Record<string, any> }) =>
      ipcRenderer.invoke('activity:log:create', params),
    getUserLogs: (userId: number, options?: { limit?: number; offset?: number; actionType?: string; startDate?: string; endDate?: string }) =>
      ipcRenderer.invoke('activity:log:get-user-logs', userId, options),
    getAllLogs: (options?: { limit?: number; offset?: number; userId?: number; actionType?: string; startDate?: string; endDate?: string }) =>
      ipcRenderer.invoke('activity:log:get-all-logs', options),
    getDAU: (date?: string) => ipcRenderer.invoke('activity:analytics:get-dau', date),
    getUserStats: (userId: number, startDate?: string, endDate?: string) =>
      ipcRenderer.invoke('activity:analytics:get-user-stats', userId, startDate, endDate)
  },

  downloadConfig: {
    selectDirectory: () => ipcRenderer.invoke('downloadConfig:directory:select'),
    get: () => ipcRenderer.invoke('downloadConfig:data:get'),
    update: (updates: { defaultPath?: string; autoCreateDateFolder?: boolean }) => ipcRenderer.invoke('downloadConfig:data:update', updates),
    openDirectory: () => ipcRenderer.invoke('downloadConfig:directory:open'),
    openFileDirectory: (filePath: string) => ipcRenderer.invoke('downloadConfig:directory:openFile', filePath),
    reset: () => ipcRenderer.invoke('downloadConfig:data:reset'),
    createDirectory: (dirPath: string) => ipcRenderer.invoke('downloadConfig:directory:create', dirPath)
  },

  cache: {
    getInfo: () => ipcRenderer.invoke('cache:info:get'),
    clear: () => ipcRenderer.invoke('cache:data:clear')
  },

  updateAPI: {
    check: () => ipcRenderer.invoke('update:action:check'),
    installNow: () => ipcRenderer.invoke('update:action:install-now'),
    installOnQuit: () => ipcRenderer.invoke('update:action:install-on-quit'),
    onAvailable: (callback: (info: any) => void) =>
      ipcRenderer.on('update:event:available', wrapListener(callback)),
    onNotAvailable: (callback: () => void) =>
      ipcRenderer.on('update:event:not-available', wrapListener(callback)),
    onDownloadProgress: (callback: (progress: any) => void) =>
      ipcRenderer.on('update:event:download-progress', wrapListener(callback)),
    onDownloaded: (callback: () => void) =>
      ipcRenderer.on('update:event:downloaded', wrapListener(callback)),
    onError: (callback: (message: string) => void) =>
      ipcRenderer.on('update:event:error', wrapListener(callback))
  },

  shareTransfer: {
    exec: (params: { url: string; userId: number }) =>
      ipcRenderer.invoke('shareTransfer:task:exec', params),
    list: (params: { userId: number; pageNum?: number; pageSize?: number; status?: string }) =>
      ipcRenderer.invoke('shareTransfer:task:list', params),
    latest: (params: { userId: number }) =>
      ipcRenderer.invoke('shareTransfer:task:latest', params),
    complete: (params: { id: number; userId: number }) =>
      ipcRenderer.invoke('shareTransfer:task:complete', params),
    delete: (params: { id: number; userId: number }) =>
      ipcRenderer.invoke('shareTransfer:task:delete', params),
    batchDelete: (params: { ids: number[]; userId: number }) =>
      ipcRenderer.invoke('shareTransfer:task:batchDelete', params)
  },

  autoSync: {
    createPlanAndRun: (params: {
      userId: number
      name?: string
      shareUrl: string
      localSyncDir: string
      expiresAt: number
      autoRunOnStartup?: boolean
      conflictPolicy?: 'skip_existing' | 'rename_remote' | 'overwrite'
    }) => ipcRenderer.invoke('autoSync:plan:createAndRun', params),
    listPlans: (params: { userId: number }) =>
      ipcRenderer.invoke('autoSync:plan:list', params),
    updatePlan: (params: {
      id: number
      userId: number
      updates: {
        name?: string
        localSyncDir?: string
        expiresAt?: number
        autoRunOnStartup?: boolean
        conflictPolicy?: 'skip_existing' | 'rename_remote' | 'overwrite'
      }
    }) => ipcRenderer.invoke('autoSync:plan:update', params),
    pausePlan: (params: { id: number; userId: number }) =>
      ipcRenderer.invoke('autoSync:plan:pause', params),
    resumePlan: (params: { id: number; userId: number }) =>
      ipcRenderer.invoke('autoSync:plan:resume', params),
    deletePlan: (params: { id: number; userId: number }) =>
      ipcRenderer.invoke('autoSync:plan:delete', params),
    runPlan: (params: { id: number; userId: number }) =>
      ipcRenderer.invoke('autoSync:plan:run', params),
    listRuns: (params: { planId: number; userId: number; limit?: number }) =>
      ipcRenderer.invoke('autoSync:run:list', params),
    startupRun: (params: { userId: number }) =>
      ipcRenderer.invoke('autoSync:run:startup', params),
    resetBaseline: (params: { id: number; userId: number }) =>
      ipcRenderer.invoke('autoSync:plan:resetBaseline', params),
    onProgress: (callback: (data: { planId: number; stage: string; status: string; message?: string; current?: number; total?: number }) => void) =>
      ipcRenderer.on('autoSync:event:progress', wrapListener(callback)),
    removeProgressListener: (callback: (data: { planId: number; stage: string; status: string; message?: string; current?: number; total?: number }) => void) =>
      ipcRenderer.removeListener('autoSync:event:progress', unwrapListener(callback) as never)
  },

  config: {
    check: () => ipcRenderer.invoke('config:status:check'),
    get: () => ipcRenderer.invoke('config:data:get'),
    /**
     * 保存配置（部分更新）
     * @param config - 与 src/main/config.ts 中的 Partial<AppConfig> 保持同步
     */
    save: (config: { alistBaseUrl?: string; n8nBaseUrl?: string; ambApiBaseUrl?: string; ambTransferToken?: string }) =>
      ipcRenderer.invoke('config:data:save', config),
    reinit: () => ipcRenderer.invoke('config:data:reinit')
  }
})

export {}

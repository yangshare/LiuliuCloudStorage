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

// 会话失效相关：UNAUTHORIZED 时通知所有订阅者，由 renderer 统一处理跳转
const AUTH_EXPIRED_CODES = new Set(['UNAUTHORIZED'])
const authExpiredHandlers = new Set<(code: string) => void | Promise<void>>()

function notifyAuthExpired(code: string) {
  // 异步派发，避免同一次 invoke 中订阅者抛错影响 invoke 返回
  setTimeout(() => {
    for (const handler of authExpiredHandlers) {
      Promise.resolve()
        .then(() => handler(code))
        .catch((err) => {
          console.error('[preload] onAuthExpired handler error:', err)
        })
    }
  }, 0)
}

// 包装 ipcRenderer.invoke：拦截会话失效 code 的失败结果，触发全局通知
const rawInvoke: (channel: string, ...args: unknown[]) => Promise<unknown> =
  ipcRenderer.invoke.bind(ipcRenderer)

async function wrappedInvoke(channel: string, ...args: unknown[]): Promise<unknown> {
  const result = await rawInvoke(channel, ...args)
  if (
    result &&
    typeof result === 'object' &&
    (result as { success?: boolean }).success === false &&
    typeof (result as { code?: string }).code === 'string' &&
    AUTH_EXPIRED_CODES.has((result as { code: string }).code)
  ) {
    notifyAuthExpired((result as { code: string }).code)
  }
  return result
}

// 允许的 IPC 通道白名单
const validChannels = [
  'auth:session:login', 'auth:session:logout', 'auth:session:check', 'auth:user:current',
  'auth:get-users', 'auth:get-storage-stats', 'auth:preference:login',
  'file:item:list', 'file:directory:create', 'file:item:delete', 'file:item:batchDelete', 'file:item:rename', 'file:directory:getAllFiles', 'file:directory:cancelGetAllFiles', 'file:directory:getAllFilesProgress',
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
  'auth:session:expired',
  'config:status:check', 'config:data:get', 'config:data:save', 'config:data:reinit'
]

// 监听主进程广播的会话失效事件，转发到所有 onAuthExpired 订阅者
ipcRenderer.on('auth:session:expired', (_event, payload: { code?: string } | undefined) => {
  notifyAuthExpired(payload?.code || 'UNAUTHORIZED')
})

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,

  invoke: (channel: string, ...args: unknown[]) => {
    if (validChannels.includes(channel)) {
      return wrappedInvoke(channel, ...args)
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

  // 订阅 IPC 会话失效（UNAUTHORIZED）事件，返回取消订阅函数
  onAuthExpired: (handler: (code: string) => void | Promise<void>) => {
    authExpiredHandlers.add(handler)
    return () => {
      authExpiredHandlers.delete(handler)
    }
  },

  auth: {
    login: (username: string, password: string, autoLogin: boolean = false) => wrappedInvoke('auth:session:login', username, password, autoLogin),
    logout: () => wrappedInvoke('auth:session:logout'),
    checkSession: () => wrappedInvoke('auth:session:check'),
    getCurrentUser: () => wrappedInvoke('auth:user:current'),
    getUsers: (params?: { page?: number; pageSize?: number; search?: string }) => wrappedInvoke('auth:get-users', params),
    getStorageStats: () => wrappedInvoke('auth:get-storage-stats'),
    getLoginPreferences: () => wrappedInvoke('auth:preference:login')
  },

  file: {
    list: (path: string) => wrappedInvoke('file:item:list', path),
    mkdir: (path: string) => wrappedInvoke('file:directory:create', path),
    delete: (dir: string, fileName: string) => wrappedInvoke('file:item:delete', dir, fileName),
    batchDelete: (dir: string, fileNames: string[]) => wrappedInvoke('file:item:batchDelete', dir, fileNames),
    rename: (path: string, newName: string) => wrappedInvoke('file:item:rename', path, newName),
    getAllFilesInDirectory: (remotePath: string, maxFiles?: number, sessionId?: string) => wrappedInvoke('file:directory:getAllFiles', remotePath, maxFiles, sessionId),
    cancelGetAllFiles: (sessionId: string) => wrappedInvoke('file:directory:cancelGetAllFiles', sessionId),
    onGetAllFilesProgress: (callback: (data: { sessionId: string; count: number }) => void) =>
      ipcRenderer.on('file:directory:getAllFilesProgress', wrapListener(callback)),
    removeGetAllFilesProgressListener: (callback: (data: { sessionId: string; count: number }) => void) =>
      ipcRenderer.removeListener('file:directory:getAllFilesProgress', unwrapListener(callback) as never)
  },

  transfer: {
    upload: (filePath: string, remotePath: string, userId: number, userToken: string, username: string, localTaskId: string) =>
      wrappedInvoke('transfer:upload:file', { filePath, remotePath, userId, userToken, username, localTaskId }),
    download: (remotePath: string, fileName: string, userId: number, userToken: string, username: string, savePath?: string) =>
      wrappedInvoke('transfer:download:file', { remotePath, fileName, userId, userToken, username, savePath }),
    saveAs: (fileName: string, userId: number) =>
      wrappedInvoke('transfer:download:saveAs', { fileName, userId }),
    addToQueue: (task: { id: number; filePath: string; remotePath: string; userId: number; userToken: string; username: string; fileName: string; fileSize: number }) =>
      wrappedInvoke('transfer:upload:add-to-queue', task),
    getQueueStatus: () => wrappedInvoke('transfer:upload:queue-status'),
    list: (userId: number) => wrappedInvoke('transfer:task:list', userId),
    restoreQueue: (userId: number, userToken: string) =>
      wrappedInvoke('transfer:upload:restore-queue', { userId, userToken }),
    resume: (taskId: number, userId: number, userToken: string, username: string) =>
      wrappedInvoke('transfer:upload:resume', { taskId, userId, userToken, username }),
    autoRetryAll: (userId: number, userToken: string, username: string) =>
      wrappedInvoke('transfer:upload:auto-retry-all', { userId, userToken, username }),
    cancel: (taskId: number) =>
      wrappedInvoke('transfer:upload:cancel', taskId),
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
    onDownloadCompleted: (callback: (data: { taskId: string, fileName: string, savePath: string, batchId?: string, batchTotal?: number }) => void) =>
      ipcRenderer.on('transfer:download:completed', wrapListener(callback)),
    onDownloadFailed: (callback: (data: { taskId: string, fileName: string, error: string, batchId?: string, batchTotal?: number }) => void) =>
      ipcRenderer.on('transfer:download:failed', wrapListener(callback)),
    removeCompletedListener: (callback: (data: { taskId: string | number, fileName: string }) => void) =>
      ipcRenderer.removeListener('transfer:upload:completed', unwrapListener(callback) as never),
    removeFailedListener: (callback: (data: { taskId: string | number, fileName: string, error: string }) => void) =>
      ipcRenderer.removeListener('transfer:upload:failed', unwrapListener(callback) as never),
    removeCancelledListener: (callback: (data: { taskId: string | number, fileName: string }) => void) =>
      ipcRenderer.removeListener('transfer:upload:cancelled', unwrapListener(callback) as never),
    removeDownloadProgressListener: (callback: (data: { taskId: string, fileName: string, progress: number, downloadedBytes: number, totalBytes: number, speed: number }) => void) =>
      ipcRenderer.removeListener('transfer:download:progress', unwrapListener(callback) as never),
    removeDownloadCompletedListener: (callback: (data: { taskId: string, fileName: string, savePath: string, batchId?: string, batchTotal?: number }) => void) =>
      ipcRenderer.removeListener('transfer:download:completed', unwrapListener(callback) as never),
    removeDownloadFailedListener: (callback: (data: { taskId: string, fileName: string, error: string, batchId?: string, batchTotal?: number }) => void) =>
      ipcRenderer.removeListener('transfer:download:failed', unwrapListener(callback) as never),
    onDownloadCancelled: (callback: (data: { taskId: string | number, fileName?: string, batchId?: string, batchTotal?: number }) => void) =>
      ipcRenderer.on('transfer:download:cancelled', wrapListener(callback)),
    removeDownloadCancelledListener: (callback: (data: { taskId: string | number, fileName?: string, batchId?: string, batchTotal?: number }) => void) =>
      ipcRenderer.removeListener('transfer:download:cancelled', unwrapListener(callback) as never),
    onDownloadAuthFailed: (callback: (data: { error: string }) => void) =>
      ipcRenderer.on('transfer:download:auth-failed', wrapListener(callback)),
    removeDownloadAuthFailedListener: (callback: (data: { error: string }) => void) =>
      ipcRenderer.removeListener('transfer:download:auth-failed', unwrapListener(callback) as never),
    // 下载队列管理
    initDownloadQueue: (params: { userId: number; userToken: string }) =>
      wrappedInvoke('transfer:download:init-queue', params),
    queueDownload: (task: { id: string; remotePath: string; fileName: string; savePath?: string; userId: number; userToken: string; priority?: number }) =>
      wrappedInvoke('transfer:download:queue', task),
    batchQueueDownload: (params: { remotePaths: string[] }) =>
      wrappedInvoke('transfer:download:batch-queue', params),
    getDownloadQueue: () =>
      wrappedInvoke('transfer:download:get-queue'),
    pauseDownloadQueue: () =>
      wrappedInvoke('transfer:download:pause-queue'),
    resumeDownloadQueue: () =>
      wrappedInvoke('transfer:download:resume-queue'),
    clearDownloadQueue: () =>
      wrappedInvoke('transfer:download:clear-queue'),
    clearPendingQueue: () =>
      wrappedInvoke('transfer:download:clear-pending'),
    clearActiveQueue: () =>
      wrappedInvoke('transfer:download:clear-active'),
    // 恢复和取消下载
    resumeDownload: (taskId: number) =>
      wrappedInvoke('transfer:download:resume', { taskId }),
    cancelDownload: (taskId: string | number) =>
      wrappedInvoke('transfer:download:cancel', { taskId }),
    cancelAllDownloads: (userId: number) =>
      wrappedInvoke('transfer:download:cancel-all', { userId }),
    onQueueUpdated: (callback: (data: { pending: any[]; active: any[]; completed: any[]; failed: any[]; counts?: { pending: number; active: number; completed: number; failed: number } }) => void) =>
      ipcRenderer.on('transfer:queue:updated', wrapListener(callback)),
    removeQueueUpdatedListener: (callback: (data: { pending: any[]; active: any[]; completed: any[]; failed: any[]; counts?: { pending: number; active: number; completed: number; failed: number } }) => void) =>
      ipcRenderer.removeListener('transfer:queue:updated', unwrapListener(callback) as never)
  },

  dialog: {
    openFile: (options?: { directory?: boolean }) => wrappedInvoke('dialog:file:open', options)
  },

  quota: {
    get: () => wrappedInvoke('quota:usage:get'),
    update: (quotaUsed: number) => wrappedInvoke('quota:usage:update', quotaUsed),
    calculate: () => wrappedInvoke('quota:usage:calculate'),
    adminUpdate: (userId: number, quotaTotal: number) => wrappedInvoke('quota:admin:update', userId, quotaTotal)
  },

  tray: {
    updateTransferStatus: (isTransferring: boolean) => wrappedInvoke('tray:status:update-transfer', isTransferring),
    updateTransferCounts: (uploadCount: number, downloadCount: number) => wrappedInvoke('tray:status:update-counts', uploadCount, downloadCount),
    showWindow: () => wrappedInvoke('tray:window:show'),
    hideWindow: () => wrappedInvoke('tray:window:hide'),
    // Story 8.3: 监听托盘快速上传消息
    onTrayQuickUpload: (callback: () => void) => ipcRenderer.on('tray:action:quick-upload', wrapListener(callback))
  },

  notification: {
    show: (options: { title: string; body: string }) => wrappedInvoke('notification:app:show', options)
  },

  app: {
    getVersion: () => wrappedInvoke('app:version:get'),
    setLoginItemSettings: (settings: { openAtLogin: boolean }) => wrappedInvoke('app:launch:set-login-item-settings', settings),
    getLoginItemSettings: () => wrappedInvoke('app:launch:get-login-item-settings'),
    openLogsDirectory: () => wrappedInvoke('app:logs:open-directory')
  },

  activity: {
    log: (params: { userId: number; actionType: string; fileCount?: number; fileSize?: number; ipAddress?: string; userAgent?: string; details?: Record<string, any> }) =>
      wrappedInvoke('activity:log:create', params),
    getUserLogs: (userId: number, options?: { limit?: number; offset?: number; actionType?: string; startDate?: string; endDate?: string }) =>
      wrappedInvoke('activity:log:get-user-logs', userId, options),
    getAllLogs: (options?: { limit?: number; offset?: number; userId?: number; actionType?: string; startDate?: string; endDate?: string }) =>
      wrappedInvoke('activity:log:get-all-logs', options),
    getDAU: (date?: string) => wrappedInvoke('activity:analytics:get-dau', date),
    getUserStats: (userId: number, startDate?: string, endDate?: string) =>
      wrappedInvoke('activity:analytics:get-user-stats', userId, startDate, endDate)
  },

  downloadConfig: {
    selectDirectory: () => wrappedInvoke('downloadConfig:directory:select'),
    get: () => wrappedInvoke('downloadConfig:data:get'),
    update: (updates: { defaultPath?: string; autoCreateDateFolder?: boolean }) => wrappedInvoke('downloadConfig:data:update', updates),
    openDirectory: () => wrappedInvoke('downloadConfig:directory:open'),
    openFileDirectory: (filePath: string) => wrappedInvoke('downloadConfig:directory:openFile', filePath),
    reset: () => wrappedInvoke('downloadConfig:data:reset'),
    createDirectory: (dirPath: string) => wrappedInvoke('downloadConfig:directory:create', dirPath)
  },

  cache: {
    getInfo: () => wrappedInvoke('cache:info:get'),
    clear: () => wrappedInvoke('cache:data:clear')
  },

  updateAPI: {
    check: () => wrappedInvoke('update:action:check'),
    installNow: () => wrappedInvoke('update:action:install-now'),
    installOnQuit: () => wrappedInvoke('update:action:install-on-quit'),
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
      wrappedInvoke('shareTransfer:task:exec', params),
    list: (params: { userId: number; pageNum?: number; pageSize?: number; status?: string }) =>
      wrappedInvoke('shareTransfer:task:list', params),
    latest: (params: { userId: number }) =>
      wrappedInvoke('shareTransfer:task:latest', params),
    complete: (params: { id: number; userId: number }) =>
      wrappedInvoke('shareTransfer:task:complete', params),
    delete: (params: { id: number; userId: number }) =>
      wrappedInvoke('shareTransfer:task:delete', params),
    batchDelete: (params: { ids: number[]; userId: number }) =>
      wrappedInvoke('shareTransfer:task:batchDelete', params)
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
    }) => wrappedInvoke('autoSync:plan:createAndRun', params),
    listPlans: (params: { userId: number }) =>
      wrappedInvoke('autoSync:plan:list', params),
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
    }) => wrappedInvoke('autoSync:plan:update', params),
    pausePlan: (params: { id: number; userId: number }) =>
      wrappedInvoke('autoSync:plan:pause', params),
    resumePlan: (params: { id: number; userId: number }) =>
      wrappedInvoke('autoSync:plan:resume', params),
    deletePlan: (params: { id: number; userId: number }) =>
      wrappedInvoke('autoSync:plan:delete', params),
    runPlan: (params: { id: number; userId: number }) =>
      wrappedInvoke('autoSync:plan:run', params),
    listRuns: (params: { planId: number; userId: number; limit?: number }) =>
      wrappedInvoke('autoSync:run:list', params),
    startupRun: (params: { userId: number }) =>
      wrappedInvoke('autoSync:run:startup', params),
    resetBaseline: (params: { id: number; userId: number }) =>
      wrappedInvoke('autoSync:plan:resetBaseline', params),
    onProgress: (callback: (data: { planId: number; stage: string; status: string; message?: string; current?: number; total?: number }) => void) =>
      ipcRenderer.on('autoSync:event:progress', wrapListener(callback)),
    removeProgressListener: (callback: (data: { planId: number; stage: string; status: string; message?: string; current?: number; total?: number }) => void) =>
      ipcRenderer.removeListener('autoSync:event:progress', unwrapListener(callback) as never)
  },

  config: {
    check: () => wrappedInvoke('config:status:check'),
    get: () => wrappedInvoke('config:data:get'),
    /**
     * 保存配置（部分更新）
     * @param config - 与 src/main/config.ts 中的 Partial<AppConfig> 保持同步
     */
    save: (config: { alistBaseUrl?: string; n8nBaseUrl?: string; ambApiBaseUrl?: string; ambTransferToken?: string }) =>
      wrappedInvoke('config:data:save', config),
    reinit: () => wrappedInvoke('config:data:reinit')
  }
})

export {}

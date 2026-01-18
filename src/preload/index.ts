import { contextBridge, ipcRenderer } from 'electron'

// 允许的 IPC 通道白名单
const validChannels = [
  'auth:login', 'auth:logout', 'auth:register', 'auth:check-session', 'auth:complete-onboarding', 'auth:get-current-user', 'auth:get-users', 'auth:get-storage-stats',
  'file:list', 'file:mkdir', 'file:delete', 'file:batchDelete', 'file:rename',
  'transfer:upload', 'transfer:download', 'transfer:saveAs', 'transfer:cancel', 'transfer:list', 'transfer:progress',
  'transfer:add-to-queue', 'transfer:queue-status', 'transfer:restore-queue',
  'transfer:completed', 'transfer:failed', 'transfer:cancelled',
  'transfer:resume', 'transfer:auto-retry-all',
  'transfer:download-progress', 'transfer:download-completed', 'transfer:download-failed', 'transfer:download-cancelled',
  'transfer:initDownloadQueue', 'transfer:queueDownload', 'transfer:getDownloadQueue',
  'transfer:pauseDownloadQueue', 'transfer:resumeDownloadQueue', 'transfer:clearDownloadQueue',
  'transfer:resumeDownload', 'transfer:cancelDownload', 'transfer:cancelAllDownloads',
  'transfer:queue-updated',
  'quota:get', 'quota:update', 'quota:calculate', 'quota:admin-update',
  'crypto:encrypt', 'crypto:decrypt', 'crypto:isReady',
  'dialog:openFile',
  'tray:update-transfer-status', 'tray:update-transfer-counts', 'tray:show-window', 'tray:hide-window', 'tray-quick-upload',
  'notification:show', 'app:getVersion', 'app:set-login-item-settings', 'app:get-login-item-settings', 'app:open-logs-directory',
  'activity:log', 'activity:get-user-logs', 'activity:get-all-logs', 'activity:get-dau', 'activity:get-user-stats',
  'downloadConfig:selectDirectory', 'downloadConfig:get', 'downloadConfig:update', 'downloadConfig:openDirectory', 'downloadConfig:openFileDirectory', 'downloadConfig:reset', 'downloadConfig:createDirectory',
  'update:check', 'update:install-now', 'update:install-on-quit',
  'update:available', 'update:not-available', 'update:download-progress', 'update:downloaded', 'update:error'
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
      ipcRenderer.on(channel, (_event, ...args) => callback(...args))
    }
  },

  removeListener: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener(channel, callback as never)
  },

  auth: {
    login: (username: string, password: string) => ipcRenderer.invoke('auth:login', username, password),
    logout: () => ipcRenderer.invoke('auth:logout'),
    register: (username: string, password: string) => ipcRenderer.invoke('auth:register', username, password),
    checkSession: () => ipcRenderer.invoke('auth:check-session'),
    completeOnboarding: () => ipcRenderer.invoke('auth:complete-onboarding'),
    getCurrentUser: () => ipcRenderer.invoke('auth:get-current-user'),
    getUsers: (params?: { page?: number; pageSize?: number; search?: string }) => ipcRenderer.invoke('auth:get-users', params),
    getStorageStats: () => ipcRenderer.invoke('auth:get-storage-stats')
  },

  file: {
    list: (path: string) => ipcRenderer.invoke('file:list', path),
    mkdir: (path: string) => ipcRenderer.invoke('file:mkdir', path),
    delete: (dir: string, fileName: string) => ipcRenderer.invoke('file:delete', dir, fileName),
    batchDelete: (dir: string, fileNames: string[]) => ipcRenderer.invoke('file:batchDelete', dir, fileNames),
    rename: (path: string, newName: string) => ipcRenderer.invoke('file:rename', path, newName)
  },

  transfer: {
    upload: (filePath: string, remotePath: string, userId: number, userToken: string, username: string, localTaskId: string) =>
      ipcRenderer.invoke('transfer:upload', { filePath, remotePath, userId, userToken, username, localTaskId }),
    download: (remotePath: string, fileName: string, userId: number, userToken: string, username: string) =>
      ipcRenderer.invoke('transfer:download', { remotePath, fileName, userId, userToken, username }),
    saveAs: (fileName: string, userId: number) =>
      ipcRenderer.invoke('transfer:saveAs', { fileName, userId }),
    addToQueue: (task: { id: number; filePath: string; remotePath: string; userId: number; userToken: string; username: string; fileName: string; fileSize: number }) =>
      ipcRenderer.invoke('transfer:add-to-queue', task),
    getQueueStatus: () => ipcRenderer.invoke('transfer:queue-status'),
    list: (userId: number) => ipcRenderer.invoke('transfer:list', userId),
    restoreQueue: (userId: number, userToken: string, username: string) =>
      ipcRenderer.invoke('transfer:restore-queue', { userId, userToken, username }),
    resume: (taskId: number, userId: number, userToken: string, username: string) =>
      ipcRenderer.invoke('transfer:resume', { taskId, userId, userToken, username }),
    autoRetryAll: (userId: number, userToken: string, username: string) =>
      ipcRenderer.invoke('transfer:auto-retry-all', { userId, userToken, username }),
    cancel: (taskId: number) =>
      ipcRenderer.invoke('transfer:cancel', taskId),
    onProgress: (callback: (data: { taskId: string | number, progress: number }) => void) =>
      ipcRenderer.on('transfer:progress', (_event, data) => callback(data)),
    removeProgressListener: (callback: (data: { taskId: string | number, progress: number }) => void) =>
      ipcRenderer.removeListener('transfer:progress', callback as never),
    onCompleted: (callback: (data: { taskId: string | number, fileName: string }) => void) =>
      ipcRenderer.on('transfer:completed', (_event, data) => callback(data)),
    onFailed: (callback: (data: { taskId: string | number, fileName: string, error: string }) => void) =>
      ipcRenderer.on('transfer:failed', (_event, data) => callback(data)),
    onCancelled: (callback: (data: { taskId: string | number, fileName: string }) => void) =>
      ipcRenderer.on('transfer:cancelled', (_event, data) => callback(data)),
    onDownloadProgress: (callback: (data: { taskId: string, fileName: string, progress: number, downloadedBytes: number, totalBytes: number, speed: number }) => void) =>
      ipcRenderer.on('transfer:download-progress', (_event, data) => callback(data)),
    onDownloadCompleted: (callback: (data: { taskId: string, fileName: string, savePath: string }) => void) =>
      ipcRenderer.on('transfer:download-completed', (_event, data) => callback(data)),
    onDownloadFailed: (callback: (data: { taskId: string, fileName: string, error: string }) => void) =>
      ipcRenderer.on('transfer:download-failed', (_event, data) => callback(data)),
    removeCompletedListener: (callback: (data: { taskId: string | number, fileName: string }) => void) =>
      ipcRenderer.removeListener('transfer:completed', callback as never),
    removeFailedListener: (callback: (data: { taskId: string | number, fileName: string, error: string }) => void) =>
      ipcRenderer.removeListener('transfer:failed', callback as never),
    removeCancelledListener: (callback: (data: { taskId: string | number, fileName: string }) => void) =>
      ipcRenderer.removeListener('transfer:cancelled', callback as never),
    removeDownloadProgressListener: (callback: (data: { taskId: string, fileName: string, progress: number, downloadedBytes: number, totalBytes: number, speed: number }) => void) =>
      ipcRenderer.removeListener('transfer:download-progress', callback as never),
    removeDownloadCompletedListener: (callback: (data: { taskId: string, fileName: string, savePath: string }) => void) =>
      ipcRenderer.removeListener('transfer:download-completed', callback as never),
    removeDownloadFailedListener: (callback: (data: { taskId: string, fileName: string, error: string }) => void) =>
      ipcRenderer.removeListener('transfer:download-failed', callback as never),
    onDownloadCancelled: (callback: (data: { taskId: string | number }) => void) =>
      ipcRenderer.on('transfer:download-cancelled', (_event, data) => callback(data)),
    removeDownloadCancelledListener: (callback: (data: { taskId: string | number }) => void) =>
      ipcRenderer.removeListener('transfer:download-cancelled', callback as never),
    // 下载队列管理
    initDownloadQueue: (params: { userId: number; userToken: string; username: string }) =>
      ipcRenderer.invoke('transfer:initDownloadQueue', params),
    queueDownload: (task: { id: string; remotePath: string; fileName: string; savePath?: string; userId: number; userToken: string; username: string; priority?: number }) =>
      ipcRenderer.invoke('transfer:queueDownload', task),
    getDownloadQueue: () =>
      ipcRenderer.invoke('transfer:getDownloadQueue'),
    pauseDownloadQueue: () =>
      ipcRenderer.invoke('transfer:pauseDownloadQueue'),
    resumeDownloadQueue: () =>
      ipcRenderer.invoke('transfer:resumeDownloadQueue'),
    clearDownloadQueue: () =>
      ipcRenderer.invoke('transfer:clearDownloadQueue'),
    // 恢复和取消下载
    resumeDownload: (taskId: number) =>
      ipcRenderer.invoke('transfer:resumeDownload', { taskId }),
    cancelDownload: (taskId: string | number) =>
      ipcRenderer.invoke('transfer:cancelDownload', { taskId }),
    cancelAllDownloads: (userId: number) =>
      ipcRenderer.invoke('transfer:cancelAllDownloads', { userId }),
    onQueueUpdated: (callback: (data: { pending: any[]; active: any[]; completed: any[]; failed: any[] }) => void) =>
      ipcRenderer.on('transfer:queue-updated', (_event, data) => callback(data)),
    removeQueueUpdatedListener: (callback: (data: { pending: any[]; active: any[]; completed: any[]; failed: any[] }) => void) =>
      ipcRenderer.removeListener('transfer:queue-updated', callback as never)
  },

  dialog: {
    openFile: (options?: { directory?: boolean }) => ipcRenderer.invoke('dialog:openFile', options)
  },

  quota: {
    get: () => ipcRenderer.invoke('quota:get'),
    update: (quotaUsed: number) => ipcRenderer.invoke('quota:update', quotaUsed),
    calculate: () => ipcRenderer.invoke('quota:calculate'),
    adminUpdate: (userId: number, quotaTotal: number) => ipcRenderer.invoke('quota:admin-update', userId, quotaTotal)
  },

  tray: {
    updateTransferStatus: (isTransferring: boolean) => ipcRenderer.invoke('tray:update-transfer-status', isTransferring),
    updateTransferCounts: (uploadCount: number, downloadCount: number) => ipcRenderer.invoke('tray:update-transfer-counts', uploadCount, downloadCount),
    showWindow: () => ipcRenderer.invoke('tray:show-window'),
    hideWindow: () => ipcRenderer.invoke('tray:hide-window'),
    // Story 8.3: 监听托盘快速上传消息
    onTrayQuickUpload: (callback: () => void) => ipcRenderer.on('tray-quick-upload', () => callback())
  },

  notification: {
    show: (options: { title: string; body: string }) => ipcRenderer.invoke('notification:show', options)
  },

  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    setLoginItemSettings: (settings: { openAtLogin: boolean }) => ipcRenderer.invoke('app:set-login-item-settings', settings),
    getLoginItemSettings: () => ipcRenderer.invoke('app:get-login-item-settings'),
    openLogsDirectory: () => ipcRenderer.invoke('app:open-logs-directory')
  },

  activity: {
    log: (params: { userId: number; actionType: string; fileCount?: number; fileSize?: number; ipAddress?: string; userAgent?: string; details?: Record<string, any> }) =>
      ipcRenderer.invoke('activity:log', params),
    getUserLogs: (userId: number, options?: { limit?: number; offset?: number; actionType?: string; startDate?: string; endDate?: string }) =>
      ipcRenderer.invoke('activity:get-user-logs', userId, options),
    getAllLogs: (options?: { limit?: number; offset?: number; userId?: number; actionType?: string; startDate?: string; endDate?: string }) =>
      ipcRenderer.invoke('activity:get-all-logs', options),
    getDAU: (date?: string) => ipcRenderer.invoke('activity:get-dau', date),
    getUserStats: (userId: number, startDate?: string, endDate?: string) =>
      ipcRenderer.invoke('activity:get-user-stats', userId, startDate, endDate)
  },

  downloadConfig: {
    selectDirectory: () => ipcRenderer.invoke('downloadConfig:selectDirectory'),
    get: () => ipcRenderer.invoke('downloadConfig:get'),
    update: (updates: { defaultPath?: string; autoCreateDateFolder?: boolean }) => ipcRenderer.invoke('downloadConfig:update', updates),
    openDirectory: () => ipcRenderer.invoke('downloadConfig:openDirectory'),
    openFileDirectory: (filePath: string) => ipcRenderer.invoke('downloadConfig:openFileDirectory', filePath),
    reset: () => ipcRenderer.invoke('downloadConfig:reset'),
    createDirectory: (dirPath: string) => ipcRenderer.invoke('downloadConfig:createDirectory', dirPath)
  },

  updateAPI: {
    check: () => ipcRenderer.invoke('update:check'),
    installNow: () => ipcRenderer.invoke('update:install-now'),
    installOnQuit: () => ipcRenderer.invoke('update:install-on-quit'),
    onAvailable: (callback: (info: any) => void) =>
      ipcRenderer.on('update:available', (_, info) => callback(info)),
    onNotAvailable: (callback: () => void) =>
      ipcRenderer.on('update:not-available', () => callback()),
    onDownloadProgress: (callback: (progress: any) => void) =>
      ipcRenderer.on('update:download-progress', (_, progress) => callback(progress)),
    onDownloaded: (callback: () => void) =>
      ipcRenderer.on('update:downloaded', () => callback()),
    onError: (callback: (message: string) => void) =>
      ipcRenderer.on('update:error', (_, message) => callback(message))
  }
})

export {}

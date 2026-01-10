import { contextBridge, ipcRenderer } from 'electron'

// 允许的 IPC 通道白名单
const validChannels = [
  'auth:login', 'auth:logout', 'auth:register', 'auth:check-session', 'auth:complete-onboarding',
  'file:list', 'file:mkdir', 'file:delete',
  'transfer:upload', 'transfer:download', 'transfer:saveAs', 'transfer:cancel', 'transfer:list', 'transfer:progress',
  'transfer:add-to-queue', 'transfer:queue-status', 'transfer:restore-queue',
  'transfer:completed', 'transfer:failed', 'transfer:cancelled',
  'transfer:resume', 'transfer:auto-retry-all',
  'transfer:download-progress', 'transfer:download-completed', 'transfer:download-failed', 'transfer:download-cancelled',
  'transfer:initDownloadQueue', 'transfer:queueDownload', 'transfer:getDownloadQueue',
  'transfer:pauseDownloadQueue', 'transfer:resumeDownloadQueue', 'transfer:clearDownloadQueue',
  'transfer:resumeDownload', 'transfer:cancelDownload', 'transfer:cancelAllDownloads',
  'transfer:queue-updated',
  'quota:get', 'quota:update',
  'crypto:encrypt', 'crypto:decrypt', 'crypto:isReady',
  'dialog:openFile',
  'app:getVersion'
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
    completeOnboarding: () => ipcRenderer.invoke('auth:complete-onboarding')
  },

  file: {
    list: (path: string) => ipcRenderer.invoke('file:list', path),
    mkdir: (path: string) => ipcRenderer.invoke('file:mkdir', path),
    delete: (path: string) => ipcRenderer.invoke('file:delete', path)
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
  }
})

export {}

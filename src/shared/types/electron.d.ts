export interface FileItem {
  name: string
  size: number
  isDir: boolean
  modified: string
  sign?: string
  thumb?: string
  type?: number
}

export interface FileListResult {
  success: boolean
  data?: {
    content: FileItem[]
    total: number
  }
  error?: string
}

export interface MkdirResult {
  success: boolean
  error?: string
}

export interface SaveAsResult {
  success: boolean
  canceled?: boolean
  filePath?: string
  error?: string
}

export interface ElectronAPI {
  platform: NodeJS.Platform
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
  on: (channel: string, callback: (...args: unknown[]) => void) => void
  removeListener: (channel: string, callback: (...args: unknown[]) => void) => void
  auth: {
    login: (username: string, password: string) => Promise<{ success: boolean; message?: string; token?: string }>
    logout: () => Promise<{ success: boolean }>
    register: (username: string, password: string) => Promise<{ success: boolean; message?: string }>
    checkSession: () => Promise<{ valid: boolean; username?: string; onboardingCompleted?: boolean }>
    completeOnboarding: () => Promise<{ success: boolean }>
  }
  file: {
    list: (path: string) => Promise<FileListResult>
    mkdir: (path: string) => Promise<MkdirResult>
    delete: (dir: string, fileName: string) => Promise<MkdirResult>
    batchDelete: (dir: string, fileNames: string[]) => Promise<MkdirResult>
  }
  transfer: {
    upload: (filePath: string, remotePath: string, userId: number, userToken: string, username: string, localTaskId: string) => Promise<{ success: boolean; taskId?: string; error?: string }>
    download: (remotePath: string, fileName: string, userId: number, userToken: string, username: string) => Promise<{ success: boolean; taskId?: string; savePath?: string; error?: string }>
    saveAs: (fileName: string, userId: number) => Promise<SaveAsResult>
    addToQueue: (task: { id: number; filePath: string; remotePath: string; userId: number; userToken: string; username: string; fileName: string; fileSize: number }) => Promise<{ success: boolean }>
    getQueueStatus: () => Promise<any>
    list: (userId: number) => Promise<any[]>
    restoreQueue: (userId: number, userToken: string, username: string) => Promise<{ restored: number }>
    resume: (taskId: number, userId: number, userToken: string, username: string) => Promise<{ success: boolean; error?: string }>
    autoRetryAll: (userId: number, userToken: string, username: string) => Promise<{ success: boolean; retriedCount?: number; error?: string }>
    cancel: (taskId: number) => Promise<{ success: boolean; error?: string }>
    onProgress: (callback: (data: { taskId: string | number, progress: number }) => void) => void
    removeProgressListener: (callback: (data: { taskId: string | number, progress: number }) => void) => void
    onCompleted: (callback: (data: { taskId: string | number, fileName: string }) => void) => void
    onFailed: (callback: (data: { taskId: string | number, fileName: string, error: string }) => void) => void
    onCancelled: (callback: (data: { taskId: string | number, fileName: string }) => void) => void
    onDownloadProgress: (callback: (data: { taskId: string, fileName: string, progress: number, downloadedBytes: number, totalBytes: number, speed: number }) => void) => void
    onDownloadCompleted: (callback: (data: { taskId: string, fileName: string, savePath: string }) => void) => void
    onDownloadFailed: (callback: (data: { taskId: string, fileName: string, error: string }) => void) => void
    removeCompletedListener: (callback: (data: { taskId: string | number, fileName: string }) => void) => void
    removeFailedListener: (callback: (data: { taskId: string | number, fileName: string, error: string }) => void) => void
    removeCancelledListener: (callback: (data: { taskId: string | number, fileName: string }) => void) => void
    removeDownloadProgressListener: (callback: (data: { taskId: string, fileName: string, progress: number, downloadedBytes: number, totalBytes: number, speed: number }) => void) => void
    removeDownloadCompletedListener: (callback: (data: { taskId: string, fileName: string, savePath: string }) => void) => void
    removeDownloadFailedListener: (callback: (data: { taskId: string, fileName: string, error: string }) => void) => void
    // 下载队列管理
    initDownloadQueue: (params: { userId: number; userToken: string; username: string }) => Promise<{ success: boolean; restoredCount?: number; error?: string }>
    queueDownload: (task: { id: string; remotePath: string; fileName: string; savePath?: string; userId: number; userToken: string; username: string; priority?: number }) => Promise<{ success: boolean; taskId?: string; error?: string }>
    getDownloadQueue: () => Promise<{ success: boolean; state?: { pending: any[]; active: any[]; completed: any[]; failed: any[] }; error?: string }>
    pauseDownloadQueue: () => Promise<{ success: boolean; error?: string }>
    resumeDownloadQueue: () => Promise<{ success: boolean; error?: string }>
    clearDownloadQueue: () => Promise<{ success: boolean; error?: string }>
    onQueueUpdated: (callback: (data: { pending: any[]; active: any[]; completed: any[]; failed: any[] }) => void) => void
    removeQueueUpdatedListener: (callback: (data: { pending: any[]; active: any[]; completed: any[]; failed: any[] }) => void) => void
  }
  dialog: {
    openFile: (options?: { directory?: boolean }) => Promise<string[]>
  }
  cache: {
    getInfo: () => Promise<{ success: boolean; size?: string; directory?: string; lastCleanup?: string; error?: string }>
    clear: () => Promise<{ success: boolean; clearedSize?: string; filesDeleted?: string; remainingSize?: string; error?: string }>
  }
  updateAPI: {
    check: () => Promise<void>
    installNow: () => Promise<void>
    installOnQuit: () => Promise<void>
    onAvailable: (callback: (info: any) => void) => void
    onNotAvailable: (callback: () => void) => void
    onDownloadProgress: (callback: (progress: any) => void) => void
    onDownloaded: (callback: () => void) => void
    onError: (callback: (message: string) => void) => void
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
    $message: {
      success: (message: string) => void
      error: (message: string) => void
      warning: (message: string) => void
      info: (message: string) => void
    }
  }
}

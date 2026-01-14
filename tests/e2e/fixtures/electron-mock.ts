/**
 * Electron API Mock for E2E Testing
 * 在普通浏览器中模拟 window.electronAPI
 */

export const electronAPIMock = `
window.electronAPI = {
  platform: 'win32',
  invoke: () => Promise.resolve({ success: true }),
  on: () => {},
  removeListener: () => {},
  auth: {
    login: (username, password) => {
      if (username === 'testuser' && password === 'testpass') {
        return Promise.resolve({ success: true, user: { id: 1, username: 'testuser', isAdmin: false } })
      }
      if (username === 'admin' && password === 'admin123') {
        return Promise.resolve({ success: true, user: { id: 2, username: 'admin', isAdmin: true } })
      }
      return Promise.resolve({ success: false, message: '用户名或密码错误' })
    },
    logout: () => Promise.resolve({ success: true }),
    register: () => Promise.resolve({ success: true }),
    checkSession: () => Promise.resolve({ valid: true, onboardingCompleted: true, user: { id: 1, username: 'testuser', isAdmin: false } }),
    completeOnboarding: () => Promise.resolve({ success: true }),
    getCurrentUser: () => Promise.resolve({ success: true, user: { id: 1, username: 'testuser', isAdmin: false } }),
    getUsers: () => Promise.resolve({ success: true, users: [] }),
    getStorageStats: () => Promise.resolve({ success: true, stats: { totalQuota: 1000000, usedQuota: 500000 } })
  },
  file: {
    list: () => Promise.resolve({ success: true, files: [] }),
    mkdir: () => Promise.resolve({ success: true }),
    delete: () => Promise.resolve({ success: true })
  },
  transfer: {
    upload: () => Promise.resolve({ success: true }),
    download: () => Promise.resolve({ success: true }),
    saveAs: () => Promise.resolve({ success: true }),
    addToQueue: () => Promise.resolve({ success: true }),
    getQueueStatus: () => Promise.resolve({ pending: [], active: [], completed: [], failed: [] }),
    list: () => Promise.resolve({ success: true, tasks: [] }),
    restoreQueue: () => Promise.resolve({ success: true }),
    resume: () => Promise.resolve({ success: true }),
    autoRetryAll: () => Promise.resolve({ success: true }),
    cancel: () => Promise.resolve({ success: true }),
    onProgress: () => {},
    removeProgressListener: () => {},
    onCompleted: () => {},
    onFailed: () => {},
    onCancelled: () => {},
    onDownloadProgress: () => {},
    onDownloadCompleted: () => {},
    onDownloadFailed: () => {},
    removeCompletedListener: () => {},
    removeFailedListener: () => {},
    removeCancelledListener: () => {},
    removeDownloadProgressListener: () => {},
    removeDownloadCompletedListener: () => {},
    removeDownloadFailedListener: () => {},
    onDownloadCancelled: () => {},
    removeDownloadCancelledListener: () => {},
    initDownloadQueue: () => Promise.resolve({ success: true }),
    queueDownload: () => Promise.resolve({ success: true }),
    getDownloadQueue: () => Promise.resolve({ pending: [], active: [], completed: [], failed: [] }),
    pauseDownloadQueue: () => Promise.resolve({ success: true }),
    resumeDownloadQueue: () => Promise.resolve({ success: true }),
    clearDownloadQueue: () => Promise.resolve({ success: true }),
    resumeDownload: () => Promise.resolve({ success: true }),
    cancelDownload: () => Promise.resolve({ success: true }),
    cancelAllDownloads: () => Promise.resolve({ success: true }),
    onQueueUpdated: () => {},
    removeQueueUpdatedListener: () => {}
  },
  dialog: {
    openFile: () => Promise.resolve({ success: true, filePaths: [] })
  },
  quota: {
    get: () => Promise.resolve({ success: true, quota: { total: 1000000, used: 500000 } }),
    update: () => Promise.resolve({ success: true }),
    calculate: () => Promise.resolve({ success: true }),
    adminUpdate: () => Promise.resolve({ success: true })
  },
  tray: {
    updateTransferStatus: () => Promise.resolve({ success: true }),
    updateTransferCounts: () => Promise.resolve({ success: true }),
    showWindow: () => Promise.resolve({ success: true }),
    hideWindow: () => Promise.resolve({ success: true }),
    onTrayQuickUpload: () => {}
  },
  notification: {
    show: () => Promise.resolve({ success: true })
  },
  app: {
    getVersion: () => Promise.resolve('1.0.0'),
    setLoginItemSettings: () => Promise.resolve({ success: true }),
    getLoginItemSettings: () => Promise.resolve({ openAtLogin: false })
  },
  activity: {
    log: () => Promise.resolve({ success: true }),
    getUserLogs: () => Promise.resolve({ success: true, logs: [] }),
    getAllLogs: () => Promise.resolve({ success: true, logs: [] }),
    getDAU: () => Promise.resolve({ success: true, dau: 0 }),
    getUserStats: () => Promise.resolve({ success: true, stats: {} })
  }
}
`

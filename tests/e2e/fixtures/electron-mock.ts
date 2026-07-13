/**
 * Electron API Mock for E2E Testing
 * 在普通浏览器中模拟 window.electronAPI
 */

export const electronAPIMock = `
window.__liuliuCacheCleared = false
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
    checkSession: () => Promise.resolve({ valid: true, user: { id: 1, username: 'testuser', isAdmin: false } }),
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
    getLoginItemSettings: () => Promise.resolve({ success: true, openAtLogin: false }),
    openLogsDirectory: () => Promise.resolve({ success: true })
  },
  downloadConfig: {
    selectDirectory: () => Promise.resolve({ success: true, path: 'C:\\\\Downloads' }),
    get: () => Promise.resolve({ defaultPath: 'C:\\\\Downloads', autoCreateDateFolder: false }),
    update: () => Promise.resolve({ success: true }),
    openDirectory: () => Promise.resolve({ success: true }),
    openFileDirectory: () => Promise.resolve({ success: true }),
    reset: () => Promise.resolve({ success: true }),
    createDirectory: () => Promise.resolve({ success: true, path: 'C:\\\\Downloads' })
  },
  cache: {
    getInfo: () => Promise.resolve({
      success: true,
      size: window.__liuliuCacheCleared ? '0 B' : '128 MB',
      directory: 'C:\\\\Users\\\\test\\\\AppData\\\\Roaming\\\\liuliu-cloud-storage\\\\Cache',
      lastCleanup: window.__liuliuCacheCleared ? '刚刚' : ''
    }),
    clear: () => {
      window.__liuliuCacheCleared = true
      return Promise.resolve({
        success: true,
        clearedSize: '128 MB',
        remainingSize: '0 B',
        filesDeleted: 3
      })
    }
  },
  config: {
    check: () => Promise.resolve({ complete: true, missing: [] }),
    get: () => Promise.resolve({
      alistBaseUrl: 'http://localhost:5244',
      n8nBaseUrl: '',
      ambApiBaseUrl: 'https://amb.example.com/prod-api',
      ambTransferToken: ''
    }),
    save: () => Promise.resolve({ success: true }),
    reinit: () => Promise.resolve({ success: true })
  },
  autoSync: {
    createPlanAndRun: () => Promise.resolve({ success: true }),
    listPlans: () => Promise.resolve({ success: true, data: [] }),
    updatePlan: () => Promise.resolve({ success: true }),
    pausePlan: () => Promise.resolve({ success: true }),
    resumePlan: () => Promise.resolve({ success: true }),
    deletePlan: () => Promise.resolve({ success: true }),
    runPlan: () => Promise.resolve({ success: true }),
    listRuns: () => Promise.resolve({ success: true, data: [] }),
    startupRun: () => Promise.resolve({ success: true, executed: 0, total: 0 }),
    resetBaseline: () => Promise.resolve({ success: true }),
    onProgress: () => {},
    removeProgressListener: () => {}
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

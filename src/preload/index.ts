import { contextBridge, ipcRenderer } from 'electron'

// 允许的 IPC 通道白名单
const validChannels = [
  'auth:login', 'auth:logout', 'auth:register', 'auth:check-session', 'auth:complete-onboarding',
  'file:list', 'file:mkdir', 'file:delete',
  'transfer:upload', 'transfer:download', 'transfer:cancel', 'transfer:list',
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

  dialog: {
    openFile: (options?: { directory?: boolean }) => ipcRenderer.invoke('dialog:openFile', options)
  }
})

export {}

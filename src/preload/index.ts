import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // TODO: Add IPC methods here in future stories
  platform: process.platform,

  // Example IPC methods (to be implemented in future stories)
  on: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.on(channel, callback as any)
  },
  removeListener: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, callback as any)
  }
})

export {}

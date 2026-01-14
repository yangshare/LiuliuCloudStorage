// 共享类型定义
// 这个文件将在后续 Story 中扩展

export interface ElectronAPI {
  platform: string
  on: (channel: string, callback: (...args: any[]) => void) => void
  removeListener: (channel: string, callback: (...args: any[]) => void) => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}

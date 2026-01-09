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
    delete: (path: string) => Promise<MkdirResult>
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

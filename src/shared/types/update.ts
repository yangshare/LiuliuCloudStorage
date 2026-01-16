export interface UpdateInfo {
  version: string
  releaseDate?: string
  releaseName?: string
  releaseNotes?: string
}

export interface ProgressInfo {
  total: number
  delta: number
  transferred: number
  percent: number
  bytesPerSecond: number
}

export interface UpdateAPI {
  check: () => Promise<void>
  installNow: () => Promise<void>
  installOnQuit: () => Promise<void>
  onAvailable: (callback: (info: UpdateInfo) => void) => void
  onNotAvailable: (callback: () => void) => void
  onDownloadProgress: (callback: (progress: ProgressInfo) => void) => void
  onDownloaded: (callback: () => void) => void
  onError: (callback: (message: string) => void) => void
}

declare global {
  interface Window {
    updateAPI: UpdateAPI
  }
}

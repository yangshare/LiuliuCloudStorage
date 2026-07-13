// src/shared/types/file.ts

import type { IPCResult } from './ipc'

export interface FileItem {
  name: string
  size: number
  isDir: boolean
  modified: string
  sign?: string
  thumb?: string
}

export interface FileListResult {
  content: FileItem[]
  total: number
  fromCache?: boolean
  cachedAt?: string
}

export type FileListResponse = IPCResult<FileListResult>
export type FileOperationResult = IPCResult<void>

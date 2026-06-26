// src/renderer/src/features/file/file.renderer.service.ts

import type { FileListResponse, FileOperationResult } from '../../../../shared/types/file'

export const fileRendererService = {
  async list(path: string): Promise<FileListResponse> {
    return window.electronAPI.file.list(path)
  },

  async mkdir(path: string): Promise<FileOperationResult> {
    return window.electronAPI.file.mkdir(path)
  },

  async deleteFile(dir: string, fileName: string): Promise<FileOperationResult> {
    return window.electronAPI.file.delete(dir, fileName)
  },

  async batchDelete(dir: string, fileNames: string[]): Promise<FileOperationResult> {
    return window.electronAPI.file.batchDelete(dir, fileNames)
  },

  async rename(path: string, newName: string): Promise<FileOperationResult> {
    return window.electronAPI.file.rename(path, newName)
  },

  async getAllFilesInDirectory(remotePath: string, maxFiles?: number): Promise<{ success: boolean; data?: { files: string[]; truncated: boolean }; error?: string }> {
    return window.electronAPI.file.getAllFilesInDirectory(remotePath, maxFiles)
  }
}

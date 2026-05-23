// src/renderer/src/features/file/composables/useFileNavigation.ts
// 文件导航相关逻辑：获取文件列表、目录跳转、创建文件夹

import { ref } from 'vue'
import type { FileItem } from '../../../../../shared/types/electron'
import { IPCErrorCode } from '../../../../../shared/types/ipc'

// 常量
const PATH_SEPARATOR = '/'
const ROOT_PATH = '/'

export function useFileNavigation() {
  // State
  const files = ref<FileItem[]>([])
  const currentPath = ref<string>(ROOT_PATH)
  const isLoadingFiles = ref<boolean>(false)
  const filesError = ref<string | null>(null)
  const isOnline = ref<boolean>(navigator.onLine)
  const cacheTime = ref<string | null>(null)
  const isNavigating = ref<boolean>(false)
  const isCreatingFolder = ref<boolean>(false)
  const selectedFile = ref<FileItem | null>(null)

  // 网络状态监听
  function handleOnline() { isOnline.value = true }
  function handleOffline() { isOnline.value = false }

  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
  }

  async function fetchFiles(path: string = '/') {
    // 防止重复请求
    if (isNavigating.value) {
      return
    }

    isNavigating.value = true
    isLoadingFiles.value = true
    filesError.value = null
    cacheTime.value = null

    try {
      const result = await window.electronAPI.file.list(path)
      if (result?.success && result.data) {
        files.value = result.data.content
        currentPath.value = path
        // 检查是否来自缓存
        if (result.data.fromCache) {
          isOnline.value = false
          cacheTime.value = result.data.cachedAt ? new Date(result.data.cachedAt).toLocaleString() : null
        } else {
          isOnline.value = true
        }
      } else {
        // 会话失效由 preload 全局拦截统一跳转登录页，这里不再显示业务错误，避免红色 alert 闪烁
        if (result?.code === IPCErrorCode.UNAUTHORIZED) {
          return
        }
        filesError.value = result?.error || '获取文件列表失败'
      }
    } catch (error) {
      console.error('获取文件列表失败:', error)
      filesError.value = '网络错误，请稍后重试'
    } finally {
      isLoadingFiles.value = false
      isNavigating.value = false
    }
  }

  // 导航到指定路径
  function navigateTo(path: string) {
    // 防止重复导航和快速点击
    if (path === currentPath.value || isNavigating.value) {
      return
    }
    fetchFiles(path)
  }

  // 进入文件夹
  function enterFolder(file: FileItem) {
    if (file.isDir && !isNavigating.value) {
      const newPath = currentPath.value === ROOT_PATH
        ? `${PATH_SEPARATOR}${file.name}`
        : `${currentPath.value}${PATH_SEPARATOR}${file.name}`
      fetchFiles(newPath)
    }
  }

  // 返回上级目录
  function goUp() {
    if (currentPath.value === ROOT_PATH) return
    const parts = currentPath.value.split(PATH_SEPARATOR).filter(Boolean)
    parts.pop()
    const parentPath = parts.length === 0 ? ROOT_PATH : `${PATH_SEPARATOR}${parts.join(PATH_SEPARATOR)}`
    fetchFiles(parentPath)
  }

  // 刷新当前目录
  function refresh() {
    fetchFiles(currentPath.value)
  }

  // 选择文件查看详情
  function selectFile(file: FileItem | null) {
    selectedFile.value = file
  }

  // 创建新文件夹
  async function createFolder(folderName: string): Promise<boolean> {
    try {
      isCreatingFolder.value = true

      const folderPath = currentPath.value === ROOT_PATH
        ? `${PATH_SEPARATOR}${folderName}`
        : `${currentPath.value}${PATH_SEPARATOR}${folderName}`

      const result = await window.electronAPI.file.mkdir(folderPath)

      if (!result.success) {
        const errorMsg = result.error || '创建文件夹失败'
        if (errorMsg.includes('exist') || errorMsg.includes('已存在')) {
          window.$message.error('文件夹已存在')
        } else if (errorMsg.includes('permission') || errorMsg.includes('权限')) {
          window.$message.error('权限不足')
        } else {
          window.$message.error(errorMsg)
        }
        return false
      }

      await fetchFiles(currentPath.value)
      window.$message.success('文件夹创建成功')
      return true

    } catch (error: any) {
      console.error('创建文件夹失败:', error)
      window.$message.error('创建文件夹失败，请重试')
      return false
    } finally {
      isCreatingFolder.value = false
    }
  }

  return {
    // State
    files,
    currentPath,
    isLoadingFiles,
    filesError,
    selectedFile,
    isOnline,
    cacheTime,
    isNavigating,
    isCreatingFolder,
    // Actions
    fetchFiles,
    navigateTo,
    enterFolder,
    goUp,
    refresh,
    selectFile,
    createFolder
  }
}

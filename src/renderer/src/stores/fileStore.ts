import { defineStore } from 'pinia'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import type { FileItem } from '../../../shared/types/electron'

export interface TreeNode {
  key: string
  label: string
  isLeaf: boolean
  children?: TreeNode[]
}

export const useFileStore = defineStore('file', () => {
  const router = useRouter()

  // State
  const files = ref<FileItem[]>([])
  const currentPath = ref<string>('/')
  const isLoadingFiles = ref<boolean>(false)
  const filesError = ref<string | null>(null)
  const selectedFile = ref<FileItem | null>(null)
  const isOnline = ref<boolean>(navigator.onLine)
  const cacheTime = ref<string | null>(null)
  const treeData = ref<TreeNode[]>([{ key: '/', label: '根目录', isLeaf: false }])

  // 网络状态监听
  function handleOnline() { isOnline.value = true }
  function handleOffline() { isOnline.value = false }

  // 在组件挂载时设置监听器
  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
  }

  // Getters
  const sortedFiles = computed(() => {
    return [...files.value].sort((a, b) => {
      if (a.isDir && !b.isDir) return -1
      if (!a.isDir && b.isDir) return 1
      return a.name.localeCompare(b.name)
    })
  })

  // Actions
  async function fetchFiles(path: string = '/') {
    isLoadingFiles.value = true
    filesError.value = null
    cacheTime.value = null

    try {
      const result = await window.electronAPI.file.list(path)
      if (result.success && result.data) {
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
        // 检测 403 权限错误，跳转登录页
        if (result.error?.includes('403') || result.error?.includes('permission')) {
          await window.electronAPI.auth.logout()
          router.push('/login')
          return
        }
        filesError.value = result.error || '获取文件列表失败'
      }
    } catch {
      filesError.value = '网络错误，请稍后重试'
    } finally {
      isLoadingFiles.value = false
    }
  }

  // 面包屑导航数据
  const breadcrumbs = computed(() => {
    const parts = currentPath.value.split('/').filter(Boolean)
    const result = [{ path: '/', label: '根目录' }]
    let accPath = ''
    for (const part of parts) {
      accPath += '/' + part
      result.push({ path: accPath, label: part })
    }
    return result
  })

  // 导航到指定路径
  function navigateTo(path: string) {
    fetchFiles(path)
  }

  // 进入文件夹
  function enterFolder(file: FileItem) {
    if (file.isDir) {
      const newPath = currentPath.value === '/' ? `/${file.name}` : `${currentPath.value}/${file.name}`
      fetchFiles(newPath)
    }
  }

  // 返回上级目录
  function goUp() {
    if (currentPath.value === '/') return
    const parts = currentPath.value.split('/').filter(Boolean)
    parts.pop()
    const parentPath = parts.length === 0 ? '/' : '/' + parts.join('/')
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

  // 懒加载目录树子节点
  async function loadTreeChildren(path: string): Promise<TreeNode[]> {
    try {
      const result = await window.electronAPI.file.list(path)
      if (result.success && result.data) {
        return result.data.content
          .filter((f: FileItem) => f.isDir)
          .map((f: FileItem) => ({
            key: path === '/' ? `/${f.name}` : `${path}/${f.name}`,
            label: f.name,
            isLeaf: false
          }))
      }
    } catch {
      // ignore
    }
    return []
  }

  return {
    files,
    currentPath,
    isLoadingFiles,
    filesError,
    sortedFiles,
    selectedFile,
    isOnline,
    cacheTime,
    treeData,
    breadcrumbs,
    fetchFiles,
    navigateTo,
    enterFolder,
    goUp,
    refresh,
    selectFile,
    loadTreeChildren
  }
})

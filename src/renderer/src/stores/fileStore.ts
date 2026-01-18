import { defineStore } from 'pinia'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import type { FileItem } from '../../../shared/types/electron'

// 常量
const PATH_SEPARATOR = '/'
const ROOT_PATH = '/'
const ROOT_LABEL = '根目录'

// 网格密度类型
export type GridDensity = 'compact' | 'comfortable' | 'spacious'

// 网格密度配置 - 紧凑高效风格
const GRID_DENSITY_CONFIG: Record<GridDensity, { minWidth: string; gap: string; padding: string; iconSize: number }> = {
  compact: { minWidth: '100px', gap: '10px', padding: '10px', iconSize: 40 },
  comfortable: { minWidth: '130px', gap: '12px', padding: '12px', iconSize: 48 },
  spacious: { minWidth: '160px', gap: '14px', padding: '14px', iconSize: 56 }
}

// LocalStorage 键
const STORAGE_KEY_GRID_DENSITY = 'liuliu-grid-density'

export const useFileStore = defineStore('file', () => {
  const router = useRouter()

  // State
  const files = ref<FileItem[]>([])
  const currentPath = ref<string>(ROOT_PATH)
  const isLoadingFiles = ref<boolean>(false)
  const filesError = ref<string | null>(null)
  const selectedFile = ref<FileItem | null>(null)
  const isOnline = ref<boolean>(navigator.onLine)
  const cacheTime = ref<string | null>(null)
  const isNavigating = ref<boolean>(false)
  const isCreatingFolder = ref<boolean>(false) // 防止快速点击重复导航
  const selectedFiles = ref<FileItem[]>([]) // 多选文件列表
  const lastClickedIndex = ref<number>(-1) // 最后点击的文件索引，用于范围选择
  const viewMode = ref<'list' | 'grid'>('list') // 视图模式
  const gridDensity = ref<GridDensity>('comfortable') // 网格密度

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

  const isAllSelected = computed(() => {
    return files.value.length > 0 && selectedFiles.value.length === files.value.length
  })

  const isPartialSelected = computed(() => {
    return selectedFiles.value.length > 0 && selectedFiles.value.length < files.value.length
  })

  // 网格密度相关计算属性
  const gridMinWidth = computed(() => GRID_DENSITY_CONFIG[gridDensity.value].minWidth)
  const gridGap = computed(() => GRID_DENSITY_CONFIG[gridDensity.value].gap)
  const gridPadding = computed(() => GRID_DENSITY_CONFIG[gridDensity.value].padding)
  const gridIconSize = computed(() => GRID_DENSITY_CONFIG[gridDensity.value].iconSize)
  // 行间距是列间距的 1.5 倍，让上下行之间更明显
  const gridRowGap = computed(() => {
    const gapValue = parseInt(GRID_DENSITY_CONFIG[gridDensity.value].gap)
    return `${Math.round(gapValue * 1.5)}px`
  })

  // Actions
  async function fetchFiles(path: string = '/') {
    // 防止重复请求
    if (isNavigating.value) {
      return
    }

    isNavigating.value = true
    isLoadingFiles.value = true
    filesError.value = null
    cacheTime.value = null
    clearSelection() // 切换目录时清空选中状态

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
        // 检测 401 认证错误（token 失效），自动跳转登录页
        if ((result as any).code === 'AUTH_REQUIRED') {
          await window.electronAPI.auth.logout()
          router.push('/login')
          return
        }
        // 检测 403 权限错误，跳转登录页
        if (result.error?.includes('403') || result.error?.includes('permission')) {
          await window.electronAPI.auth.logout()
          router.push('/login')
          return
        }
        filesError.value = result.error || '获取文件列表失败'
      }
    } catch (error) {
      console.error('获取文件列表失败:', error)
      filesError.value = '网络错误，请稍后重试'
    } finally {
      isLoadingFiles.value = false
      isNavigating.value = false
    }
  }

  // 面包屑导航数据
  const breadcrumbs = computed(() => {
    const parts = currentPath.value.split(PATH_SEPARATOR).filter(Boolean)
    const result = [{ path: ROOT_PATH, label: ROOT_LABEL }]
    let accPath = ''
    for (const part of parts) {
      accPath += PATH_SEPARATOR + part
      result.push({ path: accPath, label: part })
    }
    return result
  })

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

  // 多选相关 actions
  function toggleSelect(file: FileItem) {
    const index = selectedFiles.value.findIndex(f => f.name === file.name)
    if (index >= 0) {
      selectedFiles.value.splice(index, 1)
    } else {
      selectedFiles.value.push(file)
    }
  }

  function selectRange(startIndex: number, endIndex: number) {
    const start = Math.min(startIndex, endIndex)
    const end = Math.max(startIndex, endIndex)

    // 使用 Set 优化去重性能
    const selectedNames = new Set(selectedFiles.value.map(f => f.name))
    const filesToSelect = files.value.slice(start, end + 1)

    filesToSelect.forEach(file => {
      if (!selectedNames.has(file.name)) {
        selectedFiles.value.push(file)
      }
    })
  }

  function clearSelection() {
    selectedFiles.value = []
    lastClickedIndex.value = -1
  }

  function isSelected(file: FileItem): boolean {
    return selectedFiles.value.some(f => f.name === file.name)
  }

  function selectAll() {
    selectedFiles.value = [...sortedFiles.value]
  }

  function deselectAll() {
    clearSelection()
  }

  function invertSelection() {
    const currentSelected = new Set(selectedFiles.value.map(f => f.name))
    selectedFiles.value = files.value.filter(f => !currentSelected.has(f.name))
  }

  // 切换视图模式
  function setViewMode(mode: 'list' | 'grid') {
    viewMode.value = mode
  }

  // 设置网格密度
  function setGridDensity(density: GridDensity) {
    gridDensity.value = density
    // 持久化到 localStorage
    try {
      localStorage.setItem(STORAGE_KEY_GRID_DENSITY, density)
    } catch (error) {
      console.warn('无法保存网格密度偏好:', error)
    }
  }

  // 从 localStorage 加载网格密度偏好
  function loadGridDensityPreference() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_GRID_DENSITY)
      if (saved && ['compact', 'comfortable', 'spacious'].includes(saved)) {
        gridDensity.value = saved as GridDensity
      }
    } catch (error) {
      console.warn('无法加载网格密度偏好:', error)
    }
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
    breadcrumbs,
    isNavigating,
    isCreatingFolder,
    selectedFiles,
    lastClickedIndex,
    isAllSelected,
    isPartialSelected,
    viewMode,
    gridDensity,
    gridMinWidth,
    gridGap,
    gridRowGap,
    gridPadding,
    gridIconSize,
    fetchFiles,
    navigateTo,
    enterFolder,
    goUp,
    refresh,
    selectFile,
    createFolder,
    toggleSelect,
    selectRange,
    clearSelection,
    isSelected,
    selectAll,
    deselectAll,
    invertSelection,
    setViewMode,
    setGridDensity,
    loadGridDensityPreference
  }
})

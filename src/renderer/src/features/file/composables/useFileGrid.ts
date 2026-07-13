// src/renderer/src/features/file/composables/useFileGrid.ts
// 文件网格视图相关逻辑：排序、视图模式、网格密度

import { ref, computed, type ComputedRef } from 'vue'
import type { FileItem } from '../../../../../shared/types/electron'

// 网格密度类型
export type GridDensity = 'compact' | 'comfortable' | 'spacious'
export type SortField = 'name' | 'modified'
export type SortDirection = 'asc' | 'desc'

// 常量
const PATH_SEPARATOR = '/'
const ROOT_PATH = '/'
const ROOT_LABEL = '根目录'

// 网格密度配置 - 紧凑高效风格
const GRID_DENSITY_CONFIG: Record<GridDensity, { minWidth: string; gap: string; padding: string; iconSize: number }> = {
  compact: { minWidth: '100px', gap: '10px', padding: '10px', iconSize: 40 },
  comfortable: { minWidth: '130px', gap: '12px', padding: '12px', iconSize: 48 },
  spacious: { minWidth: '160px', gap: '14px', padding: '14px', iconSize: 56 }
}

// LocalStorage 键
const STORAGE_KEY_GRID_DENSITY = 'liuliu-grid-density'

export interface UseFileGridOptions {
  files: ComputedRef<FileItem[]>
  currentPath: ComputedRef<string> | { value: string }
}

export function useFileGrid(options: UseFileGridOptions) {
  const { files, currentPath } = options

  // State
  const viewMode = ref<'list' | 'grid'>('list')
  const searchKeyword = ref('')
  const gridDensity = ref<GridDensity>('comfortable')
  const sortField = ref<SortField | null>(null)
  const sortDirection = ref<SortDirection>('asc')

  const nameCollator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' })

  function compareByName(a: FileItem, b: FileItem): number {
    return nameCollator.compare(a.name, b.name)
  }

  function getModifiedTime(file: FileItem): number {
    const time = Date.parse(file.modified)
    return Number.isNaN(time) ? 0 : time
  }

  const sortedFiles = computed(() => {
    const activeSortField = sortField.value ?? 'name'
    const direction = sortDirection.value === 'asc' ? 1 : -1

    return [...files.value].sort((a, b) => {
      if (a.isDir && !b.isDir) return -1
      if (!a.isDir && b.isDir) return 1

      let result = 0
      if (activeSortField === 'modified') {
        result = getModifiedTime(a) - getModifiedTime(b)
      } else {
        result = compareByName(a, b)
      }

      if (result === 0) {
        return compareByName(a, b)
      }

      return result * direction
    })
  })

  const filteredFiles = computed(() => {
    const kw = searchKeyword.value.trim().toLowerCase()
    if (!kw) return sortedFiles.value
    return sortedFiles.value.filter(f => f.name.toLowerCase().includes(kw))
  })

  // 面包屑导航数据
  const breadcrumbs = computed(() => {
    const pathValue = 'value' in currentPath ? currentPath.value : currentPath
    const parts = pathValue.split(PATH_SEPARATOR).filter(Boolean)
    const result = [{ path: ROOT_PATH, label: ROOT_LABEL }]
    let accPath = ''
    for (const part of parts) {
      accPath += PATH_SEPARATOR + part
      result.push({ path: accPath, label: part })
    }
    return result
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

  function toggleSort(field: SortField) {
    if (sortField.value === field) {
      sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortField.value = field
      sortDirection.value = 'asc'
    }
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
    // State
    viewMode,
    searchKeyword,
    gridDensity,
    sortField,
    sortDirection,
    // Getters
    sortedFiles,
    filteredFiles,
    breadcrumbs,
    gridMinWidth,
    gridGap,
    gridPadding,
    gridIconSize,
    gridRowGap,
    // Constants (for external use if needed)
    GRID_DENSITY_CONFIG,
    STORAGE_KEY_GRID_DENSITY,
    // Actions
    toggleSort,
    setViewMode,
    setGridDensity,
    loadGridDensityPreference
  }
}

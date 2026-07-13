import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useFileNavigation } from '../composables/useFileNavigation'
import { useFileSelection } from '../composables/useFileSelection'
import { useFileGrid } from '../composables/useFileGrid'

// 导出类型定义
export type { GridDensity, SortField, SortDirection } from '../composables/useFileGrid'
export type { FileItem } from '../../../../../shared/types/electron'

export const useFileStore = defineStore('file', () => {
  // 1. 导航相关状态和逻辑
  const navigation = useFileNavigation()

  // 2. 网格/排序/过滤相关状态和逻辑
  const grid = useFileGrid({
    files: computed(() => navigation.files.value),
    currentPath: navigation.currentPath
  })

  // 3. 选择相关状态和逻辑（依赖 filteredFiles）
  const selection = useFileSelection({
    files: grid.filteredFiles
  })

  // 组合所有状态和 actions，保持与原 store 完全相同的 API
  return {
    // === 来自 useFileNavigation ===
    files: navigation.files,
    currentPath: navigation.currentPath,
    isLoadingFiles: navigation.isLoadingFiles,
    filesError: navigation.filesError,
    selectedFile: navigation.selectedFile,
    isOnline: navigation.isOnline,
    cacheTime: navigation.cacheTime,
    isNavigating: navigation.isNavigating,
    isCreatingFolder: navigation.isCreatingFolder,
    fetchFiles: navigation.fetchFiles,
    navigateTo: navigation.navigateTo,
    enterFolder: navigation.enterFolder,
    goUp: navigation.goUp,
    refresh: navigation.refresh,
    selectFile: navigation.selectFile,
    createFolder: navigation.createFolder,

    // === 来自 useFileGrid ===
    sortedFiles: grid.sortedFiles,
    filteredFiles: grid.filteredFiles,
    searchKeyword: grid.searchKeyword,
    breadcrumbs: grid.breadcrumbs,
    viewMode: grid.viewMode,
    gridDensity: grid.gridDensity,
    sortField: grid.sortField,
    sortDirection: grid.sortDirection,
    gridMinWidth: grid.gridMinWidth,
    gridGap: grid.gridGap,
    gridPadding: grid.gridPadding,
    gridIconSize: grid.gridIconSize,
    gridRowGap: grid.gridRowGap,
    toggleSort: grid.toggleSort,
    setViewMode: grid.setViewMode,
    setGridDensity: grid.setGridDensity,
    loadGridDensityPreference: grid.loadGridDensityPreference,

    // === 来自 useFileSelection ===
    selectedFiles: selection.selectedFiles,
    lastClickedIndex: selection.lastClickedIndex,
    isAllSelected: selection.isAllSelected,
    isPartialSelected: selection.isPartialSelected,
    toggleSelect: selection.toggleSelect,
    selectRange: selection.selectRange,
    clearSelection: selection.clearSelection,
    isSelected: selection.isSelected,
    selectAll: selection.selectAll,
    deselectAll: selection.deselectAll,
    invertSelection: selection.invertSelection
  }
})

// src/renderer/src/features/file/composables/useFileSelection.ts
// 文件选择相关逻辑：多选、反选、范围选择

import { ref, computed, type ComputedRef } from 'vue'
import type { FileItem } from '../../../../../shared/types/electron'

export interface UseFileSelectionOptions {
  files: ComputedRef<FileItem[]>
}

export function useFileSelection(options: UseFileSelectionOptions) {
  const { files: filteredFiles } = options

  // State
  const selectedFiles = ref<FileItem[]>([])
  const lastClickedIndex = ref<number>(-1)

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
    const filesToSelect = filteredFiles.value.slice(start, end + 1)

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
    selectedFiles.value = [...filteredFiles.value]
  }

  function deselectAll() {
    clearSelection()
  }

  function invertSelection() {
    const currentSelected = new Set(selectedFiles.value.map(f => f.name))
    // 注意：反选是基于全部文件，而非过滤后的文件
    // 这里保持与原 store 一致的行为
    selectedFiles.value = selectedFiles.value.filter(f => !currentSelected.has(f.name))
  }

  const isAllSelected = computed(() => {
    return filteredFiles.value.length > 0 && selectedFiles.value.length === filteredFiles.value.length
  })

  const isPartialSelected = computed(() => {
    return selectedFiles.value.length > 0 && selectedFiles.value.length < filteredFiles.value.length
  })

  return {
    // State
    selectedFiles,
    lastClickedIndex,
    // Getters
    isAllSelected,
    isPartialSelected,
    // Actions
    toggleSelect,
    selectRange,
    clearSelection,
    isSelected,
    selectAll,
    deselectAll,
    invertSelection
  }
}

// src/renderer/src/features/file/stores/fileStore.ts

import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { FileItem } from '../../../../../shared/types/file'

export const useFileStore = defineStore('file', () => {
  const currentPath = ref('/')
  const fileList = ref<FileItem[]>([])
  const isLoading = ref(false)

  function setFileList(files: FileItem[]) {
    fileList.value = files
  }

  function setCurrentPath(path: string) {
    currentPath.value = path
  }

  function setLoading(loading: boolean) {
    isLoading.value = loading
  }

  return {
    currentPath,
    fileList,
    isLoading,
    setFileList,
    setCurrentPath,
    setLoading
  }
})

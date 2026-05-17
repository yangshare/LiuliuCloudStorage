// src/renderer/src/features/file/composables/useFile.ts

import { ref } from 'vue'
import { useFileStore } from '@/features/file'
import { fileRendererService } from '../file.renderer.service'
import { useNotification } from '../../../core/composables/useNotification'
import type { FileItem } from '../../../../../shared/types/file'

export function useFile() {
  const store = useFileStore()
  const { showSuccess, showError } = useNotification()
  const isOperating = ref(false)

  /**
   * 加载文件列表
   */
  async function loadFiles(path: string) {
    store.setLoading(true)
    try {
      const result = await fileRendererService.list(path)
      if (result.success && result.data) {
        store.setFileList(result.data.content)
        store.setCurrentPath(path)
      } else {
        showError('加载失败', result.error || '获取文件列表失败')
      }
    } catch (error) {
      showError('加载失败', '网络错误，请稍后重试')
    } finally {
      store.setLoading(false)
    }
  }

  /**
   * 创建目录
   */
  async function mkdir(path: string) {
    isOperating.value = true
    try {
      const result = await fileRendererService.mkdir(path)
      if (result.success) {
        showSuccess('操作成功', '文件夹创建成功')
        return true
      } else {
        showError('创建失败', result.error || '创建文件夹失败')
        return false
      }
    } catch (error) {
      showError('创建失败', '网络错误，请稍后重试')
      return false
    } finally {
      isOperating.value = false
    }
  }

  /**
   * 删除文件/目录
   */
  async function deleteFile(dir: string, fileName: string) {
    isOperating.value = true
    try {
      const result = await fileRendererService.deleteFile(dir, fileName)
      if (result.success) {
        showSuccess('操作成功', '删除成功')
        return true
      } else {
        showError('删除失败', result.error || '删除文件失败')
        return false
      }
    } catch (error) {
      showError('删除失败', '网络错误，请稍后重试')
      return false
    } finally {
      isOperating.value = false
    }
  }

  /**
   * 批量删除
   */
  async function batchDelete(dir: string, fileNames: string[]) {
    isOperating.value = true
    try {
      const result = await fileRendererService.batchDelete(dir, fileNames)
      if (result.success) {
        showSuccess('操作成功', `成功删除 ${fileNames.length} 个文件`)
        return true
      } else {
        showError('删除失败', result.error || '批量删除失败')
        return false
      }
    } catch (error) {
      showError('删除失败', '网络错误，请稍后重试')
      return false
    } finally {
      isOperating.value = false
    }
  }

  /**
   * 重命名
   */
  async function rename(path: string, newName: string) {
    isOperating.value = true
    try {
      const result = await fileRendererService.rename(path, newName)
      if (result.success) {
        showSuccess('操作成功', '重命名成功')
        return true
      } else {
        showError('重命名失败', result.error || '重命名失败')
        return false
      }
    } catch (error) {
      showError('重命名失败', '网络错误，请稍后重试')
      return false
    } finally {
      isOperating.value = false
    }
  }

  /**
   * 获取目录下所有文件（递归子目录）
   */
  async function getAllFilesInDirectory(remotePath: string) {
    store.setLoading(true)
    try {
      const result = await fileRendererService.getAllFilesInDirectory(remotePath)
      if (result.success && result.data) {
        return result.data
      } else {
        showError('获取失败', result.error || '获取目录文件失败')
        return []
      }
    } catch (error) {
      showError('获取失败', '网络错误，请稍后重试')
      return []
    } finally {
      store.setLoading(false)
    }
  }

  return {
    // 状态
    currentPath: store.currentPath,
    fileList: store.fileList,
    isLoading: store.isLoading,
    isOperating,

    // 方法
    loadFiles,
    mkdir,
    deleteFile,
    batchDelete,
    rename,
    getAllFilesInDirectory
  }
}

/**
 * 文件系统 Composable
 * 封装文件浏览和操作逻辑
 */

import { ref } from 'vue';
import { useFileStore } from '../stores/fileStore';
import { IFileItem } from '@shared/types/filesystem.types';

export function useFileSystem() {
  const fileStore = useFileStore();

  // 加载状态
  const loading = ref(false);
  const error = ref<string | null>(null);

  /**
   * 加载文件列表
   */
  const loadFileList = async (path: string, forceRefresh = false): Promise<void> => {
    loading.value = true;
    error.value = null;

    try {
      // 检查缓存
      if (!forceRefresh) {
        const cached = fileStore.getCachedFileList(path);
        if (cached) {
          fileStore.setPath(path);
          fileStore.setFileList(cached);
          loading.value = false;
          return;
        }
      }

      // 调用 API 加载文件列表
      const response = await window.electronAPI.fs.list(path);

      if (response.code === 200) {
        fileStore.setPath(path);
        fileStore.setFileList(response.data.content || []);
      } else {
        throw new Error(response.message || '加载文件列表失败');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载文件列表失败';
      error.value = errorMessage;
      fileStore.setError(errorMessage);
    } finally {
      loading.value = false;
    }
  };

  /**
   * 刷新文件列表
   */
  const refresh = async (): Promise<void> => {
    await loadFileList(fileStore.currentPath, true);
  };

  /**
   * 导航到路径
   */
  const navigateTo = async (path: string): Promise<void> => {
    await loadFileList(path);
  };

  /**
   * 导航到上级目录
   */
  const navigateUp = async (): Promise<void> => {
    const currentPath = fileStore.currentPath;
    if (currentPath === '/') return;

    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const newPath = parts.length > 0 ? `/${parts.join('/')}` : '/';

    await navigateTo(newPath);
  };

  /**
   * 导航到根目录
   */
  const navigateToRoot = async (): Promise<void> => {
    await navigateTo('/');
  };

  /**
   * 创建目录
   */
  const createDirectory = async (path: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const response = await window.electronAPI.fs.mkdir(path);

      if (response.code === 200) {
        // 刷新文件列表
        await refresh();
        return { success: true, message: '文件夹创建成功' };
      } else {
        return { success: false, message: response.message || '创建文件夹失败' };
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '创建文件夹失败';
      return { success: false, message: errorMessage };
    }
  };

  /**
   * 重命名文件
   */
  const renameFile = async (path: string, newName: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const response = await window.electronAPI.fs.rename(path, newName);

      if (response.code === 200) {
        // 刷新文件列表
        await refresh();
        return { success: true, message: '重命名成功' };
      } else {
        return { success: false, message: response.message || '重命名失败' };
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '重命名失败';
      return { success: false, message: errorMessage };
    }
  };

  /**
   * 删除文件
   */
  const deleteFile = async (path: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const response = await window.electronAPI.fs.delete(path);

      if (response.code === 200) {
        // 刷新文件列表
        await refresh();
        return { success: true, message: '删除成功' };
      } else {
        return { success: false, message: response.message || '删除失败' };
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '删除失败';
      return { success: false, message: errorMessage };
    }
  };

  /**
   * 批量删除文件
   */
  const deleteMultipleFiles = async (files: IFileItem[]): Promise<{ success: boolean; message?: string; count?: number }> => {
    let successCount = 0;
    const errors: string[] = [];

    for (const file of files) {
      const result = await deleteFile(file.path || '/');
      if (result.success) {
        successCount++;
      } else {
        errors.push(`${file.name}: ${result.message}`);
      }
    }

    if (successCount === files.length) {
      return { success: true, message: `成功删除 ${successCount} 个文件`, count: successCount };
    } else {
      return {
        success: false,
        message: `删除完成：成功 ${successCount} 个，失败 ${errors.length} 个`,
        count: successCount
      };
    }
  };

  /**
   * 获取文件图标
   */
  const getFileIcon = (file: IFileItem): string => {
    if (file.is_dir) {
      return 'folder';
    }

    // 根据文件扩展名返回图标
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    const iconMap: Record<string, string> = {
      // 图片
      'jpg': 'picture',
      'jpeg': 'picture',
      'png': 'picture',
      'gif': 'picture',
      'bmp': 'picture',
      'svg': 'picture',
      'webp': 'picture',
      // 视频
      'mp4': 'video-camera',
      'avi': 'video-camera',
      'mkv': 'video-camera',
      'mov': 'video-camera',
      'wmv': 'video-camera',
      // 音频
      'mp3': 'headset',
      'wav': 'headset',
      'flac': 'headset',
      // 文档
      'pdf': 'document',
      'doc': 'document',
      'docx': 'document',
      'xls': 'excel',
      'xlsx': 'excel',
      'ppt': 'ppt',
      'pptx': 'ppt',
      'txt': 'document',
      // 压缩包
      'zip': 'folder-open',
      'rar': 'folder-open',
      '7z': 'folder-open',
      'tar': 'folder-open',
      'gz': 'folder-open'
    };

    return iconMap[ext] || 'document';
  };

  /**
   * 格式化文件大小
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  /**
   * 格式化修改时间
   */
  const formatModifiedTime = (time: string): string => {
    const date = new Date(time);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // 小于 1 小时显示 "刚刚"
    if (diff < 60 * 60 * 1000) {
      const minutes = Math.floor(diff / (60 * 1000));
      return `${minutes} 分钟前`;
    }

    // 小于 24 小时显示 "X 小时前"
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      return `${hours} 小时前`;
    }

    // 小于 7 天显示 "X 天前"
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      return `${days} 天前`;
    }

    // 否则显示完整日期
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  /**
   * 清除错误
   */
  const clearError = (): void => {
    error.value = null;
    fileStore.setError(null);
  };

  return {
    // 状态
    loading: loading as { value: boolean },
    error: error as { value: string | null },
    // 计算属性（从 store）
    currentPath: fileStore.currentPath,
    fileList: fileStore.fileList,
    selectedFiles: fileStore.selectedFiles,
    viewMode: fileStore.viewMode,
    breadcrumbs: fileStore.breadcrumbs,
    isEmpty: fileStore.isEmpty,
    hasSelection: fileStore.hasSelection,
    selectionCount: fileStore.selectionCount,
    // 方法
    loadFileList,
    refresh,
    navigateTo,
    navigateUp,
    navigateToRoot,
    createDirectory,
    renameFile,
    deleteFile,
    deleteMultipleFiles,
    getFileIcon,
    formatFileSize,
    formatModifiedTime,
    clearError
  };
}

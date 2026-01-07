/**
 * 文件状态管理
 * 使用 Pinia 管理文件浏览相关状态
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { IFileItem, IBreadcrumbItem, IViewMode, ISortField, ISortOrder } from '@shared/types/filesystem.types';

export const useFileStore = defineStore('file', () => {
  // 状态
  const currentPath = ref<string>('/');
  const fileList = ref<IFileItem[]>([]);
  const selectedFiles = ref<IFileItem[]>([]);
  const viewMode = ref<IViewMode>('list');
  const breadcrumbs = ref<IBreadcrumbItem[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // 缓存（简单的 LRU 缓存）
  const cache = new Map<string, IFileItem[]>();
  const maxCacheSize = 50;

  // 排序状态
  const sortField = ref<ISortField>('name');
  const sortOrder = ref<ISortOrder>('asc');

  // 计算属性
  const isEmpty = computed(() => fileList.value.length === 0);
  const hasSelection = computed(() => selectedFiles.value.length > 0);
  const selectionCount = computed(() => selectedFiles.value.length);

  /**
   * 设置当前路径
   */
  function setPath(path: string): void {
    currentPath.value = path;
    updateBreadcrumbs(path);
  }

  /**
   * 设置文件列表
   */
  function setFileList(list: IFileItem[]): void {
    // 应用排序
    const sorted = sortFiles(list);
    fileList.value = sorted;

    // 缓存结果
    cache.set(currentPath.value, sorted);

    // 限制缓存大小
    if (cache.size > maxCacheSize) {
      const firstKey = cache.keys().next().value;
      if (firstKey) cache.delete(firstKey);
    }
  }

  /**
   * 从缓存获取文件列表
   */
  function getCachedFileList(path: string): IFileItem[] | null {
    return cache.get(path) || null;
  }

  /**
   * 清空文件列表
   */
  function clearFileList(): void {
    fileList.value = [];
  }

  /**
   * 设置加载状态
   */
  function setLoading(value: boolean): void {
    loading.value = value;
  }

  /**
   * 设置错误
   */
  function setError(message: string | null): void {
    error.value = message;
  }

  /**
   * 更新面包屑导航
   */
  function updateBreadcrumbs(path: string): void {
    const crumbs: IBreadcrumbItem[] = [
      { label: '首页', path: '/' }
    ];

    if (path !== '/') {
      const parts = path.split('/').filter(Boolean);
      let currentPathBuilder = '';

      parts.forEach((part) => {
        currentPathBuilder += `/${part}`;
        crumbs.push({
          label: part,
          path: currentPathBuilder
        });
      });
    }

    breadcrumbs.value = crumbs;
  }

  /**
   * 选择文件
   */
  function selectFile(file: IFileItem): void {
    const exists = selectedFiles.value.some(f => f.path === file.path);
    if (!exists) {
      selectedFiles.value.push(file);
    }
  }

  /**
   * 取消选择文件
   */
  function deselectFile(file: IFileItem): void {
    selectedFiles.value = selectedFiles.value.filter(f => f.path !== file.path);
  }

  /**
   * 切换文件选择状态
   */
  function toggleSelection(file: IFileItem): void {
    const exists = selectedFiles.value.some(f => f.path === file.path);
    if (exists) {
      deselectFile(file);
    } else {
      selectFile(file);
    }
  }

  /**
   * 全选
   */
  function selectAll(): void {
    selectedFiles.value = [...fileList.value];
  }

  /**
   * 清空选择
   */
  function clearSelection(): void {
    selectedFiles.value = [];
  }

  /**
   * 设置视图模式
   */
  function setViewMode(mode: IViewMode): void {
    viewMode.value = mode;
  }

  /**
   * 切换视图模式
   */
  function toggleViewMode(): void {
    viewMode.value = viewMode.value === 'list' ? 'grid' : 'list';
  }

  /**
   * 设置排序
   */
  function setSort(field: ISortField, order: ISortOrder): void {
    sortField.value = field;
    sortOrder.value = order;
    // 重新排序当前列表
    fileList.value = sortFiles(fileList.value);
  }

  /**
   * 排序文件列表
   */
  function sortFiles(files: IFileItem[]): IFileItem[] {
    const sorted = [...files];

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (sortField.value) {
        case 'name':
          comparison = a.name.localeCompare(b.name, 'zh-CN');
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'modified':
          comparison = new Date(a.modified).getTime() - new Date(b.modified).getTime();
          break;
        default:
          return 0;
      }

      return sortOrder.value === 'asc' ? comparison : -comparison;
    });

    // 文件夹始终排在前面
    return sorted.sort((a, b) => {
      if (a.is_dir && !b.is_dir) return -1;
      if (!a.is_dir && b.is_dir) return 1;
      return 0;
    });
  }

  /**
   * 搜索文件
   */
  function searchFiles(keyword: string): IFileItem[] {
    if (!keyword.trim()) {
      return fileList.value;
    }

    const lowerKeyword = keyword.toLowerCase();
    return fileList.value.filter(file =>
      file.name.toLowerCase().includes(lowerKeyword)
    );
  }

  /**
   * 刷新缓存
   */
  function refreshCache(path?: string): void {
    if (path) {
      cache.delete(path);
    } else {
      cache.clear();
    }
  }

  return {
    // 状态
    currentPath,
    fileList,
    selectedFiles,
    viewMode,
    breadcrumbs,
    loading,
    error,
    sortField,
    sortOrder,
    // 计算属性
    isEmpty,
    hasSelection,
    selectionCount,
    // 方法
    setPath,
    setFileList,
    getCachedFileList,
    clearFileList,
    setLoading,
    setError,
    updateBreadcrumbs,
    selectFile,
    deselectFile,
    toggleSelection,
    selectAll,
    clearSelection,
    setViewMode,
    toggleViewMode,
    setSort,
    searchFiles,
    refreshCache
  };
});

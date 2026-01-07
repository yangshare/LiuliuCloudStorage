/**
 * 虚拟路径管理 Composable
 * 提供路径转换和管理功能
 */

import { ref, computed } from 'vue';
import { PathTransform } from '@shared/utils/pathTransform';

export function useVirtualPath() {
  // 当前虚拟路径
  const currentPath = ref('/');
  // 面包屑导航
  const breadcrumbs = ref<Array<{ label: string; path: string }>>([]);

  /**
   * 设置当前路径
   */
  const setPath = (path: string): void => {
    currentPath.value = path;
    updateBreadcrumbs(path);
  };

  /**
   * 导航到子目录
   */
  const navigateTo = (relativePath: string): void => {
    const newPath = PathTransform.joinPath(currentPath.value, relativePath);
    setPath(newPath);
  };

  /**
   * 导航到上级目录
   */
  const navigateUp = (): void => {
    if (currentPath.value === '/') {
      return;
    }

    const parts = currentPath.value.split('/').filter(Boolean);
    parts.pop();
    const newPath = parts.length > 0 ? `/${parts.join('/')}` : '/';
    setPath(newPath);
  };

  /**
   * 导航到根目录
   */
  const navigateToRoot = (): void => {
    setPath('/');
  };

  /**
   * 更新面包屑导航
   */
  const updateBreadcrumbs = (path: string): void => {
    const crumbs = [{ label: '首页', path: '/' }];

    if (path !== '/') {
      const parts = path.split('/').filter(Boolean);
      let currentPathBuilder = '';

      parts.forEach((part, index) => {
        currentPathBuilder += `/${part}`;
        crumbs.push({
          label: part,
          path: currentPathBuilder
        });
      });
    }

    breadcrumbs.value = crumbs;
  };

  /**
   * 验证路径安全性
   */
  const validatePath = (path: string): { valid: boolean; error?: string } => {
    try {
      // 检查路径穿越
      if (PathTransform.containsPathTraversal(path)) {
        return {
          valid: false,
          error: '路径包含非法字符'
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : '路径验证失败'
      };
    }
  };

  // 计算属性
  const isRoot = computed(() => currentPath.value === '/');

  return {
    // 状态
    currentPath,
    breadcrumbs,
    // 计算属性
    isRoot,
    // 方法
    setPath,
    navigateTo,
    navigateUp,
    navigateToRoot,
    validatePath
  };
}

/**
 * 面包屑导航组件
 * 显示当前路径并支持快速导航
 */

<template>
  <div class="breadcrumb-container">
    <el-breadcrumb separator="/">
      <el-breadcrumb-item
        v-for="item in breadcrumbs"
        :key="item.path"
        :to="{ path: '/files', query: { path: item.path } }"
        @click="handleNavigate(item.path)"
      >
        <el-icon v-if="item.path === '/'" class="breadcrumb-icon">
          <HomeFilled />
        </el-icon>
        <span>{{ item.label }}</span>
      </el-breadcrumb-item>
    </el-breadcrumb>

    <!-- 快速导航按钮 -->
    <div class="breadcrumb-actions">
      <el-button-group>
        <el-tooltip content="上级目录" placement="bottom">
          <el-button :disabled="currentPath === '/'" @click="handleNavigateUp" circle>
            <el-icon><Back /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="根目录" placement="bottom">
          <el-button @click="handleNavigateRoot" circle>
            <el-icon><HomeFilled /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="刷新" placement="bottom">
          <el-button @click="handleRefresh" circle :loading="loading">
            <el-icon><Refresh /></el-icon>
          </el-button>
        </el-tooltip>
      </el-button-group>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { HomeFilled, Back, Refresh } from '@element-plus/icons-vue';
import { useFileSystem } from '../composables/useFileSystem';

const router = useRouter();
const { currentPath, breadcrumbs, loading, navigateTo, navigateUp, navigateToRoot, refresh } = useFileSystem();

/**
 * 导航到指定路径
 */
const handleNavigate = async (path: string): Promise<void> => {
  if (path !== currentPath.value) {
    await navigateTo(path);
  }
};

/**
 * 导航到上级目录
 */
const handleNavigateUp = async (): Promise<void> => {
  await navigateUp();
};

/**
 * 导航到根目录
 */
const handleNavigateRoot = async (): Promise<void> => {
  await navigateToRoot();
};

/**
 * 刷新当前目录
 */
const handleRefresh = async (): Promise<void> => {
  await refresh();
};
</script>

<style scoped>
.breadcrumb-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #ffffff;
  border-bottom: 1px solid #e5e7eb;
}

.breadcrumb-icon {
  margin-right: 4px;
  vertical-align: middle;
}

.breadcrumb-actions {
  display: flex;
  gap: 8px;
}

:deep(.el-breadcrumb__item) {
  cursor: pointer;
}

:deep(.el-breadcrumb__item:hover .el-breadcrumb__inner) {
  color: #409eff;
}
</style>

<script setup lang="ts">
import { ElBreadcrumb, ElBreadcrumbItem } from 'element-plus'
import { useFileStore } from '../../stores/fileStore'

const fileStore = useFileStore()
</script>

<template>
  <el-breadcrumb class="netease-breadcrumb">
    <el-breadcrumb-item
      v-for="item in fileStore.breadcrumbs"
      :key="item.path"
      @click="fileStore.navigateTo(item.path)"
    >
      {{ item.label }}
    </el-breadcrumb-item>
  </el-breadcrumb>
</template>

<style scoped>
.netease-breadcrumb {
  font-size: 14px;
}

/* 面包屑样式 - 网易云风格 */
:deep(.el-breadcrumb__item) {
  font-size: 14px;
}

:deep(.el-breadcrumb__inner) {
  color: var(--netease-gray-6);
  font-weight: 500;
  transition: all 0.2s ease;
  cursor: pointer;
  border-radius: var(--radius-sm);
  padding: 4px 8px;
}

:deep(.el-breadcrumb__inner:hover) {
  color: var(--netease-red);
  background: var(--netease-red-pale);
}

:deep(.el-breadcrumb__item:last-child .el-breadcrumb__inner) {
  color: var(--netease-gray-7);
  font-weight: 600;
  cursor: default;
}

:deep(.el-breadcrumb__item:last-child .el-breadcrumb__inner:hover) {
  color: var(--netease-gray-7);
  background: transparent;
}

:deep(.el-breadcrumb__separator) {
  color: var(--netease-gray-4);
  margin: 0 8px;
}

:deep(.el-breadcrumb__item:last-child .el-breadcrumb__separator) {
  display: none;
}
</style>
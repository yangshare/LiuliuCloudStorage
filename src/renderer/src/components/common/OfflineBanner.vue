<script setup lang="ts">
import { ElAlert } from 'element-plus'
import { useFileStore } from '../../stores/fileStore'

const fileStore = useFileStore()
</script>

<template>
  <el-alert v-if="!fileStore.isOnline" type="warning" :closable="false" show-icon class="offline-banner">
    离线模式 - 显示缓存数据
    <template v-if="fileStore.cacheTime">（最后更新：{{ fileStore.cacheTime }}）</template>
  </el-alert>
</template>

<style scoped>
.offline-banner {
  margin-bottom: 12px;
  border-radius: var(--radius-md);
}

/* 离线横幅样式 - 网易云风格 */
:deep(.el-alert--warning) {
  background: rgba(250, 140, 22, 0.1) !important;
  border: 1px solid rgba(250, 140, 22, 0.2) !important;
  border-radius: var(--radius-md) !important;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

:deep(.el-alert__title) {
  color: #FA8C16 !important;
  font-weight: 500;
}

:deep(.el-alert__description) {
  color: var(--netease-gray-6) !important;
}

:deep(.el-alert__content) {
  color: var(--netease-gray-6);
}

:deep(.el-alert__icon) {
  color: #FA8C16 !important;
}
</style>

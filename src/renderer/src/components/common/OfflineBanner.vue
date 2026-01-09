<script setup lang="ts">
import { NAlert } from 'naive-ui'
import { useFileStore } from '../../stores/fileStore'

const fileStore = useFileStore()
</script>

<template>
  <n-alert v-if="!fileStore.isOnline" type="warning" :bordered="false" class="offline-banner">
    离线模式 - 显示缓存数据
    <template v-if="fileStore.cacheTime">（最后更新：{{ fileStore.cacheTime }}）</template>
  </n-alert>
</template>

<style scoped>
.offline-banner {
  margin-bottom: 8px;
}
</style>

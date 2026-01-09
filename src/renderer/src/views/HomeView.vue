<script setup lang="ts">
import { NButton, NCard } from 'naive-ui'
</script>

<template>
  <div class="home">
    <n-card title="溜溜网盘">
      <p>项目初始化成功 - Vue 3 + Electron + Naive UI</p>
      <n-button type="primary">开始使用</n-button>
    </n-card>
  </div>
</template>

<style scoped>
.home {
  padding: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}
</style>

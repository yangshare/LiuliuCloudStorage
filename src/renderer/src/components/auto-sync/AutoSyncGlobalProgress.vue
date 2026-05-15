<template>
  <Teleport to="body">
    <TransitionGroup
      name="sync-card"
      tag="div"
      class="sync-global-progress"
    >
      <AutoSyncProgressCard
        v-for="item in store.visibleItems"
        :key="item.planId"
        :item="item"
        @dismiss="store.dismiss"
      />
      <div
        v-if="store.hiddenCount > 0"
        key="hidden-count"
        class="hidden-count-badge"
        @click="store.dismissAll"
      >
        <span>+{{ store.hiddenCount }} 个计划正在同步</span>
        <el-icon :size="12"><Close /></el-icon>
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { Close } from '@element-plus/icons-vue'
import { ElIcon } from 'element-plus'
import { useAutoSyncGlobalStore } from '@/stores/autoSyncGlobalStore'
import AutoSyncProgressCard from './AutoSyncProgressCard.vue'

const store = useAutoSyncGlobalStore()
const { updateProgress } = store

onMounted(() => {
  window.electronAPI?.autoSync?.onProgress(updateProgress)
})

onUnmounted(() => {
  window.electronAPI?.autoSync?.removeProgressListener(updateProgress)
  store.clearAllTimers()
})
</script>

<style scoped>
.sync-global-progress {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  pointer-events: none;
}

.sync-global-progress > * {
  pointer-events: auto;
}

.hidden-count-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  font-size: 12px;
  color: var(--netease-gray-5);
  cursor: pointer;
  transition: all 0.2s ease;
  pointer-events: auto;
}

.hidden-count-badge:hover {
  background: rgba(255, 255, 255, 0.95);
  color: var(--netease-gray-6);
}

/* Transition animations */
.sync-card-enter-active,
.sync-card-leave-active {
  transition: all 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.sync-card-enter-from {
  opacity: 0;
  transform: translateX(40px) scale(0.96);
}

.sync-card-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.96);
}

.sync-card-leave-active {
  position: absolute;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .sync-global-progress {
    right: 12px;
    bottom: 12px;
    left: 12px;
    align-items: stretch;
  }

  .sync-global-progress :deep(.sync-progress-card) {
    width: 100%;
  }
}
</style>

<template>
  <span class="pulse-indicator" :class="status">
    <span class="pulse-dot" />
  </span>
</template>

<script setup lang="ts">
import type { SyncItemStatus } from '@/stores/autoSyncGlobalStore'

interface Props {
  status: SyncItemStatus
}
defineProps<Props>()
</script>

<style scoped>
.pulse-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--netease-red);
  position: relative;
}

.pulse-indicator.running .pulse-dot {
  animation: pulse-scale 1.5s ease-in-out infinite;
}

.pulse-indicator.running .pulse-dot::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 8px;
  height: 8px;
  margin-top: -4px;
  margin-left: -4px;
  border-radius: 50%;
  background: var(--netease-red);
  animation: pulse-ring 1.5s ease-out infinite;
  opacity: 0.6;
}

.pulse-indicator.completed .pulse-dot {
  background: var(--netease-green);
  width: 10px;
  height: 10px;
}

.pulse-indicator.completed .pulse-dot::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 3px;
  width: 4px;
  height: 7px;
  border: solid #fff;
  border-width: 0 1.5px 1.5px 0;
  transform: rotate(45deg);
}

.pulse-indicator.failed .pulse-dot {
  background: var(--netease-red);
  width: 10px;
  height: 10px;
}

.pulse-indicator.failed .pulse-dot::after {
  content: '';
  position: absolute;
  top: 4px;
  left: 2px;
  width: 6px;
  height: 1.5px;
  background: #fff;
  transform: rotate(0deg);
}

@keyframes pulse-scale {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}

@keyframes pulse-ring {
  0% { transform: scale(1); opacity: 0.6; }
  100% { transform: scale(2.5); opacity: 0; }
}
</style>

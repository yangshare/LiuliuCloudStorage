<template>
  <div
    class="sync-progress-card"
    :class="[item.status, { clickable: item.status !== 'running' }]"
    @click="handleClick"
  >
    <div class="card-header">
      <div class="header-left">
        <AutoSyncPulseIndicator :status="item.status" />
        <span class="plan-name" :title="item.planName">{{ item.planName }}</span>
      </div>
      <button class="close-btn" @click.stop="handleDismiss" title="关闭">
        <el-icon :size="14"><Close /></el-icon>
      </button>
    </div>

    <div class="card-footer">
      <span class="stage-text">{{ stageDisplayText }}</span>
      <span v-if="item.status === 'completed' && item.queuedCount !== undefined" class="queued-badge">
        +{{ item.queuedCount }} 个下载
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Close } from '@element-plus/icons-vue'
import { ElIcon } from 'element-plus'
import AutoSyncPulseIndicator from './AutoSyncPulseIndicator.vue'
import { useAutoSyncGlobalStore } from '@/stores/autoSyncGlobalStore'
import type { AutoSyncGlobalItem } from '@/stores/autoSyncGlobalStore'

interface Props {
  item: AutoSyncGlobalItem
}

const props = defineProps<Props>()
const emit = defineEmits<{ dismiss: [planId: number] }>()

const router = useRouter()
const store = useAutoSyncGlobalStore()

const MAX_ERROR_MSG_LEN = 24

const stageDisplayText = computed(() => {
  if (props.item.stage === 'complete') {
    return props.item.status === 'failed' ? '同步失败' : '同步完成'
  }
  if (props.item.message) {
    return props.item.message.length > MAX_ERROR_MSG_LEN
      ? props.item.message.slice(0, MAX_ERROR_MSG_LEN) + '...'
      : props.item.message
  }
  const base = store.getStageText(props.item.stage)
  return base ? base + '...' : '同步中...'
})

function handleDismiss() {
  emit('dismiss', props.item.planId)
}

function handleClick() {
  if (props.item.status !== 'running') {
    router.push('/share-transfer')
    emit('dismiss', props.item.planId)
  }
}
</script>

<style scoped>
.sync-progress-card {
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: 12px 14px;
  width: 320px;
  transition: all 0.3s ease;
  cursor: default;
}

.sync-progress-card.clickable {
  cursor: pointer;
}

.sync-progress-card.clickable:hover {
  background: rgba(255, 255, 255, 0.95);
  transform: translateY(-1px);
  box-shadow: var(--shadow-xl);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.plan-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--netease-gray-7);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  color: var(--netease-gray-5);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.06);
  color: var(--netease-gray-7);
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 18px;
}

.stage-text {
  font-size: 12px;
  color: var(--netease-gray-5);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.queued-badge {
  font-size: 11px;
  font-weight: 500;
  color: var(--netease-green);
  background: rgba(46, 204, 113, 0.1);
  padding: 1px 6px;
  border-radius: 10px;
  flex-shrink: 0;
}
</style>

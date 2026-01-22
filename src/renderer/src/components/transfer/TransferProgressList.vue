<template>
  <div class="transfer-list" :class="{ collapsed: isCollapsed }">
    <div class="list-header" @click="toggleCollapse">
      <span>传输列表 ({{ activeCount }}/{{ totalCount }})</span>
      <el-icon :component="isCollapsed ? ChevronUpIcon : ChevronDownIcon" />
    </div>

    <div v-if="!isCollapsed" class="list-content">
      <TransferProgressItem
        v-for="task in uploadQueue"
        :key="task.id"
        :task="task"
        @resume="handleResume"
        @cancel="handleCancel"
      />
      <div v-if="uploadQueue.length === 0" class="empty-state">
        暂无传输任务
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElIcon } from 'element-plus'
import { ArrowUp as ChevronUpIcon, ArrowDown as ChevronDownIcon  } from '@element-plus/icons-vue'
import { useTransferStore } from '@/stores/transferStore'
import TransferProgressItem from './TransferProgressItem.vue'

const transferStore = useTransferStore()
const isCollapsed = ref(false)

const uploadQueue = computed(() => transferStore.uploadQueue)
const activeCount = computed(() => transferStore.activeUploads.length)
const totalCount = computed(() => uploadQueue.value.length)

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value
}

// 处理恢复上传事件
async function handleResume(taskId: string | number) {
  // TODO: 需要获取用户信息
  // 暂时跳过，因为需要从全局状态获取 userId, userToken, username
  console.log('Resume upload requested for task:', taskId)
}

// 处理取消上传事件
async function handleCancel(taskId: string | number) {
  try {
    const result = await window.electronAPI.transfer.cancel(
      typeof taskId === 'number' ? taskId : parseInt(taskId as string) || 0
    )
    if (!result.success) {
      console.error('Failed to cancel task:', result.error)
    }
  } catch (error) {
    console.error('Failed to cancel task:', error)
  }
}
</script>

<style scoped>
.transfer-list {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid rgba(194, 12, 12, 0.1);
  box-shadow: 0 -4px 16px rgba(194, 12, 12, 0.15);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  transition: all 0.3s ease;
}

.transfer-list.collapsed .list-content {
  display: none;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  cursor: pointer;
  user-select: none;
  background: linear-gradient(135deg, rgba(194, 12, 12, 0.05) 0%, rgba(236, 65, 65, 0.05) 100%);
  font-weight: 500;
  color: var(--netease-gray-7);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  transition: all 0.2s ease;
}

.list-header:hover {
  background: linear-gradient(135deg, rgba(194, 12, 12, 0.08) 0%, rgba(236, 65, 65, 0.08) 100%);
}

.list-header span {
  font-size: 15px;
  font-weight: 600;
}

.list-content {
  max-height: 300px;
  overflow-y: auto;
  padding: 8px;
}

/* 滚动条样式 */
.list-content::-webkit-scrollbar {
  width: 6px;
}

.list-content::-webkit-scrollbar-track {
  background: transparent;
}

.list-content::-webkit-scrollbar-thumb {
  background: rgba(194, 12, 12, 0.2);
  border-radius: 3px;
}

.list-content::-webkit-scrollbar-thumb:hover {
  background: rgba(194, 12, 12, 0.4);
}

.empty-state {
  padding: 32px 24px;
  text-align: center;
  color: var(--netease-gray-5);
  font-size: 14px;
  background: rgba(245, 245, 245, 0.3);
  border-radius: var(--radius-md);
  margin: 8px;
}
</style>

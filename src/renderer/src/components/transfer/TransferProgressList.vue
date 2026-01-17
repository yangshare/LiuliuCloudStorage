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
  background: white;
  border-top: 1px solid #e0e0e0;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.transfer-list.collapsed .list-content {
  display: none;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  user-select: none;
  background: #fafafa;
  font-weight: 500;
  color: #333;
}

.list-header:hover {
  background: #f5f5f5;
}

.list-content {
  max-height: 300px;
  overflow-y: auto;
}

.empty-state {
  padding: 24px;
  text-align: center;
  color: #999;
  font-size: 14px;
}
</style>

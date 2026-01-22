<script setup lang="ts">
import { ElDialog, ElAlert, ElButton } from 'element-plus'
import type { FileItem } from '../../../../shared/types/electron'

interface Props {
  visible: boolean
  file: FileItem | null
  loading?: boolean
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'confirm'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

function handleConfirm() {
  emit('confirm')
}

function handleCancel() {
  emit('update:visible', false)
}

function handleClose() {
  if (!props.loading) {
    emit('update:visible', false)
  }
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    title="确认删除"
    width="450px"
    :close-on-click-modal="!loading"
    :close-on-press-escape="!loading"
    :show-close="!loading"
    @update:model-value="handleClose"
  >
    <div v-if="file" class="delete-content">
      <p class="delete-message">
        确定要删除「<span class="file-name">{{ file.name }}</span>」吗？
      </p>
      <el-alert v-if="file.isDir" type="warning" :closable="false" show-icon class="warning-alert">
        这是一个文件夹，删除后其中所有内容都将被删除！
      </el-alert>
    </div>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleCancel" :disabled="loading">取消</el-button>
        <el-button type="danger" :loading="loading" @click="handleConfirm">
          删除
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
/* 对话框 - 网易云风格 */
:deep(.el-dialog) {
  border-radius: var(--radius-xl) !important;
  box-shadow: var(--shadow-xl) !important;
  overflow: hidden;
}

:deep(.el-dialog__header) {
  background: linear-gradient(135deg, #F56C6C 0%, #F78989 100%) !important;
  border-radius: var(--radius-xl) var(--radius-xl) 0 0 !important;
  padding: 20px 24px !important;
}

:deep(.el-dialog__title) {
  color: #fff !important;
  font-weight: 600;
  font-size: 18px;
}

:deep(.el-dialog__headerbtn .el-dialog__close) {
  color: #fff !important;
  font-size: 20px;
}

:deep(.el-dialog__headerbtn:hover .el-dialog__close) {
  color: rgba(255, 255, 255, 0.8) !important;
}

:deep(.el-dialog__body) {
  padding: 24px !important;
}

:deep(.el-dialog__footer) {
  padding: 16px 24px !important;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  background: rgba(245, 245, 245, 0.3);
}

.delete-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.delete-message {
  margin: 0;
  font-size: 15px;
  color: var(--netease-gray-7);
  line-height: 1.6;
}

.file-name {
  color: var(--netease-red);
  font-weight: 600;
}

.warning-alert {
  border-radius: var(--radius-md);
}

:deep(.el-alert--warning) {
  background: rgba(250, 140, 22, 0.1) !important;
  border: 1px solid rgba(250, 140, 22, 0.2) !important;
  border-radius: var(--radius-md) !important;
}

:deep(.el-alert__title) {
  color: #FA8C16 !important;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* 按钮样式 */
:deep(.el-button--danger) {
  background: linear-gradient(135deg, #F56C6C 0%, #F78989 100%) !important;
  border: none !important;
  border-radius: var(--radius-md) !important;
  box-shadow: 0 2px 8px rgba(245, 108, 108, 0.3) !important;
}

:deep(.el-button--danger:hover) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(245, 108, 108, 0.4) !important;
}

:deep(.el-button--default) {
  border-radius: var(--radius-md) !important;
  border: 1px solid rgba(0, 0, 0, 0.1) !important;
}

:deep(.el-button--default:hover) {
  border-color: var(--netease-gray-4) !important;
  color: var(--netease-gray-6) !important;
}
</style>

<script setup lang="ts">
import { ElDialog, ElAlert } from 'element-plus'
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

defineProps<Props>()
const emit = defineEmits<Emits>()

function handleConfirm() {
  emit('confirm')
}

function handleCancel() {
  emit('update:visible', false)
}
</script>

<template>
  <el-dialog
    :show="visible"
    preset="dialog"
    title="确认删除"
    positive-text="删除"
    negative-text="取消"
    :positive-button-props="{ type: 'error', loading }"
    @update:show="(val) => emit('update:visible', val)"
    @positive-click="handleConfirm"
    @negative-click="handleCancel"
  >
    <div v-if="file">
      <p>确定要删除「{{ file.name }}」吗？</p>
      <el-alert v-if="file.isDir" type="warning" style="margin-top: 12px">
        这是一个文件夹，删除后其中所有内容都将被删除！
      </el-alert>
    </div>
  </el-dialog>
</template>

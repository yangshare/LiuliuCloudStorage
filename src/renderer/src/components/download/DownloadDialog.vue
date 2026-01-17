<template>
  <el-dialog v-model="visible" title="下载到..." width="500px" :close-on-click-modal="false">
    <el-space direction="vertical" :size="16" style="width: 100%">
      <el-text>文件名: {{ file?.name }}</el-text>
      <el-text>大小: {{ formatFileSize(file?.size || 0) }}</el-text>

      <el-form-item label="保存位置">
        <el-input
          v-model="savePath"
          readonly
          placeholder="选择保存位置"
        >
          <template #append>
            <el-button @click="selectPath">选择位置</el-button>
          </template>
        </el-input>
      </el-form-item>
    </el-space>

    <template #footer>
      <el-space :size="12">
        <el-button @click="handleCancel">取消</el-button>
        <el-button type="primary" @click="confirmDownload" :disabled="!savePath">
          确认下载
        </el-button>
      </el-space>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElDialog, ElText, ElFormItem, ElInput, ElButton, ElSpace, ElMessage } from 'element-plus'
import { formatFileSize } from '../../utils/formatters'
import type { FileItem } from '../../../../shared/types/electron'

const props = defineProps<{
  file: FileItem | null
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'confirm': [savePath: string]
}>()

const savePath = ref('')
const visible = ref(props.visible)

watch(() => props.visible, (newVal) => {
  visible.value = newVal
  if (!newVal) {
    savePath.value = ''
  }
})

watch(visible, (newVal) => {
  emit('update:visible', newVal)
})

async function selectPath() {
  try {
    const result = await window.electronAPI?.downloadConfig.selectDirectory()
    if (result?.success) {
      savePath.value = result.path
    }
  } catch (error: any) {
    ElMessage.error('选择目录失败: ' + error.message)
  }
}

function handleCancel() {
  visible.value = false
  savePath.value = ''
}

function confirmDownload() {
  if (savePath.value) {
    emit('confirm', savePath.value)
    visible.value = false
    savePath.value = ''
  }
}
</script>

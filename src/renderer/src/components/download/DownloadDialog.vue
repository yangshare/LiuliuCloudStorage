<template>
  <n-modal v-model:show="visible" preset="dialog" title="下载到...">
    <n-space vertical>
      <n-text>文件名: {{ file?.name }}</n-text>
      <n-text>大小: {{ formatFileSize(file?.size || 0) }}</n-text>

      <n-form-item label="保存位置">
        <n-input-group>
          <n-input
            v-model:value="savePath"
            readonly
            placeholder="选择保存位置"
          />
          <n-button @click="selectPath">选择位置</n-button>
        </n-input-group>
      </n-form-item>
    </n-space>

    <template #action>
      <n-space>
        <n-button @click="handleCancel">取消</n-button>
        <n-button type="primary" @click="confirmDownload" :disabled="!savePath">
          确认下载
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { NModal, NSpace, NText, NFormItem, NInputGroup, NInput, NButton, useMessage } from 'naive-ui'
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

const message = useMessage()
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
    message.error('选择目录失败: ' + error.message)
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

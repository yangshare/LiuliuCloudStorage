<template>
  <el-dialog
    v-model="showModal"
    title="新建文件夹"
    width="500px"
    :close-on-click-modal="false"
  >
    <el-form ref="formRef" :model="formData" :rules="rules" label-width="120px">
      <el-form-item label="文件夹名称" prop="folderName">
        <el-input
          v-model="formData.folderName"
          placeholder="请输入文件夹名称"
          :disabled="isCreating"
          @keyup.enter="handleCreate"
          @keyup.esc="handleCancel"
          clearable
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="handleCancel" :disabled="isCreating">取消</el-button>
      <el-button type="primary" @click="handleCreate" :loading="isCreating">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { ElDialog, ElForm, ElFormItem, ElInput } from 'element-plus'
import { useFileStore } from '../../stores/fileStore'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const fileStore = useFileStore()
const showModal = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value)
})

const isCreating = ref(false)
const formRef = ref()
const formData = reactive({
  folderName: ''
})

const rules = {
  folderName: [
    { required: true, message: '请输入文件夹名称', trigger: 'blur' },
    {
      pattern: /^[^/\\:*?"<>|]+$/,
      message: '文件夹名称不能包含特殊字符（/ \\ : * ? " < > |）',
      trigger: 'blur'
    }
  ]
}

async function handleCreate() {
  try {
    await formRef.value?.validate()
  } catch (error) {
    console.error('表单验证失败:', error)
    return
  }

  try {
    isCreating.value = true
    const success = await fileStore.createFolder(formData.folderName)

    if (success) {
      showModal.value = false
      formData.folderName = ''
    }
  } finally {
    isCreating.value = false
  }
}

function handleCancel() {
  showModal.value = false
  formData.folderName = ''
}
</script>

<style scoped>
/* 对话框 - 网易云风格 */
:deep(.el-dialog) {
  border-radius: var(--radius-xl) !important;
  box-shadow: var(--shadow-xl) !important;
  overflow: hidden;
}

:deep(.el-dialog__header) {
  background: linear-gradient(135deg, var(--netease-red) 0%, var(--netease-red-light) 100%) !important;
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

/* 表单项 */
:deep(.el-form-item__label) {
  font-weight: 500;
  color: var(--netease-gray-6);
}

/* 输入框 */
:deep(.el-input__wrapper) {
  border-radius: var(--radius-md) !important;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1) inset !important;
  transition: all 0.2s ease;
}

:deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px var(--netease-red) inset !important;
}

:deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px var(--netease-red) inset !important;
}

/* 按钮 */
:deep(.el-button--primary) {
  background: linear-gradient(135deg, var(--netease-red) 0%, var(--netease-red-light) 100%) !important;
  border: none !important;
  border-radius: var(--radius-md) !important;
  box-shadow: 0 2px 8px rgba(194, 12, 12, 0.3) !important;
}

:deep(.el-button--primary:hover) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(194, 12, 12, 0.4) !important;
}

:deep(.el-button--default) {
  border-radius: var(--radius-md) !important;
  border: 1px solid rgba(0, 0, 0, 0.1) !important;
}

:deep(.el-button--default:hover) {
  border-color: var(--netease-red) !important;
  color: var(--netease-red) !important;
}
</style>

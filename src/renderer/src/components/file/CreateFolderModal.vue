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

<template>
  <n-modal
    v-model:show="showModal"
    preset="dialog"
    title="新建文件夹"
    positive-text="确定"
    negative-text="取消"
    :loading="isCreating"
    @positive-click="handleCreate"
    @negative-click="handleCancel"
  >
    <n-form ref="formRef" :model="formData" :rules="rules">
      <n-form-item label="文件夹名称" path="folderName">
        <n-input
          v-model:value="formData.folderName"
          placeholder="请输入文件夹名称"
          :disabled="isCreating"
          @keydown.enter="handleCreate"
          @keydown.esc="handleCancel"
          autofocus
        />
      </n-form-item>
    </n-form>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { NModal, NForm, NFormItem, NInput } from 'naive-ui'
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

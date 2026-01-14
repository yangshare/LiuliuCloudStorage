<template>
  <n-modal
    v-model:show="visible"
    preset="dialog"
    title="调整配额"
    :style="{ width: '500px' }"
  >
    <n-form ref="formRef" :model="formData" :rules="rules" label-placement="left" label-width="100px">
      <n-form-item label="用户名">
        <n-input :value="username" disabled />
      </n-form-item>

      <n-form-item label="当前配额">
        <n-input :value="`${currentQuotaGB} GB`" disabled />
      </n-form-item>

      <n-form-item label="新配额（GB）" path="newQuota">
        <n-input-number
          v-model:value="formData.newQuota"
          :min="1"
          :max="1000"
          :precision="2"
          placeholder="请输入新的配额值"
          style="width: 100%"
        />
      </n-form-item>

      <n-alert type="info" style="margin-bottom: 16px">
        配额调整后立即生效，用户可用空间将更新。
      </n-alert>
    </n-form>

    <template #action>
      <n-space>
        <n-button @click="handleCancel">取消</n-button>
        <n-button type="primary" @click="handleSubmit" :loading="isLoading">
          确认调整
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { NModal, NForm, NFormItem, NInput, NInputNumber, NButton, NAlert, NSpace, useMessage, type FormInst } from 'naive-ui'

interface Props {
  show: boolean
  userId: number
  currentQuotaBytes: number
  username: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:show': [value: boolean]
  success: [userId: number]
}>()

const message = useMessage()
const visible = ref(false)
const isLoading = ref(false)
const formRef = ref<FormInst | null>(null)

const currentQuotaGB = computed(() =>
  (props.currentQuotaBytes / (1024 * 1024 * 1024)).toFixed(2)
)

const formData = ref({
  newQuota: ref<number>(0)
})

const rules = {
  newQuota: [
    {
      required: true,
      type: 'number',
      message: '请输入配额值',
      trigger: ['blur', 'change']
    },
    {
      type: 'number',
      min: 1,
      max: 1000,
      message: '配额值必须在 1GB 到 1000GB 之间',
      trigger: ['blur', 'change']
    }
  ]
}

watch(() => props.show, (val) => {
  visible.value = val
  if (val) {
    formData.value.newQuota = parseFloat(currentQuotaGB.value)
  }
})

const handleCancel = () => {
  visible.value = false
  emit('update:show', false)
}

const handleSubmit = async () => {
  try {
    if (!formRef.value) return

    await formRef.value.validate()

    isLoading.value = true

    // 转换为字节
    const newQuotaBytes = Math.floor(formData.value.newQuota * 1024 * 1024 * 1024)

    // 调用 IPC 更新配额
    const result = await window.electronAPI.quota.adminUpdate(props.userId, newQuotaBytes)

    if (result.success) {
      message.success(`配额调整成功：${currentQuotaGB.value}GB → ${formData.value.newQuota.toFixed(2)}GB`)
      visible.value = false
      emit('update:show', false)
      emit('success', props.userId)
    } else {
      message.error('配额调整失败')
    }

  } catch (error: any) {
    console.error('配额调整失败:', error)
    message.error(error.message || '配额调整失败')
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <n-modal
    :show="show"
    @update:show="$emit('update:show', $event)"
  >
    <n-card
      style="width: 550px"
      title="调整用户配额"
      :bordered="false"
      size="huge"
      role="dialog"
      aria-modal="true"
    >
      <n-form v-if="user" ref="formRef" :model="formData" :rules="rules">
        <n-form-item label="用户名">
          <n-input :value="user.username" disabled />
        </n-form-item>

        <n-form-item label="当前配额总量">
          <n-input :value="formatBytes(user.quotaTotal)" disabled />
        </n-form-item>

        <n-form-item label="当前已使用">
          <n-input :value="formatBytes(user.quotaUsed)" disabled />
        </n-form-item>

        <n-form-item label="当前使用率">
          <n-progress
            type="line"
            :percentage="user.usageRate"
            :processing="user.usageRate > 90"
            :color="user.usageRate > 90 ? '#f56c6c' : user.usageRate > 70 ? '#e6a23c' : '#67c23a'"
          />
        </n-form-item>

        <n-divider />

        <!-- Story 7.5 MEDIUM FIX: 添加 GB 输入模式，提升用户体验 -->
        <n-form-item label="输入模式">
          <n-radio-group v-model:value="inputMode">
            <n-radio-button value="gb">
              GB (推荐)
            </n-radio-button>
            <n-radio-button value="bytes">
              字节
            </n-radio-button>
          </n-radio-group>
        </n-form-item>

        <!-- GB 输入模式 -->
        <template v-if="inputMode === 'gb'">
          <n-form-item label="新配额总量 (GB)" path="quotaTotalGB">
            <n-input-number
              v-model:value="formData.quotaTotalGB"
              :min="Math.ceil(user.quotaUsed / (1024 * 1024 * 1024))"
              :max="1000"
              :precision="2"
              :step="1"
              placeholder="输入新的配额总量(GB)"
              style="width: 100%"
            >
              <template #suffix>
                <span>GB</span>
              </template>
            </n-input-number>
          </n-form-item>

          <n-form-item>
            <template #label>
              <n-space align="center">
                <span>配额预览</span>
                <n-tag size="small" :type="quotaPreviewType">
                  {{ formatBytes(formData.quotaTotal) }}
                </n-tag>
              </n-space>
            </template>
            <n-space vertical>
              <n-text>{{ formData.quotaTotalGB }} GB = {{ formatBytes(formData.quotaTotal) }}</n-text>
              <n-text v-if="formData.quotaTotal < user.quotaTotal" type="warning">
                ⚠️ 新配额小于当前已使用量
              </n-text>
            </n-space>
          </n-form-item>
        </template>

        <!-- 字节输入模式 (原有方式) -->
        <template v-else>
          <n-form-item label="新配额总量 (字节)" path="quotaTotal">
            <n-input-number
              v-model:value="formData.quotaTotal"
              :min="user.quotaUsed"
              :max="107374182400"
              :precision="0"
              placeholder="输入新的配额总量(字节)"
              style="width: 100%"
            >
              <template #suffix>
                <span>B</span>
              </template>
            </n-input-number>
          </n-form-item>

          <n-form-item>
            <template #label>
              <n-space align="center">
                <span>配额预览</span>
                <n-tag size="small" :type="quotaPreviewType">
                  {{ formatBytes(formData.quotaTotal) }} ({{ (formData.quotaTotal / (1024 * 1024 * 1024)).toFixed(2) }} GB)
                </n-tag>
              </n-space>
            </template>
            <n-input :value="formatBytes(formData.quotaTotal)" disabled />
          </n-form-item>
        </template>

        <n-alert v-if="formData.quotaTotal < user.quotaTotal" type="warning" title="警告">
          新配额小于当前已使用量 ({{ formatBytes(user.quotaUsed) }}),用户可能无法继续上传文件
        </n-alert>
      </n-form>

      <template #footer>
        <n-space justify="end">
          <n-button @click="$emit('update:show', false)">
            取消
          </n-button>
          <n-button
            type="primary"
            :loading="submitting"
            @click="handleSubmit"
          >
            确认调整
          </n-button>
        </n-space>
      </template>
    </n-card>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  NModal, NCard, NForm, NFormItem, NInput, NInputNumber, NButton, NSpace,
  NDivider, NProgress, NTag, NAlert, NText, NRadioGroup, NRadioButton,
  type FormInst, type FormRules
} from 'naive-ui'
import { adminService, type UserListItem } from '../../services/AdminService'

interface Props {
  show: boolean
  user: UserListItem | null
}

interface Emits {
  (e: 'update:show', value: boolean): void
  (e: 'success'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const formRef = ref<FormInst | null>(null)
const submitting = ref(false)

// Story 7.5 MEDIUM FIX: 添加输入模式状态 (GB/字节)
const inputMode = ref<'gb' | 'bytes'>('gb')

const formData = ref({
  quotaTotal: 0,
  quotaTotalGB: 0  // Story 7.5 MEDIUM FIX: 添加 GB 输入字段
})

// 监听 user 变化,初始化表单数据
watch(() => props.user, (newUser) => {
  if (newUser) {
    formData.value.quotaTotal = newUser.quotaTotal
    formData.value.quotaTotalGB = newUser.quotaTotal / (1024 * 1024 * 1024)
  }
}, { immediate: true })

// Story 7.5 MEDIUM FIX: GB 输入同步到字节值
watch(() => formData.value.quotaTotalGB, (newGB) => {
  formData.value.quotaTotal = Math.round(newGB * 1024 * 1024 * 1024)
})

// Story 7.5 MEDIUM FIX: 字节输入同步到 GB 值
watch(() => formData.value.quotaTotal, (newBytes) => {
  formData.value.quotaTotalGB = newBytes / (1024 * 1024 * 1024)
})

// 配额预览类型
const quotaPreviewType = computed(() => {
  if (!props.user) return 'info'
  const newUsageRate = (props.user.quotaUsed / formData.value.quotaTotal) * 100
  if (newUsageRate > 90) return 'error'
  if (newUsageRate > 70) return 'warning'
  return 'success'
})

// 表单验证规则
const rules = computed(() => {
  const minGB = props.user ? Math.ceil(props.user.quotaUsed / (1024 * 1024 * 1024)) : 1

  return {
    quotaTotal: [
      {
        required: true,
        type: 'number',
        message: '请输入配额总量',
        trigger: ['blur', 'change']
      },
      {
        validator: (rule, value) => {
          if (!props.user) return true
          return value >= props.user.quotaUsed
        },
        message: '配额总量不能小于已使用量',
        trigger: ['blur', 'change']
      }
    ],
    quotaTotalGB: [
      {
        required: true,
        type: 'number',
        message: '请输入配额总量',
        trigger: ['blur', 'change']
      },
      {
        validator: (rule, value) => {
          if (!props.user) return true
          return value >= minGB
        },
        message: `配额总量不能小于 ${minGB} GB (当前已使用量)`,
        trigger: ['blur', 'change']
      }
    ]
  }
})

// 格式化字节数
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value || !props.user) return

  try {
    await formRef.value.validate()

    submitting.value = true
    // 始终使用字节值提交
    await adminService.adjustUserQuota(props.user.id, formData.value.quotaTotal)

    window.$message?.success('配额调整成功')
    emit('update:show', false)
    emit('success')
  } catch (error: any) {
    if (error?.errors) {
      // 表单验证错误
      return
    }
    window.$message?.error(error.message || '配额调整失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog
    :model-value="show"
    @update:model-value="$emit('update:show', $event)"
    title="调整用户配额"
    width="550px"
  >
    <el-form v-if="user" ref="formRef" :model="formData" :rules="rules">
      <el-form-item label="用户名">
        <el-input :model-value="user.username" disabled />
      </el-form-item>

      <el-form-item label="当前配额总量">
        <el-input :model-value="formatBytes(user.quotaTotal)" disabled />
      </el-form-item>

      <el-form-item label="当前已使用">
        <el-input :model-value="formatBytes(user.quotaUsed)" disabled />
      </el-form-item>

      <el-form-item label="当前使用率">
        <el-progress
          :percentage="user.usageRate"
          :color="getProgressColor(user.usageRate)"
        />
      </el-form-item>

      <el-divider />

      <!-- Story 7.5 MEDIUM FIX: 添加 GB 输入模式，提升用户体验 -->
      <el-form-item label="输入模式">
        <el-radio-group v-model="inputMode">
          <el-radio-button value="gb">
            GB (推荐)
          </el-radio-button>
          <el-radio-button value="bytes">
            字节
          </el-radio-button>
        </el-radio-group>
      </el-form-item>

      <!-- GB 输入模式 -->
      <template v-if="inputMode === 'gb'">
        <el-form-item label="新配额总量 (GB)" prop="quotaTotalGB">
          <el-input-number
            v-model="formData.quotaTotalGB"
            :min="Math.ceil(user.quotaUsed / (1024 * 1024 * 1024))"
            :max="1000"
            :precision="2"
            :step="1"
            placeholder="输入新的配额总量(GB)"
            style="width: 100%"
            controls-position="right"
          />
        </el-form-item>

        <el-form-item label="配额预览">
          <div class="quota-preview">
            <el-space align="center" :size="8">
              <span>{{ formData.quotaTotalGB }} GB = {{ formatBytes(formData.quotaTotal) }}</span>
              <el-tag size="small" :type="quotaPreviewType">
                {{ formatBytes(formData.quotaTotal) }}
              </el-tag>
            </el-space>
            <div v-if="formData.quotaTotal < user.quotaTotal" class="warning-text">
              <el-text type="warning">
                ⚠️ 新配额小于当前已使用量
              </el-text>
            </div>
          </div>
        </el-form-item>
      </template>

      <!-- 字节输入模式 (原有方式) -->
      <template v-else>
        <el-form-item label="新配额总量 (字节)" prop="quotaTotal">
          <el-input-number
            v-model="formData.quotaTotal"
            :min="user.quotaUsed"
            :max="107374182400"
            :precision="0"
            placeholder="输入新的配额总量(字节)"
            style="width: 100%"
            controls-position="right"
          />
        </el-form-item>

        <el-form-item label="配额预览">
          <div class="quota-preview">
            <el-space align="center" :size="8">
              <span>{{ formatBytes(formData.quotaTotal) }} ({{ (formData.quotaTotal / (1024 * 1024 * 1024)).toFixed(2) }} GB)</span>
              <el-tag size="small" :type="quotaPreviewType">
                {{ formatBytes(formData.quotaTotal) }}
              </el-tag>
            </el-space>
          </div>
        </el-form-item>
      </template>

      <el-alert v-if="formData.quotaTotal < user.quotaTotal" type="warning" title="警告" :closable="false">
        新配额小于当前已使用量 ({{ formatBytes(user.quotaUsed) }}),用户可能无法继续上传文件
      </el-alert>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="$emit('update:show', false)">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="submitting"
          @click="handleSubmit"
        >
          确认调整
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElDialog, ElForm, ElFormItem, ElInput, ElInputNumber, ElButton, ElDivider, ElProgress, ElTag, ElAlert, ElText, ElRadioGroup, ElRadioButton, ElSpace, type FormInst, type FormRules } from 'element-plus'
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
  if (newUsageRate > 90) return 'danger'
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
        validator: (rule: any, value: number) => {
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
        validator: (rule: any, value: number) => {
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

const getProgressColor = (percentage: number): string => {
  if (percentage > 90) return '#f56c6c'
  if (percentage > 70) return '#e6a23c'
  return '#67c23a'
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value || !props.user) return

  try {
    await formRef.value.validate()

    submitting.value = true
    // 始终使用字节值提交
    await adminService.adjustUserQuota(props.user.id, formData.value.quotaTotal)

    ElMessage.success('配额调整成功')
    emit('update:show', false)
    emit('success')
  } catch (error: any) {
    if (error?.errors) {
      // 表单验证错误
      return
    }
    ElMessage.error(error.message || '配额调整失败')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.quota-preview {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.warning-text {
  margin-top: 4px;
}
</style>

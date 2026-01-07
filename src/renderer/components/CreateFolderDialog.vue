/**
 * 新建文件夹对话框组件
 */

<template>
  <el-dialog
    v-model="visible"
    title="新建文件夹"
    width="500px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-width="80px"
    >
      <el-form-item label="文件夹">
        <el-input
          v-model="formData.folderName"
          placeholder="请输入文件夹名称"
          clearable
          @keyup.enter="handleConfirm"
        />
      </el-form-item>

      <el-form-item label="位置">
        <span class="path-text">{{ currentPath }}</span>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="handleConfirm" :loading="loading">
        确定
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';

interface Props {
  modelValue: boolean;
  currentPath: string;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'confirm', folderName: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const formRef = ref<FormInstance>();
const loading = ref(false);

const formData = reactive({
  folderName: ''
});

const formRules: FormRules = {
  folderName: [
    { required: true, message: '请输入文件夹名称', trigger: 'blur' },
    {
      pattern: /^[^<>:"/\\|?*]+$/,
      message: '文件夹名称不能包含特殊字符',
      trigger: 'blur'
    },
    { min: 1, max: 255, message: '长度在 1 到 255 个字符', trigger: 'blur' }
  ]
};

/**
 * 确认创建
 */
const handleConfirm = async (): Promise<void> => {
  if (!formRef.value) return;

  try {
    await formRef.value.validate();
    loading.value = true;

    emit('confirm', formData.folderName);

    // 重置表单
    formData.folderName = '';
    formRef.value.resetFields();
  } catch (error) {
    console.error('表单验证失败:', error);
  } finally {
    loading.value = false;
  }
};

/**
 * 关闭对话框
 */
const handleClose = (): void => {
  formData.folderName = '';
  formRef.value?.resetFields();
  visible.value = false;
};

/**
 * 监听对话框打开
 */
watch(visible, (val) => {
  if (val) {
    // 对话框打开时自动聚焦输入框
    setTimeout(() => {
      const input = document.querySelector('.el-input__inner') as HTMLInputElement;
      input?.focus();
    }, 100);
  }
});
</script>

<style scoped>
.path-text {
  color: #606266;
  font-size: 14px;
}
</style>

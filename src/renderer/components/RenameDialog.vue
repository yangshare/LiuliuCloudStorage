/**
 * 重命名对话框组件
 */

<template>
  <el-dialog
    v-model="visible"
    title="重命名"
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
      <el-form-item label="原名称">
        <span class="name-text">{{ file?.name || '-' }}</span>
      </el-form-item>

      <el-form-item label="新名称" prop="newName">
        <el-input
          v-model="formData.newName"
          placeholder="请输入新名称"
          clearable
          @keyup.enter="handleConfirm"
        />
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
import { IFileItem } from '@shared/types/filesystem.types';

interface Props {
  modelValue: boolean;
  file: IFileItem | null;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'confirm', newName: string): void;
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
  newName: ''
});

const formRules: FormRules = {
  newName: [
    { required: true, message: '请输入新名称', trigger: 'blur' },
    {
      pattern: /^[^<>:"/\\|?*]+$/,
      message: '文件名不能包含特殊字符',
      trigger: 'blur'
    },
    { min: 1, max: 255, message: '长度在 1 到 255 个字符', trigger: 'blur' }
  ]
};

/**
 * 确认重命名
 */
const handleConfirm = async (): Promise<void> => {
  if (!formRef.value) return;

  try {
    await formRef.value.validate();
    loading.value = true;

    emit('confirm', formData.newName);

    // 重置表单
    formData.newName = '';
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
  formData.newName = '';
  formRef.value?.resetFields();
  visible.value = false;
};

/**
 * 监听文件变化，自动填充原名称
 */
watch(() => props.file, (file) => {
  if (file) {
    formData.newName = file.name;
  }
}, { immediate: true });

/**
 * 监听对话框打开
 */
watch(visible, (val) => {
  if (val) {
    // 对话框打开时自动选中输入框内容
    setTimeout(() => {
      const input = document.querySelector('.el-input__inner') as HTMLInputElement;
      input?.focus();
      input?.select();
    }, 100);
  }
});
</script>

<style scoped>
.name-text {
  color: #606266;
  font-size: 14px;
}
</style>

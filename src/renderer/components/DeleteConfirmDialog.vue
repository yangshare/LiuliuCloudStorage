/**
 * 删除确认对话框组件
 */

<template>
  <el-dialog
    v-model="visible"
    title="确认删除"
    width="500px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <div class="delete-content">
      <el-icon :size="48" color="#f56c6c">
        <WarningFilled />
      </el-icon>

      <div class="delete-message">
        <p v-if="files.length === 1">
          确定要删除 <strong>{{ files[0]?.name }}</strong> 吗？
        </p>
        <p v-else>
          确定要删除选中的 <strong>{{ files.length }}</strong> 个项目吗？
        </p>

        <el-scrollbar max-height="200px" v-if="files.length > 1">
          <ul class="file-list">
            <li v-for="file in files" :key="file.path">
              <el-icon :size="16" :color="file.is_dir ? '#409eff' : '#909399'">
                <component :is="getFileIcon(file)" />
              </el-icon>
              <span>{{ file.name }}</span>
            </li>
          </ul>
        </el-scrollbar>

        <el-alert
          type="warning"
          :closable="false"
          show-icon
        >
          删除后无法恢复，请谨慎操作！
        </el-alert>
      </div>
    </div>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="danger" @click="handleConfirm" :loading="loading">
        删除
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { WarningFilled, Folder, Document } from '@element-plus/icons-vue';
import { IFileItem } from '@shared/types/filesystem.types';
import { useFileSystem } from '../composables/useFileSystem';

interface Props {
  modelValue: boolean;
  files: IFileItem[];
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'confirm'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { getFileIcon } = useFileSystem();

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const loading = ref(false);

/**
 * 确认删除
 */
const handleConfirm = (): void => {
  loading.value = true;
  emit('confirm');
  loading.value = false;
};

/**
 * 关闭对话框
 */
const handleClose = (): void => {
  visible.value = false;
};
</script>

<style scoped>
.delete-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 16px 0;
}

.delete-message {
  width: 100%;
  text-align: center;
}

.delete-message p {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #303133;
}

.file-list {
  list-style: none;
  padding: 0;
  margin: 0;
  text-align: left;
}

.file-list li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.file-list li:last-child {
  border-bottom: none;
}

.file-list li span {
  font-size: 14px;
  color: #606266;
}
</style>

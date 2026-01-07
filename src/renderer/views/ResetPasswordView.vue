<template>
  <div class="reset-password-container">
    <el-card class="reset-password-card">
      <template #header>
        <div class="card-header">
          <h2>溜溜网盘</h2>
          <p>密码重置</p>
        </div>
      </template>

      <el-form :model="form" :rules="rules" ref="formRef" label-width="80px">
        <el-form-item label="用户名" prop="username">
          <el-input
            v-model="form.username"
            placeholder="请输入用户名"
          />
        </el-form-item>

        <el-form-item label="邮箱" prop="email">
          <el-input
            v-model="form.email"
            type="email"
            placeholder="请输入注册邮箱"
            @keyup.enter="handleReset"
          />
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            @click="handleReset"
            :loading="loading"
            style="width: 100%"
          >
            {{ loading ? '提交中...' : '提交' }}
          </el-button>
        </el-form-item>

        <el-form-item>
          <div class="links">
            <router-link to="/login">返回登录</router-link>
          </div>
        </el-form-item>
      </el-form>

      <el-alert
        v-if="error"
        :title="error"
        type="error"
        :closable="false"
        style="margin-top: 20px"
      />

      <el-alert
        v-if="success"
        title="如果邮箱存在，您将收到密码重置链接"
        type="success"
        :closable="false"
        style="margin-top: 20px"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth';
import type { FormInstance, FormRules } from 'element-plus';

const router = useRouter();
const auth = useAuth();

const formRef = ref<FormInstance>();
const loading = ref(false);
const error = ref<string | null>(null);
const success = ref(false);

const form = reactive({
  username: '',
  email: ''
});

const rules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' }
  ],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }
  ]
};

const handleReset = async () => {
  if (!formRef.value) return;

  await formRef.value.validate(async (valid) => {
    if (!valid) return;

    error.value = null;
    success.value = false;
    loading.value = true;

    const result = await auth.resetPassword({
      username: form.username,
      email: form.email
    });

    loading.value = false;

    if (result.success) {
      success.value = true;
    } else {
      error.value = result.message || '密码重置失败';
    }
  });
};
</script>

<style scoped>
.reset-password-container {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.reset-password-card {
  width: 400px;
}

.card-header {
  text-align: center;
}

.card-header h2 {
  margin: 0 0 10px 0;
  color: #333;
}

.card-header p {
  margin: 0;
  color: #666;
  font-size: 14px;
}

.links {
  display: flex;
  justify-content: center;
  width: 100%;
}

.links a {
  color: #409eff;
  text-decoration: none;
}

.links a:hover {
  text-decoration: underline;
}
</style>

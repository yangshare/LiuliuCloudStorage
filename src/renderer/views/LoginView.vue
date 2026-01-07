<template>
  <div class="login-container">
    <el-card class="login-card">
      <template #header>
        <div class="card-header">
          <h2>溜溜网盘</h2>
          <p>用户登录</p>
        </div>
      </template>

      <el-form :model="form" :rules="rules" ref="formRef" label-width="80px">
        <el-form-item label="用户名" prop="username">
          <el-input
            v-model="form.username"
            placeholder="请输入用户名"
            @keyup.enter="handleLogin"
          />
        </el-form-item>

        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            show-password
            @keyup.enter="handleLogin"
          />
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            @click="handleLogin"
            :loading="loading"
            style="width: 100%"
          >
            {{ loading ? '登录中...' : '登录' }}
          </el-button>
        </el-form-item>

        <el-form-item>
          <div class="links">
            <router-link to="/register">注册账号</router-link>
            <router-link to="/reset-password">忘记密码</router-link>
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

const form = reactive({
  username: '',
  password: ''
});

const rules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名长度为 3-20 个字符', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 8, message: '密码至少 8 个字符', trigger: 'blur' }
  ]
};

const handleLogin = async () => {
  if (!formRef.value) return;

  await formRef.value.validate(async (valid) => {
    if (!valid) return;

    error.value = null;
    const result = await auth.login({
      username: form.username,
      password: form.password
    });

    if (result.success) {
      // 登录成功，保存状态
      localStorage.setItem('isAuthenticated', 'true');
      // 跳转到主页
      router.push('/');
    } else {
      error.value = result.message || '登录失败';
    }
  });
};
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-card {
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
  justify-content: space-between;
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

<template>
  <div class="register-container">
    <el-card class="register-card">
      <template #header>
        <div class="card-header">
          <h2>溜溜网盘</h2>
          <p>用户注册</p>
        </div>
      </template>

      <el-form :model="form" :rules="rules" ref="formRef" label-width="80px">
        <el-form-item label="用户名" prop="username">
          <el-input
            v-model="form.username"
            placeholder="3-20个字符，只允许字母、数字、下划线"
          />
        </el-form-item>

        <el-form-item label="邮箱" prop="email">
          <el-input
            v-model="form.email"
            type="email"
            placeholder="请输入邮箱（可选）"
          />
        </el-form-item>

        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="至少8个字符"
            show-password
          />
        </el-form-item>

        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input
            v-model="form.confirmPassword"
            type="password"
            placeholder="再次输入密码"
            show-password
            @keyup.enter="handleRegister"
          />
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            @click="handleRegister"
            :loading="loading"
            style="width: 100%"
          >
            {{ loading ? '注册中...' : '注册' }}
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
        title="注册成功！请前往登录"
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
  email: '',
  password: '',
  confirmPassword: ''
});

const validateUsername = (_rule: any, value: string, callback: any) => {
  const regex = /^[a-zA-Z0-9_]{3,20}$/;
  if (!regex.test(value)) {
    callback(new Error('用户名只能包含字母、数字、下划线，长度3-20个字符'));
  } else {
    callback();
  }
};

const validateConfirmPassword = (_rule: any, value: string, callback: any) => {
  if (value !== form.password) {
    callback(new Error('两次密码不一致'));
  } else {
    callback();
  }
};

const rules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { validator: validateUsername, trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 8, message: '密码至少 8 个字符', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' }
  ]
};

const handleRegister = async () => {
  if (!formRef.value) return;

  await formRef.value.validate(async (valid) => {
    if (!valid) return;

    error.value = null;
    success.value = false;

    const result = await auth.register({
      username: form.username,
      password: form.password,
      email: form.email || undefined
    });

    if (result.success) {
      success.value = true;
      // 2秒后跳转到登录页
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } else {
      error.value = result.message || '注册失败';
    }
  });
};
</script>

<style scoped>
.register-container {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.register-card {
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

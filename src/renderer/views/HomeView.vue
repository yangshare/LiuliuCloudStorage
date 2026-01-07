<template>
  <div class="home-container">
    <el-container>
      <el-header>
        <div class="header-content">
          <h1>溜溜网盘</h1>
          <div class="user-info">
            <span>{{ userInfo?.username }}</span>
            <el-button @click="handleLogout" text>登出</el-button>
          </div>
        </div>
      </el-header>

      <el-main>
        <el-empty description="文件管理功能开发中...">
          <el-button type="primary">上传文件</el-button>
        </el-empty>
      </el-main>
    </el-container>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth';
import { ElMessageBox } from 'element-plus';

const router = useRouter();
const auth = useAuth();

const userInfo = computed(() => auth.userInfo);

const handleLogout = async () => {
  try {
    await ElMessageBox.confirm('确定要登出吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    });

    const result = await auth.logout();
    if (result.success) {
      localStorage.removeItem('isAuthenticated');
      router.push('/login');
    }
  } catch {
    // 用户取消登出
  }
};
</script>

<style scoped>
.home-container {
  width: 100%;
  height: 100vh;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
}

.header-content h1 {
  margin: 0;
  font-size: 24px;
  color: #333;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-info span {
  color: #666;
}
</style>

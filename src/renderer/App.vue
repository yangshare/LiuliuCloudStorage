<template>
  <router-view />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useAuth } from './composables/useAuth';
import { useRouter } from 'vue-router';

const auth = useAuth();
const router = useRouter();

onMounted(async () => {
  // 检查登录状态
  const session = await auth.getSession();

  if (session.isAuthenticated) {
    // 已登录，跳转到主页
    if (router.currentRoute.value.path === '/login' ||
        router.currentRoute.value.path === '/register') {
      router.push('/');
    }
  } else {
    // 未登录，跳转到登录页
    if (router.currentRoute.value.path !== '/login' &&
        router.currentRoute.value.path !== '/register') {
      router.push('/login');
    }
  }
});
</script>

<style>
#app {
  width: 100%;
  height: 100vh;
}
</style>

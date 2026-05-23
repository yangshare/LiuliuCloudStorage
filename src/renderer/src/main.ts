import { createApp } from 'vue'
import { createPinia } from 'pinia'
// import naive from 'naive-ui' // 暂时保留，迁移完成后移除
import router from './router'
import App from './App.vue'
import { trayMonitorService } from './services/TrayMonitorService'
import { setupElementPlus } from './plugins/element-plus'
import { setupAuthExpiredGuard } from './features/auth'
// 网易云音乐风格主题
import './styles/theme-netease.css'

const app = createApp(App)

const pinia = createPinia()
app.use(pinia)
// app.use(naive) // 暂时保留，迁移完成后移除
setupElementPlus(app) // 引入Element Plus
app.use(router)
app.mount('#app')

// 全局拦截 IPC 鉴权失败，统一跳转登录页
setupAuthExpiredGuard(router, pinia)

// 启动托盘状态监控 (Story 8.2)
trayMonitorService.startMonitoring()

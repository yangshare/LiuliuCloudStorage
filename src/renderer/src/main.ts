import { createApp } from 'vue'
import { createPinia } from 'pinia'
// import naive from 'naive-ui' // 暂时保留，迁移完成后移除
import router from './router'
import App from './App.vue'
import { trayMonitorService } from './services/TrayMonitorService'
import { setupElementPlus } from './plugins/element-plus'

const app = createApp(App)

app.use(createPinia())
// app.use(naive) // 暂时保留，迁移完成后移除
setupElementPlus(app) // 引入Element Plus
app.use(router)
app.mount('#app')

// 启动托盘状态监控 (Story 8.2)
trayMonitorService.startMonitoring()

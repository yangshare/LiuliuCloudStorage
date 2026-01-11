import { createApp } from 'vue'
import { createPinia } from 'pinia'
import naive from 'naive-ui'
import router from './router'
import App from './App.vue'
import { trayMonitorService } from './services/TrayMonitorService'

const app = createApp(App)

app.use(createPinia())
app.use(naive)
app.use(router)
app.mount('#app')

// 启动托盘状态监控 (Story 8.2)
trayMonitorService.startMonitoring()

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import naive from 'naive-ui'
import router from './router'
import App from './App.vue'

const app = createApp(App)

app.use(createPinia())
app.use(naive)
app.use(router)
app.mount('#app')

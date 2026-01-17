import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

export function setupElementPlus(app: any) {
  // 注册所有Element Plus图标
  for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component)
  }

  // 全局引入Element Plus
  app.use(ElementPlus, {
    locale: zhCn,
  })

  // 全局消息组件（兼容 Naive UI 的 window.$message）
  app.config.globalProperties.$message = ElMessage
}

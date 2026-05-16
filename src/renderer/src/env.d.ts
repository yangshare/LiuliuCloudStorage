declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module 'element-plus/dist/locale/zh-cn.mjs'

// Electron preload API 全局声明
interface Window {
  electronAPI: {
    auth: {
      login: (username: string, password: string, autoLogin?: boolean) => Promise<any>
      logout: () => Promise<any>
      checkSession: () => Promise<any>
      getCurrentUser: () => Promise<any>
      getUsers: (params?: any) => Promise<any>
      getStorageStats: () => Promise<any>
      getLoginPreferences: () => Promise<any>
    }
    // 其他 API 可根据需要补充
    [key: string]: any
  }
}

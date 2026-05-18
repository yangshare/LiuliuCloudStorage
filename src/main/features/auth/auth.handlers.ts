// src/main/features/auth/auth.handlers.ts

import { ipcMain } from 'electron'
import { authService } from './auth.service'
import { handleIPC } from '../../core/ipc/error-handler'

export function registerAuthHandlers() {
  // 登录：保持与旧 preload API 一致的参数格式 (username, password, autoLogin)
  ipcMain.handle('auth:session:login', async (_event, username: string, password: string, autoLogin: boolean = false) => {
    return handleIPC(() => authService.login({ username, password, autoLogin }))
  })

  // 获取登录偏好设置
  ipcMain.handle('auth:preference:login', async () => {
    return handleIPC(() => authService.getLoginPreferences())
  })

  // 登出
  ipcMain.handle('auth:session:logout', async () => {
    return handleIPC(() => authService.logout())
  })

  // 检查/恢复会话
  ipcMain.handle('auth:session:check', async () => {
    return handleIPC(() => authService.checkSession())
  })

  // 获取当前用户信息
  ipcMain.handle('auth:user:current', async () => {
    return handleIPC(() => authService.getCurrentUser())
  })
}

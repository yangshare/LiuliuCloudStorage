// src/main/features/auth/auth.handlers.ts

import { ipcMain } from 'electron'
import { authService } from './auth.service'
import { handleIPC } from '../../core/ipc/error-handler'
import { autoSyncService } from '../autoSync/auto-sync.core.service'

export function registerAuthHandlers() {
  // 登录：保持与旧 preload API 一致的参数格式 (username, password, autoLogin)
  ipcMain.handle('auth:session:login', async (_event, username: string, password: string, autoLogin: boolean = false) => {
    return handleIPC(() => authService.login({ username, password, autoLogin }))
  })

  // 获取登录偏好设置
  ipcMain.handle('auth:preference:login', async () => {
    return handleIPC(() => authService.getLoginPreferences())
  })

  // 登出：清除会话后重置自动同步状态（避免 auth ↔ autoSync 循环依赖）
  ipcMain.handle('auth:session:logout', async () => {
    return handleIPC(async () => {
      const userId = authService.getCurrentSession()?.userId
      const result = await authService.logout()
      if (userId) {
        autoSyncService.resetStartupExecuted(userId)
      }
      return result
    })
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

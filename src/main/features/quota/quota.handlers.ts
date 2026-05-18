// src/main/features/quota/quota.handlers.ts

import { ipcMain } from 'electron'
import { quotaService } from './quota.service'
import { handleIPC } from '../../core/ipc/error-handler'

export function registerQuotaHandlers() {
  // 获取当前用户配额信息
  ipcMain.handle('quota:usage:get', async () => {
    return handleIPC(() => quotaService.getQuota())
  })

  // 更新配额使用量
  ipcMain.handle('quota:usage:update', async (_event, quotaUsed: number) => {
    return handleIPC(() => quotaService.updateQuota(quotaUsed))
  })

  // 计算并更新配额使用量
  ipcMain.handle('quota:usage:calculate', async () => {
    return handleIPC(() => quotaService.calculateAndUpdateQuota())
  })

  // 管理员更新用户配额
  ipcMain.handle('quota:admin:update', async (_event, targetUserId: number, newQuotaGB: number) => {
    return handleIPC(() => quotaService.adminUpdateQuota(targetUserId, newQuotaGB))
  })
}

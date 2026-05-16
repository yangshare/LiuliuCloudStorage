// src/main/features/auth/auth.handlers.ts

import { ipcMain } from 'electron'
import { authService } from './auth.service'
import { handleIPC } from '../../core/ipc/error-handler'
import type { LoginParams } from '../../../shared/types/auth'

export function registerAuthHandlers() {
  ipcMain.handle('auth:login', async (_event, params: LoginParams) => {
    return handleIPC(() => authService.login(params))
  })

  ipcMain.handle('auth:session:check', async (_event, token: string) => {
    return handleIPC(() => authService.checkSession(token))
  })
}

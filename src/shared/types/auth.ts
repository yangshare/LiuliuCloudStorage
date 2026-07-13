// src/shared/types/auth.ts

import type { IPCResult } from './ipc'

export interface User {
  id: number
  username: string
  token: string
  isAdmin: boolean
}

export interface LoginParams {
  username: string
  password: string
}

export interface SessionResult {
  valid: boolean
  user?: User
}

// IPC 响应类型别名
export type AuthLoginResult = IPCResult<User>
export type AuthSessionResult = IPCResult<SessionResult>

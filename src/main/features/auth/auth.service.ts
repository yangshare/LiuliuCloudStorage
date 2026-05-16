// src/main/features/auth/auth.service.ts

import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { getDatabase } from '../../database'
import { users } from '../../database/schema'
import { IPCError, IPCErrorCode } from '../../core/ipc/error-handler'
import type { AuthLoginResult, AuthSessionResult, LoginParams } from '../../../shared/types/auth'

export class AuthService {
  private get db() {
    return drizzle(getDatabase())
  }

  async login(params: LoginParams): Promise<AuthLoginResult> {
    const user = this.db.select()
      .from(users)
      .where(eq(users.username, params.username))
      .get()

    if (!user) {
      throw new IPCError('用户名或密码错误', IPCErrorCode.UNAUTHORIZED)
    }

    // TODO: 密码验证逻辑（复用现有逻辑）
    // 先注释掉密码验证，保留 TODO 标记，等后续补充

    return {
      success: true,
      data: {
        id: user.id,
        username: user.username,
        token: user.alistToken ?? '',
        isAdmin: user.isAdmin
      }
    }
  }

  async checkSession(token: string): Promise<AuthSessionResult> {
    const user = this.db.select()
      .from(users)
      .where(eq(users.alistToken, token))
      .get()

    if (!user) {
      return { success: true, data: { valid: false } }
    }

    return {
      success: true,
      data: {
        valid: true,
        user: {
          id: user.id,
          username: user.username,
          token: user.alistToken ?? '',
          isAdmin: user.isAdmin
        }
      }
    }
  }
}

export const authService = new AuthService()

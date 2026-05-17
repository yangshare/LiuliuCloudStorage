export interface LoginResult {
  success: boolean
  message?: string
  error?: string
  token?: string
}

export interface SessionUser {
  id: number
  username: string
  token: string
  isAdmin?: boolean
}

export interface SessionCheckResult {
  valid: boolean
  username?: string
  user?: SessionUser
}

type WrappedSessionCheckResult = {
  success: boolean
  data?: {
    valid: boolean
    user?: SessionUser
  }
}

export function normalizeSessionCheckResult(
  result: SessionCheckResult | WrappedSessionCheckResult | null | undefined
): SessionCheckResult {
  if (!result) {
    return { valid: false }
  }

  if ('success' in result) {
    return {
      valid: result.success && (result.data?.valid ?? false),
      username: result.data?.user?.username,
      user: result.data?.user
    }
  }

  return result
}

export const authRendererService = {
  async login(username: string, password: string, autoLogin: boolean = false): Promise<LoginResult> {
    return window.electronAPI.auth.login(username, password, autoLogin)
  },

  async checkSession(): Promise<SessionCheckResult> {
    const result = await window.electronAPI.auth.checkSession()
    return normalizeSessionCheckResult(result)
  },

  async getCurrentUser(): Promise<any> {
    return window.electronAPI.auth.getCurrentUser()
  },

  async logout(): Promise<{ success: boolean }> {
    return window.electronAPI.auth.logout()
  }
}

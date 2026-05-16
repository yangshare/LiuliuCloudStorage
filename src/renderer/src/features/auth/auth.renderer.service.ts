export interface LoginResult {
  success: boolean
  message?: string
  token?: string
}

export interface SessionCheckResult {
  valid: boolean
  username?: string
}

export const authRendererService = {
  async login(username: string, password: string, autoLogin: boolean = false): Promise<LoginResult> {
    return window.electronAPI.auth.login(username, password, autoLogin)
  },

  async checkSession(): Promise<SessionCheckResult> {
    return window.electronAPI.auth.checkSession()
  },

  async getCurrentUser(): Promise<any> {
    return window.electronAPI.auth.getCurrentUser()
  },

  async logout(): Promise<{ success: boolean }> {
    return window.electronAPI.auth.logout()
  }
}

// src/main/features/auth/index.ts

import { registerAuthHandlers } from './auth.handlers'

export function initAuthModule() {
  registerAuthHandlers()
}

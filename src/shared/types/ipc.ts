// src/shared/types/ipc.ts

export interface IPCSuccess<T> {
  success: true
  data: T
}

export interface IPCError {
  success: false
  error: string
  code?: string
}

export type IPCResult<T = void> = IPCSuccess<T> | IPCError

export const IPCErrorCode = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  VALIDATION: 'VALIDATION',
  NETWORK: 'NETWORK',
  INTERNAL: 'INTERNAL'
} as const

export type IPCErrorCodeType = typeof IPCErrorCode[keyof typeof IPCErrorCode]

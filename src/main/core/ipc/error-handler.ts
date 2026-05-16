// src/main/core/ipc/error-handler.ts

import type { IPCResult, IPCErrorCodeType } from '../../../shared/types/ipc'
import { IPCErrorCode } from '../../../shared/types/ipc'
import { loggerService } from '../../services/LoggerService'

export class IPCError extends Error {
  constructor(
    message: string,
    public code: IPCErrorCodeType = IPCErrorCode.INTERNAL
  ) {
    super(message)
    this.name = 'IPCError'
  }
}

export async function handleIPC<T>(
  handler: () => Promise<T>
): Promise<IPCResult<T>> {
  try {
    const data = await handler()
    return { success: true, data }
  } catch (error) {
    if (error instanceof IPCError) {
      return { success: false, error: error.message, code: error.code }
    }
    loggerService.error('IPC', 'Handler error', error as Error)
    return {
      success: false,
      error: '服务器内部错误',
      code: IPCErrorCode.INTERNAL
    }
  }
}

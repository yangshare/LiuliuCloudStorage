// src/main/core/ipc/error-handler.ts

import type { IPCResult, IPCErrorCodeType } from '../../../shared/types/ipc'
import { IPCErrorCode } from '../../../shared/types/ipc'

export { IPCErrorCode }
import { loggerService } from '../logger/logger.service'

export class IPCError extends Error {
  constructor(
    message: string,
    public code: IPCErrorCodeType = IPCErrorCode.INTERNAL
  ) {
    super(message)
    this.name = 'IPCError'
  }
}

function isIPCResult(data: unknown): data is IPCResult<unknown> {
  if (data === null || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('success' in d) || typeof d.success !== 'boolean') return false
  if (d.success === true) return 'data' in d
  return 'error' in d
}

export async function handleIPC<T>(
  handler: () => Promise<T>
): Promise<IPCResult<T>> {
  try {
    const data = await handler()
    if (isIPCResult(data)) {
      return data as IPCResult<T>
    }
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

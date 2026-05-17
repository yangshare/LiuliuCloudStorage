// src/main/core/ipc/error-handler.ts

import type { IPCResult, IPCErrorCodeType } from '../../../shared/types/ipc'
import { IPCErrorCode } from '../../../shared/types/ipc'

export { IPCErrorCode }
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

function isIPCResult(data: unknown): data is IPCResult<unknown> {
  return (
    data !== null &&
    typeof data === 'object' &&
    'success' in data &&
    typeof (data as { success: unknown }).success === 'boolean'
  )
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

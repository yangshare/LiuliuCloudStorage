// src/renderer/src/core/composables/useIPC.ts

import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import type { IPCResult } from '../../../../shared/types/ipc'

export function useIPC() {
  const router = useRouter()

  async function invoke<T>(promise: Promise<IPCResult<T>>): Promise<T | null> {
    const result = await promise

    if (!result.success) {
      const errorResult = result as Extract<IPCResult<T>, { success: false }>
      ElMessage.error(errorResult.error || '操作失败')

      if (errorResult.code === 'UNAUTHORIZED') {
        router.push('/login')
      }

      return null
    }

    return result.data as T
  }

  return { invoke }
}

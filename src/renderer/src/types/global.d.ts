import { ElMessage } from 'element-plus'

declare global {
  interface Window {
    $message: typeof ElMessage
  }
}

export {}

import { ElMessage } from 'element-plus'
import type { NotificationApiInjection } from 'naive-ui/es/notification/src/NotificationProvider'
import type { MessageApiInjection } from 'naive-ui/es/message/src/MessageProvider'

declare global {
  interface Window {
    $message: typeof ElMessage
    $notification: NotificationApiInjection
    $naiveMessage: MessageApiInjection
  }
}

export {}

import { ElNotification } from 'element-plus'

export async function openFileDirectory(filePath: string): Promise<void> {
  if (!filePath) {
    ElNotification.warning({ title: '无法打开', message: '文件保存路径未知' })
    return
  }
  try {
    const result = await window.electronAPI?.downloadConfig.openFileDirectory(filePath)
    if (!result?.success) {
      ElNotification.error({ title: '打开失败', message: result?.error || '无法打开目录' })
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '无法打开目录'
    ElNotification.error({ title: '打开失败', message: msg })
  }
}

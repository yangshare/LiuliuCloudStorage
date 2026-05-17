export const transferRendererService = {
  async list(userId: number) {
    return window.electronAPI.invoke('transfer:v2:list', userId)
  }
}

import { defineStore } from 'pinia'
import { ref } from 'vue'

interface DownloadConfig {
  defaultPath: string
  autoCreateDateFolder: boolean
}

export const useDownloadConfigStore = defineStore('downloadConfig', () => {
  const config = ref<DownloadConfig>({
    defaultPath: '',
    autoCreateDateFolder: false
  })

  async function loadConfig() {
    try {
      const result = await window.electronAPI?.downloadConfig.get()
      if (result) {
        config.value = {
          defaultPath: result.defaultPath,
          autoCreateDateFolder: result.autoCreateDateFolder
        }
      }
    } catch (error) {
      console.error('加载下载配置失败:', error)
    }
  }

  async function updateDefaultPath(path: string) {
    try {
      await window.electronAPI?.downloadConfig.update({ defaultPath: path })
      await loadConfig()
    } catch (error) {
      console.error('更新下载路径失败:', error)
      throw error
    }
  }

  async function updateAutoCreateDateFolder(enabled: boolean) {
    try {
      await window.electronAPI?.downloadConfig.update({ autoCreateDateFolder: enabled })
      await loadConfig()
    } catch (error) {
      console.error('更新自动创建日期文件夹设置失败:', error)
      throw error
    }
  }

  return {
    config,
    loadConfig,
    updateDefaultPath,
    updateAutoCreateDateFolder
  }
})

import {defineStore} from 'pinia'
import {ref} from 'vue'

export const useUpdateStore = defineStore('update', () => {
    const updateAvailable = ref(false)
    const updateDownloaded = ref(false)
    const downloadProgress = ref(0)
    const errorMessage = ref<string | null>(null)
    let initialized = false

    function init() {
        if (initialized) {
            console.warn('[updateStore] init() 已被调用,跳过重复初始化')
            return
        }
        initialized = true

        if (!window.updateAPI) {
            console.warn('[updateStore] window.updateAPI 不存在，跳过更新检查')
            return
        }

        window.updateAPI.onAvailable(() => {
            updateAvailable.value = true
        })

        window.updateAPI.onNotAvailable(() => {
            console.log('[updateStore] 当前已是最新版本')
        })

        window.updateAPI.onDownloadProgress((progress) => {
            downloadProgress.value = progress.percent
        })

        window.updateAPI.onDownloaded(() => {
            updateDownloaded.value = true
        })

        window.updateAPI.onError((message) => {
            errorMessage.value = message
        })

        window.updateAPI.check()
    }

    function installNow() {
        window.updateAPI.installNow()
    }

    function installOnQuit() {
        window.updateAPI.installOnQuit()
    }

    function clearError() {
        errorMessage.value = null
    }

    return {
        updateAvailable,
        updateDownloaded,
        downloadProgress,
        errorMessage,
        init,
        installNow,
        installOnQuit,
        clearError,
    }
})

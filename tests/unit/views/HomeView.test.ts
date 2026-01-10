import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HomeView from '../../../src/renderer/src/views/HomeView.vue'
import { useFileStore } from '../../../src/renderer/src/stores/fileStore'

describe('HomeView - Keyboard Shortcuts', () => {
  beforeEach(() => {
    setActivePinia(createPinia())

    // Mock window.electronAPI
    global.window = {
      electronAPI: {
        file: {
          list: vi.fn().mockResolvedValue({ success: true, data: { content: [], total: 0 } })
        }
      }
    } as any
  })

  it('应该在按下Backspace时调用goUp', async () => {
    const wrapper = mount(HomeView)
    const fileStore = useFileStore()
    const goUpSpy = vi.spyOn(fileStore, 'goUp')

    const event = new KeyboardEvent('keydown', { key: 'Backspace' })
    window.dispatchEvent(event)

    expect(goUpSpy).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('应该在按下Alt+Left时调用goUp', async () => {
    const wrapper = mount(HomeView)
    const fileStore = useFileStore()
    const goUpSpy = vi.spyOn(fileStore, 'goUp')

    const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', altKey: true })
    window.dispatchEvent(event)

    expect(goUpSpy).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('应该在INPUT元素中阻止快捷键触发', async () => {
    const wrapper = mount(HomeView)
    const fileStore = useFileStore()
    const goUpSpy = vi.spyOn(fileStore, 'goUp')

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    const event = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true })
    Object.defineProperty(event, 'target', { value: input, enumerable: true })
    window.dispatchEvent(event)

    expect(goUpSpy).not.toHaveBeenCalled()

    document.body.removeChild(input)
    wrapper.unmount()
  })

  it('应该在TEXTAREA元素中阻止快捷键触发', async () => {
    const wrapper = mount(HomeView)
    const fileStore = useFileStore()
    const goUpSpy = vi.spyOn(fileStore, 'goUp')

    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    textarea.focus()

    const event = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true })
    Object.defineProperty(event, 'target', { value: textarea, enumerable: true })
    window.dispatchEvent(event)

    expect(goUpSpy).not.toHaveBeenCalled()

    document.body.removeChild(textarea)
    wrapper.unmount()
  })
})

import { test as base } from '@playwright/test'
import { electronAPIMock } from './electron-mock'

type TestFixtures = {
  authenticatedUser: void
}

export const test = base.extend<TestFixtures>({
  // 在每个测试前注入 electronAPI mock
  page: async ({ page }, use) => {
    // 在页面加载前注入 mock
    await page.addInitScript(electronAPIMock)
    await use(page)
  },

  authenticatedUser: async ({ page }, use) => {
    await page.goto('http://localhost:5173/#/login')
    await page.waitForLoadState('networkidle')
    await page.getByPlaceholder('请输入用户名').fill('testuser')
    await page.getByPlaceholder('请输入密码').fill('testpass')
    await page.getByRole('button', { name: '登录' }).click()
    await page.waitForURL(/.*#\/$/)
    await use()
  }
})

export { expect } from '@playwright/test'

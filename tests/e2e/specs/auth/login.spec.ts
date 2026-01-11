import { test, expect } from '../../fixtures'

test.describe('用户认证', () => {
  test('[P0] 应该能够使用有效凭据登录', async ({ page }) => {
    // GIVEN: 用户在登录页面
    await page.goto('http://localhost:5173/#/login')

    // WHEN: 用户提交有效凭据
    await page.getByPlaceholder('请输入用户名').fill('testuser')
    await page.getByPlaceholder('请输入密码').fill('testpass')
    await page.getByRole('button', { name: '登录' }).click()

    // THEN: 用户被重定向到主页 (hash 路由格式)
    await expect(page).toHaveURL(/.*#\/$/, { timeout: 10000 })
  })

  test('[P1] 应该显示无效凭据的错误', async ({ page }) => {
    // GIVEN: 用户在登录页面
    await page.goto('http://localhost:5173/#/login')

    // WHEN: 用户提交无效凭据
    await page.getByPlaceholder('请输入用户名').fill('invalid')
    await page.getByPlaceholder('请输入密码').fill('wrong')
    await page.getByRole('button', { name: '登录' }).click()

    // THEN: 显示错误消息
    await expect(page.locator('.n-message')).toBeVisible({ timeout: 5000 })
  })
})

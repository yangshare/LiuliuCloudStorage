import { test, expect } from '../../fixtures'

test.describe('设置页面', () => {
  test('[P2] 应该能够访问设置页面', async ({ page, authenticatedUser }) => {
    // GIVEN: 用户已登录
    await expect(page).toHaveURL(/.*#\/$/)

    // WHEN: 用户访问设置页面
    await page.goto('http://localhost:5173/#/settings')

    // THEN: 应该显示设置页面
    await expect(page.getByText('设置')).toBeVisible({ timeout: 5000 })
  })

  test('[P2] 应该显示开机自启动开关', async ({ page, authenticatedUser }) => {
    // GIVEN: 用户在设置页面
    await page.goto('http://localhost:5173/#/settings')

    // THEN: 应该显示开机自启动选项
    await expect(page.getByText('开机自启动')).toBeVisible()
  })

  test('[P2] 应该显示应用版本', async ({ page, authenticatedUser }) => {
    // GIVEN: 用户在设置页面
    await page.goto('http://localhost:5173/#/settings')

    // THEN: 应该显示应用版本
    await expect(page.getByText('应用版本')).toBeVisible()
  })

  test('[P2] 应该显示平台信息', async ({ page, authenticatedUser }) => {
    // GIVEN: 用户在设置页面
    await page.goto('http://localhost:5173/#/settings')

    // THEN: 应该显示平台信息
    await expect(page.getByText('平台')).toBeVisible()
  })

  test('[P2] 应该显示系统通知开关', async ({ page, authenticatedUser }) => {
    // GIVEN: 用户在设置页面
    await page.goto('http://localhost:5173/#/settings')

    // THEN: 应该显示系统通知选项（使用精确匹配）
    await expect(page.getByText('系统通知', { exact: true })).toBeVisible()
  })
})

import { test, expect } from '../../fixtures'

test.describe('设置页面', () => {
  test('[P2] 应该能够访问设置页面', async ({ page, authenticatedUser }) => {
    // GIVEN: 用户已登录
    await expect(page).toHaveURL(/.*#\/$/)

    // WHEN: 用户访问设置页面
    await page.goto('http://localhost:5173/#/settings')

    // THEN: 应该显示设置页面
    await expect(page.getByText('设置', { exact: true })).toBeVisible({ timeout: 5000 })
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

  test('[P1] 应该显示缓存信息', async ({ page, authenticatedUser }) => {
    // GIVEN: 用户在设置页面
    await page.goto('http://localhost:5173/#/settings')

    // THEN: 应该显示缓存管理区和当前缓存信息
    await expect(page.getByText('缓存管理')).toBeVisible()
    await expect(page.getByText('当前缓存：')).toBeVisible()
    await expect(page.getByText('128 MB')).toBeVisible()
    await expect(page.getByText(/liuliu-cloud-storage\\Cache/)).toBeVisible()
  })

  test('[P1] 应该能够确认并清理缓存', async ({ page, authenticatedUser }) => {
    // GIVEN: 用户在设置页面
    await page.goto('http://localhost:5173/#/settings')
    await expect(page.getByText('128 MB')).toBeVisible()

    // WHEN: 用户点击清理缓存并确认
    await page.getByRole('button', { name: '清理缓存' }).click()
    await expect(page.getByText('当前缓存大小：128 MB')).toBeVisible()
    await page.getByRole('button', { name: '确认清理' }).click()

    // THEN: 应该显示成功提示并刷新缓存大小
    await expect(page.getByText('缓存清理完成！已清理 128 MB，删除 3 个文件')).toBeVisible()
    await expect(page.getByText('0 B')).toBeVisible()
    await expect(page.getByText('刚刚')).toBeVisible()
  })
})

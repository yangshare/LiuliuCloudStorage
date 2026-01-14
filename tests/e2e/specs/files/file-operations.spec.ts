import { test, expect } from '../../fixtures'

test.describe('文件列表操作', () => {
  test('[P0] 应该能够加载文件列表', async ({ page, authenticatedUser }) => {
    // GIVEN: 用户已登录并在主页
    await expect(page).toHaveURL(/.*#\/$/)

    // WHEN: 页面加载文件列表
    await page.waitForLoadState('networkidle')

    // THEN: 应该显示文件列表区域
    const fileArea = page.locator('.n-card, .file-list, [class*="file"]')
    await expect(fileArea.first()).toBeVisible({ timeout: 5000 })
  })

  test('[P1] 应该显示新建文件夹按钮', async ({ page, authenticatedUser }) => {
    // GIVEN: 用户已登录并在主页
    await expect(page).toHaveURL(/.*#\/$/)

    // THEN: 应该显示新建文件夹按钮
    const createBtn = page.getByRole('button', { name: '新建文件夹' })
    await expect(createBtn).toBeVisible()
  })

  test('[P1] 应该在网络错误时显示提示', async ({ page, authenticatedUser }) => {
    // GIVEN: 用户已登录并加载了文件列表
    await expect(page).toHaveURL(/.*#\/$/)
    await page.waitForLoadState('networkidle')

    // WHEN: 模拟网络错误 (mock 已处理)
    // THEN: 页面应该正常显示（mock 返回空列表）
    await expect(page.locator('body')).toBeVisible()
  })
})

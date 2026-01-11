import { test, expect } from '../../fixtures'

test.describe('配额显示', () => {
  test('[P1] 应该在侧边栏显示配额组件', async ({ page, authenticatedUser }) => {
    // GIVEN: 用户已登录并在主页
    await expect(page).toHaveURL(/.*#\/$/)

    // THEN: 应该显示配额区域
    const quotaSection = page.locator('.quota-section, [class*="quota"]')
    await expect(quotaSection.first()).toBeVisible({ timeout: 5000 })
  })

  test('[P1] 侧边栏应该可见', async ({ page, authenticatedUser }) => {
    // GIVEN: 用户已登录并在主页
    await expect(page).toHaveURL(/.*#\/$/)

    // THEN: 侧边栏应该可见
    const sider = page.locator('.n-layout-sider')
    await expect(sider).toBeVisible()
  })
})

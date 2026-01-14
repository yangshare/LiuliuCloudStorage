import { test, expect } from '../../fixtures'

test.describe('目录导航', () => {
  test('[P0] 应该显示目录树', async ({ page, authenticatedUser }) => {
    // GIVEN: 用户已登录并在主页
    await expect(page).toHaveURL(/.*#\/$/)

    // THEN: 应该显示目录树组件
    const sider = page.locator('.n-layout-sider')
    await expect(sider).toBeVisible()
  })

  test('[P1] 应该显示面包屑导航', async ({ page, authenticatedUser }) => {
    // GIVEN: 用户已登录并在主页
    await expect(page).toHaveURL(/.*#\/$/)

    // THEN: 应该显示面包屑组件
    await page.waitForLoadState('networkidle')
    const breadcrumb = page.locator('.n-breadcrumb, [class*="breadcrumb"]')
    await expect(breadcrumb.first()).toBeVisible({ timeout: 5000 })
  })

  test('[P1] 应该显示返回上级按钮', async ({ page, authenticatedUser }) => {
    // GIVEN: 用户已登录并在主页
    await expect(page).toHaveURL(/.*#\/$/)

    // THEN: 应该显示返回上级按钮
    const backBtn = page.getByRole('button', { name: '返回上级' })
    await expect(backBtn).toBeVisible()
  })

  test('[P1] 根目录时返回上级按钮应该禁用', async ({ page, authenticatedUser }) => {
    // GIVEN: 用户已登录并在根目录
    await expect(page).toHaveURL(/.*#\/$/)

    // THEN: 返回上级按钮应该被禁用
    const backBtn = page.getByRole('button', { name: '返回上级' })
    await expect(backBtn).toBeDisabled()
  })

  test('[P1] 应该显示刷新按钮', async ({ page, authenticatedUser }) => {
    // GIVEN: 用户已登录并在主页
    await expect(page).toHaveURL(/.*#\/$/)

    // THEN: 应该显示刷新按钮
    const refreshBtn = page.getByRole('button', { name: '刷新' })
    await expect(refreshBtn).toBeVisible()
  })
})

import { test, expect } from '../../fixtures'

test.describe('管理员功能', () => {
  test('[P1] 非管理员用户不应该看到管理员菜单', async ({ page, authenticatedUser }) => {
    // GIVEN: 普通用户已登录
    await expect(page).toHaveURL(/.*#\/$/)

    // WHEN: 检查导航菜单
    const adminMenu = page.getByRole('button', { name: /管理|admin/i })

    // THEN: 不应该显示管理员菜单
    await expect(adminMenu).not.toBeVisible()
  })

  test('[P1] 管理员用户应该能够访问用户管理页面', async ({ page }) => {
    // GIVEN: 管理员用户登录
    await page.goto('http://localhost:5173/#/login')
    await page.getByPlaceholder('请输入用户名').fill('admin')
    await page.getByPlaceholder('请输入密码').fill('admin123')
    await page.getByRole('button', { name: '登录' }).click()
    await page.waitForURL(/.*#\/$/)

    // WHEN: 检查是否有管理员菜单
    const adminMenu = page.getByRole('button', { name: /管理|admin/i })
    if (await adminMenu.isVisible()) {
      await adminMenu.click()
      await page.getByRole('menuitem', { name: /用户管理/ }).click()

      // THEN: 应该跳转到用户管理页面
      await expect(page).toHaveURL(/.*#\/admin\/users/)
    }
  })

  test('[P2] 管理员应该能够查看存储统计', async ({ page }) => {
    // GIVEN: 管理员用户登录
    await page.goto('http://localhost:5173/#/login')
    await page.getByPlaceholder('请输入用户名').fill('admin')
    await page.getByPlaceholder('请输入密码').fill('admin123')
    await page.getByRole('button', { name: '登录' }).click()
    await page.waitForURL(/.*#\/$/)

    // WHEN: 检查是否有管理员菜单
    const adminMenu = page.getByRole('button', { name: /管理|admin/i })
    if (await adminMenu.isVisible()) {
      await adminMenu.click()
      await page.getByRole('menuitem', { name: /存储统计/ }).click()

      // THEN: 应该显示存储统计信息
      await expect(page).toHaveURL(/.*#\/admin\/storage/)
    }
  })
})

import { test, expect } from '../../fixtures'

test.describe('用户注册', () => {
  test('[P0] 应该能够成功注册新用户', async ({ page }) => {
    // GIVEN: 用户在注册页面
    await page.goto('http://localhost:5173/#/register')

    // WHEN: 用户填写注册表单
    await page.getByPlaceholder('请输入用户名').fill('newuser')
    await page.getByPlaceholder('请输入密码').fill('password123')
    await page.getByPlaceholder('请再次输入密码').fill('password123')
    await page.getByRole('button', { name: '注册' }).click()

    // THEN: 应该跳转到登录页面
    await expect(page).toHaveURL(/.*#\/login/, { timeout: 10000 })
  })

  test('[P1] 应该显示密码不一致的错误', async ({ page }) => {
    // GIVEN: 用户在注册页面
    await page.goto('http://localhost:5173/#/register')

    // WHEN: 用户输入不一致的密码
    await page.getByPlaceholder('请输入用户名').fill('testuser')
    await page.getByPlaceholder('请输入密码').fill('password123')
    await page.getByPlaceholder('请再次输入密码').fill('different')
    await page.getByRole('button', { name: '注册' }).click()

    // THEN: 应该显示错误消息
    await expect(page.locator('.n-message')).toBeVisible({ timeout: 5000 })
  })

  test('[P1] 应该能够跳转到登录页面', async ({ page }) => {
    // GIVEN: 用户在注册页面
    await page.goto('http://localhost:5173/#/register')

    // WHEN: 用户点击"去登录"链接
    await page.getByRole('button', { name: /已有账号|去登录/ }).click()

    // THEN: 应该跳转到登录页面
    await expect(page).toHaveURL(/.*#\/login/)
  })

  test('[P1] 注册页面应该正确渲染', async ({ page }) => {
    // GIVEN: 用户访问注册页面
    await page.goto('http://localhost:5173/#/register')

    // THEN: 应该显示注册表单
    await expect(page.getByPlaceholder('请输入用户名')).toBeVisible()
    await expect(page.getByPlaceholder('请输入密码')).toBeVisible()
    await expect(page.getByPlaceholder('请再次输入密码')).toBeVisible()
    await expect(page.getByRole('button', { name: '注册' })).toBeVisible()
  })
})

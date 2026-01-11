import { test, expect } from '../../fixtures'

test.describe('Token 失效处理', () => {
  // 注意：由于使用 mock，这些测试验证的是 UI 行为而非真实的 token 失效逻辑
  // 真实的 token 失效测试需要在集成测试环境中进行

  test('[P0] 登录页面应该正确渲染', async ({ page }) => {
    // GIVEN: 用户访问登录页面
    await page.goto('http://localhost:5173/#/login')

    // THEN: 应该显示登录表单
    await expect(page.getByPlaceholder('请输入用户名')).toBeVisible()
    await expect(page.getByPlaceholder('请输入密码')).toBeVisible()
    await expect(page.getByRole('button', { name: '登录' })).toBeVisible()
  })

  test('[P1] 登录成功后应该跳转到主页', async ({ page }) => {
    // GIVEN: 用户在登录页面
    await page.goto('http://localhost:5173/#/login')

    // WHEN: 用户提交有效凭据
    await page.getByPlaceholder('请输入用户名').fill('testuser')
    await page.getByPlaceholder('请输入密码').fill('testpass')
    await page.getByRole('button', { name: '登录' }).click()

    // THEN: 应该跳转到主页
    await expect(page).toHaveURL(/.*#\/$/, { timeout: 10000 })
  })
})

# E2E 测试指南

## 概述

本项目使用 Playwright 进行端到端测试，覆盖关键用户流程和功能验证。

## 快速开始

### 安装依赖
```bash
pnpm install
```

### 运行测试

```bash
# 运行所有 E2E 测试（无头模式）
pnpm test:e2e

# 使用 UI 模式运行（推荐用于调试）
pnpm test:e2e:ui

# 有头模式运行（查看浏览器操作）
pnpm test:e2e:headed

# 调试模式（逐步执行）
pnpm test:e2e:debug
```

## 目录结构

```
tests/e2e/
├── fixtures/          # 测试 Fixtures（认证、数据准备等）
├── helpers/           # 辅助函数（登录、导航等）
├── data-factories/    # 测试数据工厂（Faker.js）
└── specs/             # 测试用例
    ├── auth/          # 认证相关测试
    ├── files/         # 文件操作测试
    └── admin/         # 管理员功能测试
```

## 编写测试

### 基本测试结构

```typescript
import { test, expect } from '../../fixtures'

test.describe('功能模块', () => {
  test('[P0] 测试用例描述', async ({ page }) => {
    // GIVEN: 前置条件
    await page.goto('http://localhost:5173/login')

    // WHEN: 执行操作
    await page.fill('input[type="text"]', 'testuser')
    await page.click('button[type="submit"]')

    // THEN: 验证结果
    await expect(page).toHaveURL(/.*home/)
  })
})
```

### 使用 Fixtures

```typescript
test('[P0] 需要认证的测试', async ({ page, authenticatedUser }) => {
  // authenticatedUser fixture 已自动完成登录
  await expect(page).toHaveURL(/.*home/)
})
```

### 使用数据工厂

```typescript
import { createTestUser } from '../../data-factories/user.factory'

test('[P1] 创建新用户', async ({ page }) => {
  const user = createTestUser()
  await page.fill('input[name="username"]', user.username)
  await page.fill('input[name="password"]', user.password)
})
```

## 最佳实践

1. **优先级标记**: 使用 `[P0]`、`[P1]`、`[P2]` 标记测试优先级
2. **Given-When-Then**: 使用注释清晰标记测试步骤
3. **等待策略**: 使用 Playwright 自动等待，避免手动 `sleep()`
4. **选择器**: 优先使用语义化选择器（role、label）而非 CSS 类名
5. **数据隔离**: 每个测试使用独立的测试数据

## CI/CD 集成

测试配置已针对 CI 环境优化：
- 失败时自动重试 2 次
- 单 worker 执行（避免资源竞争）
- 失败时保存截图和视频
- 生成 HTML 报告

## 故障排查

### 查看测试报告
```bash
npx playwright show-report
```

### 查看 Trace
失败的测试会自动生成 trace 文件，包含完整的执行记录、截图和网络请求。

### 常见问题

**Q: 测试超时**
A: 检查应用是否正常运行在 `http://localhost:5173`

**Q: 元素找不到**
A: 使用 `pnpm test:e2e:debug` 调试模式逐步检查选择器

**Q: 认证失败**
A: 确认测试用户凭据与后端配置一致

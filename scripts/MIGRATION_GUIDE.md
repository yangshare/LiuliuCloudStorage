# Naive UI → Element Plus 批量迁移脚本

## 📋 概述

自动化迁移脚本，批量将项目中的Naive UI组件替换为Element Plus组件。

## ✨ 功能

- ✅ 自动扫描所有Vue文件
- ✅ 替换组件导入语句
- ✅ 替换模板中的组件标签
- ✅ 替换Hooks调用（useMessage, useDialog等）
- ✅ 替换组件属性
- ✅ 替换图标引用
- ✅ 生成详细迁移报告

## 🚀 使用方法

### 1. 安装依赖

```bash
cd LiuliuCloudStorage
pnpm add -D glob
```

### 2. 运行迁移脚本

```bash
node scripts/migrate-to-element-plus.js
```

### 3. 查看迁移报告

脚本运行后会生成 `migration-report.json`，包含：
- 迁移文件统计
- 每个文件的变更详情
- 错误列表

## ⚙️ 支持的组件映射

| Naive UI | Element Plus | 说明 |
|----------|--------------|------|
| NButton | ElButton | 按钮组件 |
| NInput | ElInput | 输入框 |
| NCard | ElCard | 卡片 |
| NTable | ElTable | 表格 |
| NForm | ElForm | 表单 |
| NModal | ElDialog | 对话框 |
| NMessage | ElMessage | 消息提示 |
| NDialog | ElMessageBox | 对话框 |
| NIcon | ElIcon | 图标 |
| ... | ... | 更多见脚本 |

## ⚠️ 迁移后需要手动处理

### 1. 属性调整

某些组件的属性需要手动调整：

```vue
<!-- Naive UI -->
<n-input v-model:value="text" />
<n-button text>点击</n-button>
<n-button block>按钮</n-button>

<!-- Element Plus -->
<el-input v-model="text" />
<el-button link>点击</el-button>
<el-button style="width: 100%">按钮</el-button>
```

### 2. 布局调整

NSpace需要用div+flex替代：

```vue
<!-- Naive UI -->
<n-space vertical>
  <n-button>按钮1</n-button>
  <n-button>按钮2</n-button>
</n-space>

<!-- Element Plus -->
<div class="space-vertical">
  <el-button>按钮1</el-button>
  <el-button>按钮2</el-button>
</div>

<style>
.space-vertical {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
```

### 3. API差异

某些组件的API有较大差异，需要手动调整：

- **NTable → ElTable**: 列定义方式不同
- **NTree → ElTree**: 数据格式可能需要适配
- **NSteps → ElSteps**: active属性索引从0开始而非1

### 4. 全局API

Naive UI的hooks需要改为Element Plus全局API：

```typescript
// Naive UI
const message = useMessage()
message.success('成功')

// Element Plus
ElMessage.success('成功')
```

### 5. 图标

Naive UI使用@vicons/ionicons5，Element Plus使用@element-plus/icons-vue：

```vue
<!-- Naive UI -->
<n-icon><CloudUploadOutline /></n-icon>

<!-- Element Plus -->
<el-icon><CloudUpload /></el-icon>
```

### 6. 样式差异

某些样式可能需要微调：

- 间距系统不同
- 圆角大小不同
- 颜色变量名称不同

## 🔧 手动检查清单

迁移完成后，请逐个检查以下页面和组件：

### 页面
- [ ] LoginView.vue
- [ ] RegisterView.vue
- [ ] OnboardingView.vue
- [ ] SettingsView.vue
- [ ] HomeView.vue ⚠️ **复杂，重点检查**
- [ ] AdminView.vue
- [ ] 所有管理页面

### 共享组件
- [ ] FileList.vue ⚠️ **表格组件**
- [ ] DirectoryTree.vue ⚠️ **树组件**
- [ ] 所有Transfer组件
- [ ] 所有Dialog/Modal组件
- [ ] 所有Form组件

## 🐛 常见问题

### Q1: TypeScript类型错误

**A**: 运行 `pnpm run dev` 查看具体错误，根据提示调整组件属性。

### Q2: 样式错乱

**A**: 检查是否需要调整CSS，Element Plus的默认样式可能与Naive UI不同。

### Q3: 组件找不到

**A**: 检查组件名拼写，Element Plus使用`el-`前缀。

### Q4: 图标不显示

**A**: 确保安装了 `@element-plus/icons-vue`，并且图标名称正确（移除了Outline等后缀）。

## 📞 需要帮助？

迁移脚本可以处理大部分工作，但某些复杂场景需要手动调整。

如果遇到问题，请参考：
- [Element Plus官方文档](https://element-plus.org/zh-CN/)
- [组件对照表](https://github.com/Winner2021/Element-Plus/blob/dev/CHANGELOG.md)

## ✅ 完成检查

迁移完成后，请执行以下检查：

1. **编译检查**
   ```bash
   pnpm run build
   ```

2. **类型检查**
   ```bash
   pnpm run test
   ```

3. **功能测试**
   - 启动应用：`pnpm run dev`
   - 逐个测试所有页面和功能
   - 验证表单提交、文件操作等

4. **视觉检查**
   - 检查所有页面的布局
   - 验证组件间距和对齐
   - 确认颜色和主题一致性

## 🎯 下一步

迁移完成后，不要忘记：

1. 更新 `project-context.md` 中的UI框架说明
2. 移除 `package.json` 中的 `naive-ui` 和 `@vicons/ionicons5` 依赖
3. 提交代码到Git
4. 更新架构文档

---

**祝迁移顺利！** 🎉

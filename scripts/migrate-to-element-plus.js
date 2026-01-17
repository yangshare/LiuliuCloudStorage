/**
 * Naive UI → Element Plus 批量迁移脚本
 *
 * 用法: node scripts/migrate-to-element-plus.js
 */

const fs = require('fs')
const path = require('path')
const { glob } = require('glob')

// 组件映射表
const COMPONENT_MAP = {
  // 布局组件
  'NLayout': 'ElContainer',
  'NLayoutSider': 'ElAside',
  'NLayoutContent': 'ElMain',
  'NLayoutHeader': 'ElHeader',
  'NLayoutFooter': 'ElFooter',

  // 基础组件
  'NButton': 'ElButton',
  'NInput': 'ElInput',
  'NInputNumber': 'ElInputNumber',
  'NSelect': 'ElSelect',
  'NOption': 'ElOption',
  'NCheckbox': 'ElCheckbox',
  'NCheckboxGroup': 'ElCheckboxGroup',
  'NRadio': 'ElRadio',
  'NRadioGroup': 'ElRadioGroup',
  'NSwitch': 'ElSwitch',
  'NSlider': 'ElSlider',
  'NTimePicker': 'ElTimePicker',
  'NDatePicker': 'ElDatePicker',
  'NRate': 'ElRate',
  'NColorPicker': 'ElColorPicker',
  'NTransfer': 'ElTransfer',
  'NForm': 'ElForm',
  'NFormItem': 'ElFormItem',
  'NFormItemCol': 'ElFormItemCol',
  'NFormItemRow': 'ElFormItemRow',

  // 数据展示
  'NTable': 'ElTable',
  'NTableColumn': 'ElTableColumn',
  'NList': 'ElList',
  'NListItem': 'ElListItem',
  'NTree': 'ElTree',
  'NTreeSelect': 'ElTreeSelect',
  'NPagination': 'ElPagination',
  'NBadge': 'ElBadge',
  'NTag': 'ElTag',
  'NProgress': 'ElProgress',
  'NStatistic': 'ElStatistic',
  'NAlert': 'ElAlert',
  'NCard': 'ElCard',
  'NCollapse': 'ElCollapse',
  'NCollapseItem': 'ElCollapseItem',
  'NTabs': 'ElTabs',
  'NTabPane': 'ElTabPane',
  'NDescriptions': 'ElDescriptions',
  'NDescriptionsItem': 'ElDescriptionsItem',
  'NTimeline': 'ElTimeline',
  'NTimelineItem': 'ElTimelineItem',
  'NTooltip': 'ElTooltip',
  'NPopover': 'ElPopover',
  'NPopconfirm': 'ElPopconfirm',
  'NPoptip': 'ElPopover', // Naive UI的NPoptip对应ElPopover

  // 反馈组件
  'NModal': 'ElDialog',
  'NDrawer': 'ElDrawer',
  'NNotification': 'ElNotification',
  'NMessage': 'ElMessage',
  'NDialog': 'ElMessageBox',
  'NLoadingBar': '', // Element Plus没有对应组件
  'NSpin': 'ElLoading', // 用法不同
  'NEmpty': 'ElEmpty',
  'NResult': 'ElResult',
  'NBackTop': 'ElBacktop',

  // 导航组件
  'NMenu': 'ElMenu',
  'NMenuItem': 'ElMenuItem',
  'NMenuGroup': 'ElMenuItemGroup',
  'NSubmenu': 'ElSubmenu',
  'NBreadcrumb': 'ElBreadcrumb',
  'NBreadcrumbItem': 'ElBreadcrumbItem',
  'NDropdown': 'ElDropdown',
  'NDropdownMenu': 'ElDropdownMenu',
  'NSteps': 'ElSteps',
  'NStep': 'ElStep',
  'NPagination': 'ElPagination',

  // 其他组件
  'NIcon': 'ElIcon',
  'NText': 'ElText', // 或直接用span
  'NH1': '', // HTML标签
  'NH2': '',
  'NH3': '',
  'NP': '',
  'NSpace': '', // 用div+flex替代
  'NDivider': 'ElDivider',
  'NAvatar': 'ElAvatar',
  'NImage': 'ElImage',
  'NCarousel': 'ElCarousel',
  'NCarouselItem': 'ElCarouselItem',
  'NCollapseTransition': 'ElCollapseTransition',
  'NScrollbar': 'ElScrollbar',
  'NConfigProvider': '', // 不需要
  'NMessageProvider': '', // 不需要
  'NNotificationProvider': '', // 不需要
  'NDialogProvider': '', // 不需要
  'NGlobalStyle': '', // 不需要
  'NCarousel': 'ElCarousel',
}

// Hooks/API映射
const HOOKS_MAP = {
  'useMessage': 'ElMessage',
  'useDialog': 'ElMessageBox',
  'useNotification': 'ElNotification',
  'useLoadingBar': '', // Element Plus没有对应
}

// 属性映射（需要特殊处理的）
const ATTRIBUTE_MAP = {
  'v-model:value': 'v-model',
  'v-model:checked': 'v-model',
  'v-model:active': 'v-model',
  ':current': ':active', // NSteps -> ElSteps
  'text': 'link', // NButton text属性 -> ElButton link
  'secondary': 'plain', // NButton secondary -> ElButton plain
  'block': 'style="width: 100%"', // NButton block -> style
}

// 图标映射
const ICON_IMPORT_PATTERN = /import\s*{\s*([^}]+)\s*}\s*from\s*['"]@vicons\/ionicons5['"]/g
const ICON_USE_PATTERN = /<n-icon[^>]*>\s*<([^>]+)\s*\/>\s*<\/n-icon>/g

class Migrator {
  constructor() {
    this.srcPath = path.join(__dirname, '../src/renderer/src')
    this.report = {
      totalFiles: 0,
      migratedFiles: 0,
      skippedFiles: 0,
      errors: [],
      changes: []
    }
  }

  /**
   * 执行迁移
   */
  async migrate() {
    console.log('🚀 开始迁移 Naive UI → Element Plus\n')

    // 查找所有Vue文件
    const files = await glob('**/*.vue', { cwd: this.srcPath, ignore: ['node_modules/**'] })
    this.report.totalFiles = files.length

    console.log(`📁 找到 ${files.length} 个Vue文件\n`)

    for (const file of files) {
      await this.migrateFile(file)
    }

    this.printReport()
    this.saveReport()
  }

  /**
   * 迁移单个文件
   */
  async migrateFile(relativePath) {
    const fullPath = path.join(this.srcPath, relativePath)

    let content
    try {
      content = fs.readFileSync(fullPath, 'utf-8')
    } catch (err) {
      this.report.errors.push(`❌ 无法读取文件: ${relativePath} - ${err.message}`)
      return
    }

    const originalContent = content
    let hasChanges = false

    // 检查文件是否使用Naive UI
    if (!content.includes('naive-ui') && !content.includes('from \'naive-ui\'') && !content.includes('from "naive-ui"')) {
      return // 跳过不使用Naive UI的文件
    }

    console.log(`  处理: ${relativePath}`)

    // 1. 替换导入语句
    content = this.replaceImports(content, relativePath)

    // 2. 替换组件标签（template部分）
    content = this.replaceComponents(content)

    // 3. 替换Hooks调用
    content = this.replaceHooks(content)

    // 4. 替换属性
    content = this.replaceAttributes(content)

    // 5. 替换图标
    content = this.replaceIcons(content)

    // 如果有变化，写回文件
    if (content !== originalContent) {
      try {
        fs.writeFileSync(fullPath, content, 'utf-8')
        this.report.migratedFiles++
        hasChanges = true
        console.log(`  ✅ 已迁移: ${relativePath}\n`)

        this.report.changes.push({
          file: relativePath,
          changes: this.getChangeSummary(originalContent, content)
        })
      } catch (err) {
        this.report.errors.push(`❌ 写入失败: ${relativePath} - ${err.message}`)
        this.report.skippedFiles++
      }
    } else {
      this.report.skippedFiles++
      console.log(`  ⏭️  跳过: ${relativePath} (无需更改)\n`)
    }
  }

  /**
   * 替换导入语句
   */
  replaceImports(content, filePath) {
    let modified = content

    // 替换Naive UI组件导入
    const naiveImportRegex = /import\s*{\s*([^}]+)\s*}\s*from\s*['"]naive-ui['"]/g
    modified = modified.replace(naiveImportRegex, (match, imports) => {
      const naiveComponents = imports.split(',').map(s => s.trim())
      const elementImports = []
      const otherImports = []

      for (const comp of naiveComponents) {
        const mapped = COMPONENT_MAP[comp]
        if (mapped) {
          elementImports.push(mapped)
        } else if (HOOKS_MAP[comp]) {
          otherImports.push(`${HOOKS_MAP[comp]}`)
        } else {
          // 未知组件，保留
          otherImports.push(comp)
        }
      }

      let result = []
      if (elementImports.length > 0) {
        result.push(`import { ${elementImports.join(', ')} } from 'element-plus'`)
      }
      if (otherImports.length > 0) {
        result.push(`import { ${otherImports.join(', ')} } from 'element-plus'`)
      }

      return result.length > 0 ? result.join('\n') : '// ' + match
    })

    // 替换@vicons/ionicons5导入
    modified = modified.replace(ICON_IMPORT_PATTERN, (match, icons) => {
      return `import { ${icons} } from '@element-plus/icons-vue'`
    })

    // 移除useMessage等hooks的导入（它们是全局的）
    modified = modified.replace(/import\s*{\s*(useMessage|useDialog|useNotification)\s*[^}]*}\s*from\s*['"]naive-ui['"]\s*\n?/g, '')

    return modified
  }

  /**
   * 替换组件标签
   */
  replaceComponents(content) {
    let modified = content

    // 替换模板中的组件标签
    for (const [naive, element] of Object.entries(COMPONENT_MAP)) {
      if (!element) continue // 跳过没有映射的组件

      // 替换开标签 <n-xxx> -> <el-xxx>
      const kebabNaive = this.toKebabCase(naive)
      const kebabElement = this.toKebabCase(element)

      // 开标签
      modified = modified.replace(new RegExp(`<${kebabNaive}`, 'g'), `<${kebabElement}`)
      // 闭标签
      modified = modified.replace(new RegExp(`</${kebabNaive}`, 'g'), `</${kebabElement}>`)
      // 自闭合标签
      modified = modified.replace(new RegExp(`<${kebabNaive}([^>]*)\\s*/>`, 'g'), `<${kebabElement}$1 />`)
    }

    return modified
  }

  /**
   * 替换Hooks调用
   */
  replaceHooks(content) {
    let modified = content

    // useMessage() -> ElMessage
    modified = modified.replace(/useMessage\(\)/g, 'ElMessage')
    modified = modified.replace(/const\s+message\s*=\s*useMessage\(\)/g, '// ElMessage是全局的，无需声明')

    // useDialog() -> ElMessageBox
    modified = modified.replace(/useDialog\(\)/g, 'ElMessageBox')
    modified = modified.replace(/const\s+dialog\s*=\s*useDialog\(\)/g, '// ElMessageBox是全局的，无需声明')

    // useNotification() -> ElNotification
    modified = modified.replace(/useNotification\(\)/g, 'ElNotification')
    modified = modified.replace(/const\s+notification\s*=\s*useNotification\(\)/g, '// ElNotification是全局的，无需声明')

    return modified
  }

  /**
   * 替换属性
   */
  replaceAttributes(content) {
    let modified = content

    // v-model:value -> v-model
    modified = modified.replace(/v-model:value=/g, 'v-model=')

    // v-model:checked -> v-model (for checkbox/radio)
    modified = modified.replace(/v-model:checked=/g, 'v-model=')

    // :current -> :active (for steps)
    modified = modified.replace(/:current=/g, ':active=')

    // text -> link (for button)
    modified = modified.replace(/(\s+)text(\s|>)/g, '$1link$2')

    // secondary -> plain (for button)
    modified = modified.replace(/(\s+)secondary(\s|>)/g, '$1plain$2')

    // block -> style="width: 100%" (for button)
    modified = modified.replace(/(\s+)block(\s|>)/g, '$1style="width: 100%"$2')

    // NSteps的current属性 -> active，索引从1开始改为从0开始
    modified = modified.replace(/:active="currentStep\s*-\s*1"/g, ':active="currentStep - 1"')

    return modified
  }

  /**
   * 替换图标
   */
  replaceIcons(content) {
    let modified = content

    // <n-icon><XxxOutline /></n-icon> -> <el-icon><Xxx /></el-icon>
    modified = modified.replace(/<n-icon[^>]*>\s*<(\w+)[\s\S]*?\/>\s*<\/n-icon>/g, (match, iconComp) => {
      // 移除Outline等后缀
      const cleanIcon = iconComp.replace(/Outline|Sharp|Filled/g, '')
      return `<el-icon><${cleanIcon} /></el-icon>`
    })

    return modified
  }

  /**
   * 获取变更摘要
   */
  getChangeSummary(original, modified) {
    const changes = []

    if (original.includes('naive-ui') && !modified.includes('naive-ui')) {
      changes.push('移除Naive UI导入')
    }
    if (modified.includes('element-plus') && !original.includes('element-plus')) {
      changes.push('添加Element Plus导入')
    }
    if (modified.includes('@element-plus/icons-vue') && !original.includes('@element-plus/icons-vue')) {
      changes.push('更新图标导入')
    }

    return changes
  }

  /**
   * 转换为kebab-case
   */
  toKebabCase(str) {
    return str.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')
  }

  /**
   * 打印报告
   */
  printReport() {
    console.log('\n' + '='.repeat(60))
    console.log('📊 迁移报告')
    console.log('='.repeat(60))
    console.log(`总文件数: ${this.report.totalFiles}`)
    console.log(`✅ 已迁移: ${this.report.migratedFiles}`)
    console.log(`⏭️  已跳过: ${this.report.skippedFiles}`)
    console.log(`❌ 错误: ${this.report.errors.length}`)
    console.log('='.repeat(60) + '\n')

    if (this.report.changes.length > 0) {
      console.log('📝 迁移详情:\n')
      this.report.changes.forEach(({ file, changes }) => {
        console.log(`  ${file}:`)
        changes.forEach(change => console.log(`    - ${change}`))
      })
      console.log('')
    }

    if (this.report.errors.length > 0) {
      console.log('❌ 错误列表:\n')
      this.report.errors.forEach(err => console.log(`  ${err}`))
      console.log('')
    }
  }

  /**
   * 保存报告到文件
   */
  saveReport() {
    const reportPath = path.join(__dirname, '../migration-report.json')
    fs.writeFileSync(reportPath, JSON.stringify(this.report, null, 2))
    console.log(`📄 报告已保存到: ${reportPath}\n`)
  }
}

// 执行迁移
const migrator = new Migrator()
migrator.migrate().catch(err => {
  console.error('❌ 迁移失败:', err)
  process.exit(1)
})

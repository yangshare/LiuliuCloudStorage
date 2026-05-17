const fs = require('fs')
const path = require('path')

// 注意：顺序很重要！更长的模式（../../）必须在更短的模式（../）之前处理
const replacements = [
  // authStore
  { from: /\.\.\/\.\.\/stores\/authStore/g, to: "@/features/auth" },
  { from: /\.\.\/stores\/authStore/g, to: "@/features/auth" },
  { from: /@\/stores\/authStore/g, to: "@/features/auth" },

  // transferStore
  { from: /\.\.\/\.\.\/stores\/transferStore/g, to: "@/features/transfer" },
  { from: /\.\.\/stores\/transferStore/g, to: "@/features/transfer" },
  { from: /@\/stores\/transferStore/g, to: "@/features/transfer" },

  // fileStore
  { from: /\.\.\/\.\.\/stores\/fileStore/g, to: "@/features/file" },
  { from: /\.\.\/stores\/fileStore/g, to: "@/features/file" },
  { from: /@\/stores\/fileStore/g, to: "@/features/file" },

  // updateStore
  { from: /\.\.\/\.\.\/stores\/updateStore/g, to: "@/features/update" },
  { from: /\.\.\/stores\/updateStore/g, to: "@/features/update" },
  { from: /@\/stores\/updateStore/g, to: "@/features/update" },

  // autoSyncGlobalStore
  { from: /\.\.\/\.\.\/stores\/autoSyncGlobalStore/g, to: "@/features/autoSync" },
  { from: /\.\.\/stores\/autoSyncGlobalStore/g, to: "@/features/autoSync" },
  { from: /@\/stores\/autoSyncGlobalStore/g, to: "@/features/autoSync" },

  // quotaStore
  { from: /\.\.\/\.\.\/stores\/quotaStore/g, to: "@/features/quota" },
  { from: /\.\.\/stores\/quotaStore/g, to: "@/features/quota" },
  { from: /@\/stores\/quotaStore/g, to: "@/features/quota" },

  // downloadConfigStore
  { from: /\.\.\/\.\.\/stores\/downloadConfigStore/g, to: "@/features/downloadConfig" },
  { from: /\.\.\/stores\/downloadConfigStore/g, to: "@/features/downloadConfig" },
  { from: /@\/stores\/downloadConfigStore/g, to: "@/features/downloadConfig" },
]

function walk(dir, callback) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(fullPath, callback)
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.vue'))) {
      callback(fullPath)
    }
  }
}

let updatedCount = 0
walk('src/renderer/src', (filePath) => {
  let content = fs.readFileSync(filePath, 'utf-8')
  const original = content

  for (const r of replacements) {
    content = content.replace(r.from, r.to)
  }

  // 修复上一轮误替换产生的 ../@/features 模式
  content = content.replace(/\.\.\/(@\/features\/)/g, '$1')

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8')
    console.log('Updated:', filePath)
    updatedCount++
  }
})

console.log(`\nDone. ${updatedCount} files updated.`)

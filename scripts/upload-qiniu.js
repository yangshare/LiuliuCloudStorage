#!/usr/bin/env node

/**
 * 七牛上传脚本 — 上传 Windows 自动更新必需文件到固定目录
 *
 * 用法：
 *   node scripts/upload-qiniu.js [版本号] [dist目录]
 *
 * 示例：
 *   node scripts/upload-qiniu.js dist
 *   node scripts/upload-qiniu.js .\dist
 *   node scripts/upload-qiniu.js 0.2.0 ./dist
 *   node scripts/upload-qiniu.js 0.2.0 dist   # GitHub Actions 中
 *
 * 本地配置文件（优先）：
 *   .qiniu.local.json
 *
 * 环境变量（兜底，用于 CI）：
 *   QINIU_ACCESS_KEY    七牛 Access Key
 *   QINIU_SECRET_KEY    七牛 Secret Key
 *   QINIU_BUCKET        七牛存储空间名称
 *   QINIU_BUCKET_DOMAIN 七牛空间域名（如 qiniu.yangshare.com）
 *   QINIU_ZONE          七牛存储区域（如 z2）
 */

const path = require('path')
const fs = require('fs')

// ── 配置 ──────────────────────────────────────────────
const REMOTE_PREFIX = 'LiuliuCloudStorage/win/x64'
const LOCAL_CONFIG_PATH = path.resolve(__dirname, '..', '.qiniu.local.json')
const DEFAULT_PART_SIZE_MB = 16
const MIN_PART_SIZE_MB = 1
const MAX_PART_SIZE_MB = 1024
const ZONE_MAP = {
  z0: 'Zone_z0',
  'cn-east-2': 'Zone_cn_east_2',
  cn_east_2: 'Zone_cn_east_2',
  z1: 'Zone_z1',
  z2: 'Zone_z2',
  na0: 'Zone_na0',
  as0: 'Zone_as0'
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  const fixed = value >= 100 || unitIndex === 0 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(fixed)} ${units[unitIndex]}`
}

function createProgressReporter(fileName, totalBytes, options = {}) {
  let lastPercent = -1
  let lastLogTime = 0
  let hasDrawn = false
  const useTTYProgressBar = process.stdout.isTTY && !options.forceLineMode

  return {
    update(uploadedBytes, realTotalBytes) {
      const total = realTotalBytes || totalBytes || 0
      const percent = total > 0 ? Math.min(100, Math.floor((uploadedBytes / total) * 100)) : 0
      const now = Date.now()
      const shouldRender = percent !== lastPercent && (percent === 100 || now - lastLogTime >= 120)

      if (!shouldRender) {
        return
      }

      lastPercent = percent
      lastLogTime = now

      const uploadedText = formatFileSize(uploadedBytes)
      const totalText = formatFileSize(total)

      if (useTTYProgressBar) {
        const barWidth = 24
        const filled = Math.min(barWidth, Math.round((percent / 100) * barWidth))
        const bar = `${'='.repeat(filled)}${'-'.repeat(barWidth - filled)}`
        process.stdout.write(`\r  进度: [${bar}] ${String(percent).padStart(3, ' ')}% ${uploadedText} / ${totalText}`)
      } else {
        console.log(`  进度(${fileName}): ${percent}% (${uploadedText} / ${totalText})`)
      }

      hasDrawn = true
    },
    finish() {
      if (hasDrawn && useTTYProgressBar) {
        process.stdout.write('\n')
      }
    },
    fail() {
      if (hasDrawn && useTTYProgressBar) {
        process.stdout.write('\n')
      }
    }
  }
}

function parseBooleanEnv(name, defaultValue) {
  const raw = process.env[name]
  if (raw === undefined) {
    return { value: defaultValue, fromEnv: false }
  }

  const normalized = String(raw).trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return { value: true, fromEnv: true }
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return { value: false, fromEnv: true }
  }

  console.error(`${name} 的值无效：${raw}`)
  console.error('可选值：true/false、1/0、yes/no、on/off')
  process.exit(1)
}

function parsePartSizeMb() {
  const raw = process.env.QINIU_PART_SIZE_MB
  if (raw === undefined || raw === '') {
    return { value: DEFAULT_PART_SIZE_MB, fromEnv: false }
  }

  const value = Number.parseInt(raw, 10)
  if (!Number.isInteger(value) || value < MIN_PART_SIZE_MB || value > MAX_PART_SIZE_MB) {
    console.error(`QINIU_PART_SIZE_MB 的值无效：${raw}`)
    console.error(`允许范围：${MIN_PART_SIZE_MB} - ${MAX_PART_SIZE_MB}（单位 MB）`)
    process.exit(1)
  }

  return { value, fromEnv: true }
}

function resolveUploadTuning() {
  const accelerate = parseBooleanEnv('QINIU_ACCELERATE_UPLOADING', true)
  const partSize = parsePartSizeMb()

  return {
    accelerateUploading: accelerate.value,
    accelerateUploadingFromEnv: accelerate.fromEnv,
    partSizeMb: partSize.value,
    partSizeBytes: partSize.value * 1024 * 1024
  }
}

function readLocalConfig() {
  if (!fs.existsSync(LOCAL_CONFIG_PATH)) {
    return null
  }

  try {
    const content = fs.readFileSync(LOCAL_CONFIG_PATH, 'utf8')
    const parsed = JSON.parse(content)
    return {
      accessKey: parsed.accessKey,
      secretKey: parsed.secretKey,
      bucket: parsed.bucket,
      bucketDomain: parsed.bucketDomain,
      zone: parsed.zone
    }
  } catch (error) {
    console.error(`读取本地七牛配置失败: ${LOCAL_CONFIG_PATH}`)
    console.error(error.message)
    process.exit(1)
  }
}

function readEnvConfig() {
  return {
    accessKey: process.env.QINIU_ACCESS_KEY,
    secretKey: process.env.QINIU_SECRET_KEY,
    bucket: process.env.QINIU_BUCKET,
    bucketDomain: process.env.QINIU_BUCKET_DOMAIN,
    zone: process.env.QINIU_ZONE
  }
}

function loadQiniuConfig() {
  const localConfig = readLocalConfig()
  const config = localConfig || readEnvConfig()
  const missing = Object.entries({
    accessKey: config.accessKey,
    secretKey: config.secretKey,
    bucket: config.bucket,
    bucketDomain: config.bucketDomain,
    zone: config.zone
  })
    .filter(([, value]) => !value)
    .map(([key]) => key)

  if (missing.length > 0) {
    if (localConfig) {
      console.error(`本地七牛配置文件缺少字段: ${missing.join(', ')}`)
      console.error(`配置文件路径: ${LOCAL_CONFIG_PATH}`)
    } else {
      console.error(`缺少必需的环境变量: ${missing.map((key) => `QINIU_${key.replace(/[A-Z]/g, (s) => `_${s}`).toUpperCase()}`).join(', ')}`)
      console.error('请设置环境变量，或创建本地配置文件 .qiniu.local.json 后重试')
    }
    process.exit(1)
  }

  return {
    ...config,
    source: localConfig ? 'local-file' : 'env'
  }
}

function resolveZone(qiniu, zone) {
  return qiniu.zone[ZONE_MAP[zone] || zone] || null
}

// ── 参数解析 ───────────────────────────────────────────
function isLikelyPath(value) {
  return value === 'dist' || value === './dist' || value === '.\\dist' || value.includes('/') || value.includes('\\')
}

function readVersionFromLatestYml(distDir) {
  const latestYmlPath = findFile(distDir, 'latest.yml')
  if (!latestYmlPath) return null

  const content = fs.readFileSync(latestYmlPath, 'utf8')
  const match = content.match(/^version:\s*['"]?(.+?)['"]?\s*$/m)
  return match ? match[1].trim() : null
}

function parseArgs() {
  let version = process.argv[2]
  let distArg = process.argv[3]

  if (!distArg && version && isLikelyPath(version)) {
    distArg = version
    version = undefined
  }

  const distDir = path.resolve(distArg || path.resolve(__dirname, '..', 'dist'))

  if (!version) {
    version = readVersionFromLatestYml(distDir) || undefined
  }

  if (!version) {
    console.error('无法确定版本号。请传入版本号，或确保 dist/latest.yml 中包含 version 字段。')
    console.error('用法: node scripts/upload-qiniu.js [版本号] [dist目录]')
    process.exit(1)
  }

  return { version, distDir: path.resolve(distDir) }
}

// ── 查找文件（支持嵌套目录） ────────────────────────────
function findFile(dir, filename) {
  // 先在 dist 根目录找
  const direct = path.join(dir, filename)
  if (fs.existsSync(direct)) return direct

  // 再在子目录中找（GitHub Actions download-artifact 可能多嵌套一层）
  const subDirs = fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory())
  for (const sub of subDirs) {
    const candidate = path.join(dir, sub.name, filename)
    if (fs.existsSync(candidate)) return candidate
  }

  return null
}

// ── 本地文件检查 ──────────────────────────────────────
function checkLocalFiles(version, distDir) {
  const exeName = `LiuliuCloudStorage-Setup-${version}.exe`
  const fileDefs = [
    { name: exeName, pattern: exeName },
    { name: `${exeName}.blockmap`, pattern: `${exeName}.blockmap` },
    { name: 'latest.yml', pattern: 'latest.yml' },
  ]

  const files = []
  const missing = []

  for (const def of fileDefs) {
    const local = findFile(distDir, def.pattern)
    if (local) {
      files.push({ name: def.name, local })
    } else {
      missing.push(def.pattern)
    }
  }

  if (missing.length > 0) {
    console.error(`在 ${distDir} 中找不到以下文件：`)
    missing.forEach((f) => console.error(`  ${f}`))
    process.exit(1)
  }

  return files
}

function createUploader(qiniu, zone, accelerateUploading) {
  const config = new qiniu.conf.Config({
    useHttpsDomain: true,
    accelerateUploading
  })
  config.zone = resolveZone(qiniu, zone)
  if (!config.zone) {
    console.error(`无效的 zone: ${zone}，可选值：z0(华东) z1(华北) z2(华南) na0(北美) as0(东南亚)`)
    process.exit(1)
  }

  return new qiniu.resume_up.ResumeUploader(config)
}

function splitUploadFiles(files) {
  const metadataFile = files.find((file) => file.name === 'latest.yml')
  const binaryFiles = files.filter((file) => file.name !== 'latest.yml')

  if (!metadataFile) {
    console.error('缺少 latest.yml，无法继续上传自动更新文件')
    process.exit(1)
  }

  return { binaryFiles, metadataFile }
}

async function uploadSingleFile(qiniu, uploader, mac, bucket, bucketDomain, file, options = {}) {
  const key = `${REMOTE_PREFIX}/${file.name}`
  const fileSize = fs.statSync(file.local).size
  const progressReporter = createProgressReporter(file.name, fileSize, {
    forceLineMode: options.forceLineMode
  })
  const putExtra = qiniu.resume_up.PutExtra.create()
  putExtra.partSize = options.partSizeBytes
  putExtra.progressCallback = (uploadedBytes, totalBytes) => {
    progressReporter.update(uploadedBytes, totalBytes)
  }

  console.log(`上传中: ${file.name} → ${key}`)

  try {
    await new Promise((resolve, reject) => {
      const token = new qiniu.rs.PutPolicy({ scope: `${bucket}:${key}` }).uploadToken(mac)
      uploader.putFileV2(token, key, file.local, putExtra, (err, body, info) => {
        if (err) return reject(err)
        if (!info || info.statusCode !== 200) {
          return reject(new Error(`上传失败 (${info ? info.statusCode : 'unknown'}): ${JSON.stringify(body)}`))
        }
        resolve(body)
      })
    })
    progressReporter.update(fileSize, fileSize)
    progressReporter.finish()
    console.log(`  完成: https://${bucketDomain}/${key}`)
  } catch (err) {
    progressReporter.fail()
    throw new Error(`${file.name}: ${err.message}`)
  }
}

// ── 主流程 ────────────────────────────────────────────
async function main() {
  const qiniuConfig = loadQiniuConfig()
  const { version, distDir } = parseArgs()
  const tuning = resolveUploadTuning()

  console.log(`版本号: ${version}`)
  console.log(`dist 目录: ${distDir}`)
  console.log(`七牛配置来源: ${qiniuConfig.source === 'local-file' ? '.qiniu.local.json' : '环境变量'}`)

  const files = checkLocalFiles(version, distDir)
  console.log('本地文件检查通过')

  const qiniu = require('qiniu')

  const { accessKey, secretKey, bucket, bucketDomain, zone } = qiniuConfig

  console.log(`Bucket: ${bucket}`)
  console.log(`上传加速: ${tuning.accelerateUploading ? '开启' : '关闭'}${tuning.accelerateUploadingFromEnv ? '（来自环境变量）' : '（默认）'}`)
  console.log(`分片大小: ${tuning.partSizeMb} MB`)

  const mac = new qiniu.auth.digest.Mac(accessKey, secretKey)
  const uploader = createUploader(qiniu, zone, tuning.accelerateUploading)
  const { binaryFiles, metadataFile } = splitUploadFiles(files)

  try {
    console.log('并发上传二进制文件：安装包和 blockmap')
    await Promise.all(binaryFiles.map((file) =>
      uploadSingleFile(qiniu, uploader, mac, bucket, bucketDomain, file, {
        partSizeBytes: tuning.partSizeBytes,
        forceLineMode: true
      })
    ))

    console.log('上传更新元数据：latest.yml')
    await uploadSingleFile(qiniu, uploader, mac, bucket, bucketDomain, metadataFile, {
      partSizeBytes: tuning.partSizeBytes
    })
  } catch (err) {
    console.error(`  失败: ${err.message}`)
    console.error('上传中断，请修复后重新运行')
    process.exit(1)
  }

  console.log('')
  console.log('全部上传完成！')
}

main().catch((err) => {
  console.error('脚本异常:', err.message)
  process.exit(1)
})

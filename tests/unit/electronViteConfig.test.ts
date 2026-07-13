import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('Electron Vite 配置', () => {
  it('主进程应将日志依赖打进 bundle，避免生产包启动时缺少 Winston 传递依赖', () => {
    const configSource = readFileSync(resolve(process.cwd(), 'electron.vite.config.ts'), 'utf-8')

    expect(configSource).toMatch(/externalizeDepsPlugin\(\{\s*exclude:\s*\[[^\]]*['"]winston['"]/s)
    expect(configSource).toMatch(/externalizeDepsPlugin\(\{\s*exclude:\s*\[[^\]]*['"]winston-daily-rotate-file['"]/s)
  })

  it('主进程应外置 moment，避免 file-stream-rotator 打包后拿到不可调用的 namespace 对象', () => {
    const configSource = readFileSync(resolve(process.cwd(), 'electron.vite.config.ts'), 'utf-8')

    expect(configSource).toMatch(/external:\s*\[[^\]]*['"]moment['"]/s)
  })

  it('外置的 moment 应声明为生产依赖，确保 Electron 运行时可以解析', () => {
    const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8'))

    expect(packageJson.dependencies).toHaveProperty('moment')
  })
})

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron'
import path from 'path'

export default defineConfig({
  plugins: [
    vue(),
    electron([
      {
        // 主进程入口文件
        entry: 'src/main/index.ts',
        onstart({ startup }) {
          startup()
        },
        vite: {
          build: {
            outDir: 'dist-electron/main',
            rollupOptions: {
              external: ['better-sqlite3']
            }
          }
        }
      },
      {
        // 预加载脚本
        entry: 'src/preload/index.ts',
        onstart({ reload }) {
          reload()
        },
        vite: {
          build: {
            outDir: 'dist-electron/preload'
          }
        }
      }
    ])
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@main': path.resolve(__dirname, 'src/main'),
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared')
    }
  },
  server: {
    port: 5173
  }
})

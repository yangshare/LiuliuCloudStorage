import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['winston', 'winston-daily-rotate-file'] })],
    build: {
      outDir: 'dist-electron/main',
      rollupOptions: {
        external: ['better-sqlite3', 'moment']
      }
    },
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared')
      }
    }
  },
  preload: {
    build: {
      outDir: 'dist-electron/preload'
    },
    plugins: [],
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared')
      }
    }
  },
  renderer: {
    build: {
      outDir: 'dist-electron/renderer',
      rollupOptions: {
        input: 'src/renderer/index.html'
      }
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer/src'),
        '@shared': resolve(__dirname, 'src/shared')
      }
    },
    plugins: [vue()],
    server: {
      hmr: true
    }
  }
})

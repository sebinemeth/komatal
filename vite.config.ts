import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import ui from '@nuxt/ui/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [
    vue(),
    ui({
      // Bundle the Lucide icons used in templates, so no icon API is called at runtime.
      icon: { clientBundle: { scan: true } },
      ui: {
        colors: { primary: 'terracotta', neutral: 'stone' },
      },
    }),
  ],
  build: { chunkSizeWarningLimit: 900 },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})

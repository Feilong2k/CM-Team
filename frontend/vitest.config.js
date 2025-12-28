import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

console.log('Vitest config loaded')

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        resources: 'usable',
      },
    },
    setupFiles: ['./vitest.setup.js'],
    environmentMatchGlobs: [
      ['**/TraceDashboard.spec.js', 'jsdom']
    ],
  },
})

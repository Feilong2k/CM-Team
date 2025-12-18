import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  server: {
    port: parseInt(process.env.VITE_PORT) || 6100,
    strictPort: false, // Allow port to be changed if busy
    proxy: {
      '/api': {
        target: 'http://localhost:3500',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})

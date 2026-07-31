import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  base: '/', // Root path for custom domain
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    minify: 'terser',
    terserOptions: {
      compress: {
        // Remove console.log, console.debug, console.info in production
        // Keep console.error, console.warn for debugging
        drop_console: ['log', 'debug', 'info'],
        drop_debugger: true
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, './src')
    }
  },
  define: {
    global: 'globalThis'
  },
  optimizeDeps: {
    include: ['@azure/msal-browser']
  }
})

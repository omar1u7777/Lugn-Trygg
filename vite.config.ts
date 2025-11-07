import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// Updated: 2025-11-08 - UI folder case-sensitivity fix deployed
export default defineConfig({
  plugins: [react({
    jsxRuntime: 'automatic', // Use new JSX transform to avoid needing React import for JSX
  })],
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
  server: {
    port: 3000,
    host: true,
  },
})
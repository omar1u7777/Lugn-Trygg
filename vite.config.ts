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
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Put React and React-DOM in the vendor chunk that loads first
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'react-core';
          }
          // Put Chart.js in its own chunk AFTER React
          if (id.includes('node_modules/chart.js') || id.includes('node_modules/react-chartjs-2')) {
            return 'charts';
          }
          // Put MUI in its own chunk
          if (id.includes('node_modules/@mui/')) {
            return 'mui';
          }
        },
      },
    },
  },
  server: {
    port: 3000,
    host: true,
  },
})
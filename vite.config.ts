import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// Updated: 2025-11-08 - React global availability + Chart.js fix
export default defineConfig({
  plugins: [react({
    jsxRuntime: 'automatic',
  })],
  optimizeDeps: {
    include: ['react', 'react-dom', 'chart.js', 'react-chartjs-2'],
  },
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
          // Critical: React must load first and be in a separate chunk
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'react-vendor';
          }
          // Chart.js loads after React
          if (id.includes('node_modules/chart.js') || id.includes('node_modules/react-chartjs-2')) {
            return 'charts';
          }
          // MUI in its own chunk
          if (id.includes('node_modules/@mui/')) {
            return 'mui';
          }
          // Firebase in its own chunk
          if (id.includes('node_modules/firebase/') || id.includes('node_modules/@firebase/')) {
            return 'firebase';
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
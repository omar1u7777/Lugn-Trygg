import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
// Updated: 2025-11-10 - Fixed root path for index.html resolution
export default defineConfig({
  root: '.', // Explicit root at project level
  plugins: [react({
    jsxRuntime: 'automatic',
  })],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/theme/tokens': path.resolve(__dirname, './src/theme/tokens.ts'),
      '@/theme': path.resolve(__dirname, './src/theme'),
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'chart.js', 'react-chartjs-2', 'recharts', '@mui/x-charts'],
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    chunkSizeWarningLimit: 1000,
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Critical: React must load first and be in a separate chunk
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'react-vendor';
          }
          // All chart libraries in ONE chunk to share React instance
          if (id.includes('node_modules/chart.js') || 
              id.includes('node_modules/react-chartjs-2') ||
              id.includes('node_modules/recharts') ||
              id.includes('node_modules/@mui/x-charts')) {
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
          // Router and i18n together
          if (id.includes('node_modules/react-router') || id.includes('node_modules/react-i18next')) {
            return 'routing';
          }
          // Axios and API utilities
          if (id.includes('node_modules/axios') || id.includes('node_modules/crypto-js')) {
            return 'network';
          }
        },
        // Cache-busting with hashed filenames
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
      },
    },
  },
  server: {
    port: 3000,
    host: true,
  },
})
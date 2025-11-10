import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
// Updated: 2025-11-10 - Fixed root path for index.html resolution
export default defineConfig({
  root: '.', // Explicit root at project level
  plugins: [
    react({
      jsxRuntime: 'automatic',
    }),
  ],
  resolve: {
    dedupe: ['react', 'react-dom'], // Force single React instance across all chunks
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/theme/tokens': path.resolve(__dirname, './src/theme/tokens.ts'),
      '@/theme': path.resolve(__dirname, './src/theme'),
    },
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@mui/material',
      '@mui/icons-material',
      '@emotion/react',
      '@emotion/styled',
      'chart.js',
      'react-chartjs-2',
      'recharts',
      '@mui/x-charts'
    ],
    // Force pre-bundling to create a single ESM bundle
    force: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    chunkSizeWarningLimit: 5000,
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
      },
    },
    // Allow normal code splitting - React is guaranteed available globally via CDN
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'mui-vendor': [
            '@mui/material',
            '@mui/icons-material',
            '@emotion/react',
            '@emotion/styled'
          ],
          'firebase-vendor': [
            'firebase/app',
            'firebase/auth',
            'firebase/firestore',
            'firebase/storage'
          ],
        },
      },
    },
  },
  server: {
    port: 3000,
    host: true,
  },
})
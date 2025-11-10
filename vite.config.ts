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
    minify: 'esbuild',
    chunkSizeWarningLimit: 10000,
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
    // NO external config - it doesn't work for browser builds
    // Accept that we'll have chunks, just make sure app works
    rollupOptions: {},
  },
  server: {
    port: 3000,
    host: true,
  },
})
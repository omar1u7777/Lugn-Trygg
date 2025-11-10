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
    // CRITICAL: Custom plugin to use global React from CDN
    {
      name: 'external-react',
      config() {
        return {
          build: {
            rollupOptions: {
              external: ['react', 'react-dom', 'react/jsx-runtime'],
              output: {
                globals: {
                  react: 'React',
                  'react-dom': 'ReactDOM',
                  'react/jsx-runtime': 'React.jsxRuntime',
                },
              },
            },
          },
        };
      },
    },
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
    target: 'esnext', // Use esnext to prevent Vite's aggressive chunking
    chunkSizeWarningLimit: 5000,
    // CRITICAL: Ensure React is treated as a common dependency
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
    rollupOptions: {
      output: {
        // Keep manual chunks for better caching (React is external)
        manualChunks: {
          'mui-vendor': [
            '@mui/material',
            '@mui/icons-material',
            '@mui/system',
            '@mui/styles',
            '@emotion/react',
            '@emotion/styled'
          ],
          'firebase-vendor': [
            'firebase/app',
            'firebase/auth',
            'firebase/firestore',
            'firebase/storage',
            'firebase/analytics'
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
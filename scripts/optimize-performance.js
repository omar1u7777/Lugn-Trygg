/**
 * Performance Optimization Script for Lugn-Trygg Frontend
 * Analyzes and optimizes bundle size, implements code splitting, lazy loading
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// BUNDLE ANALYSIS
// ============================================

function analyzeBundleSize() {
  console.log('📊 Analyzing bundle size...\n');
  
  const distPath = path.join(__dirname, '..', 'dist', 'assets', 'js');
  
  if (!fs.existsSync(distPath)) {
    console.error('❌ Build not found. Run "npm run build" first.');
    return;
  }
  
  const files = fs.readdirSync(distPath);
  const jsFiles = files.filter(f => f.endsWith('.js'));
  
  const sizes = jsFiles.map(file => {
    const filePath = path.join(distPath, file);
    const stats = fs.statSync(filePath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    return { file, size: stats.size, sizeKB };
  }).sort((a, b) => b.size - a.size);
  
  console.log('📦 JavaScript Bundle Sizes:\n');
  sizes.forEach(({ file, sizeKB }) => {
    const emoji = parseFloat(sizeKB) > 100 ? '🔴' : parseFloat(sizeKB) > 50 ? '🟡' : '🟢';
    console.log(`${emoji} ${file.padEnd(50)} ${sizeKB.padStart(10)} KB`);
  });
  
  const totalSize = sizes.reduce((acc, { size }) => acc + size, 0);
  const totalKB = (totalSize / 1024).toFixed(2);
  const totalMB = (totalSize / (1024 * 1024)).toFixed(2);
  
  console.log('\n' + '='.repeat(65));
  console.log(`📊 Total Bundle Size: ${totalKB} KB (${totalMB} MB)`);
  console.log('='.repeat(65) + '\n');
  
  // Analysis
  if (totalSize > 3 * 1024 * 1024) {
    console.log('⚠️  WARNING: Bundle size exceeds 3 MB!');
    console.log('💡 Recommendations:');
    console.log('   • Implement code splitting');
    console.log('   • Use lazy loading for routes');
    console.log('   • Remove unused dependencies');
    console.log('   • Optimize images and assets\n');
  } else if (totalSize > 1.5 * 1024 * 1024) {
    console.log('🟡 Bundle size is acceptable but could be optimized');
  } else {
    console.log('✅ Bundle size is excellent!');
  }
  
  return { totalSize, files: sizes };
}

// ============================================
// CODE SPLITTING RECOMMENDATIONS
// ============================================

function generateCodeSplittingConfig() {
  console.log('\n📂 Code Splitting Recommendations:\n');
  
  const recommendations = {
    routes: {
      description: 'Lazy load routes using React.lazy()',
      example: `
// Before
import Dashboard from './pages/Dashboard';

// After
const Dashboard = React.lazy(() => import('./pages/Dashboard'));

// Usage in Router
<Suspense fallback={<LoadingSpinner />}>
  <Route path="/dashboard" element={<Dashboard />} />
</Suspense>
      `.trim()
    },
    
    charts: {
      description: 'Lazy load chart libraries (recharts, chart.js)',
      example: `
// Before
import { LineChart } from 'recharts';

// After
const LineChart = React.lazy(() => import('recharts').then(m => ({ default: m.LineChart })));
      `.trim()
    },
    
    mui: {
      description: 'Import MUI components individually',
      example: `
// Before (BAD - imports entire library)
import { Button, TextField, Dialog } from '@mui/material';

// After (GOOD - tree-shakeable)
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
      `.trim()
    },
    
    firebase: {
      description: 'Import only needed Firebase services',
      example: `
// Before (BAD)
import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore';
import 'firebase/storage';

// After (GOOD - modular imports)
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
      `.trim()
    }
  };
  
  Object.entries(recommendations).forEach(([key, { description, example }]) => {
    console.log(`🎯 ${key.toUpperCase()}: ${description}`);
    console.log('```javascript');
    console.log(example);
    console.log('```\n');
  });
}

// ============================================
// VITE CONFIG OPTIMIZATION
// ============================================

function generateOptimizedViteConfig() {
  const config = `
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({
      filename: './dist/stats.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
    })
  ],
  
  build: {
    // Code splitting configuration
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React libraries
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          
          // MUI components
          'mui': ['@mui/material', '@mui/icons-material'],
          
          // Chart libraries
          'charts': ['recharts', 'chart.js', 'react-chartjs-2'],
          
          // Firebase
          'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          
          // Animations
          'animations': ['framer-motion'],
          
          // Analytics
          'analytics': ['amplitude-js', '@sentry/react'],
        },
        
        // Optimize chunk names
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      }
    },
    
    // Minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.debug'],
      }
    },
    
    // Chunk size warnings
    chunkSizeWarningLimit: 500, // Warn if chunk > 500 KB
    
    // Source maps (disable in production for smaller size)
    sourcemap: false,
    
    // CSS code splitting
    cssCodeSplit: true,
  },
  
  // Optimization
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@mui/material',
      'firebase/app',
      'firebase/auth',
    ],
    exclude: ['@testing-library/react']
  },
  
  // Performance
  server: {
    fs: {
      strict: true
    }
  }
});
  `.trim();
  
  console.log('\n⚙️  Optimized Vite Configuration:\n');
  console.log('```javascript');
  console.log(config);
  console.log('```\n');
  
  console.log('💾 Save this as vite.config.optimized.ts\n');
}

// ============================================
// LAZY LOADING IMPLEMENTATION
// ============================================

function generateLazyLoadingExample() {
  const example = `
// src/App.tsx - Implement lazy loading for all routes
import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoadingSpinner from './components/LoadingSpinner';

// Lazy load all page components
const Dashboard = lazy(() => import('./pages/Dashboard'));
const MoodLogger = lazy(() => import('./pages/MoodLogger'));
const Analytics = lazy(() => import('./pages/Analytics'));
const AIChat = lazy(() => import('./pages/AIChat'));
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingSpinner fullScreen />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/mood" element={<MoodLogger />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/chat" element={<AIChat />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
  `.trim();
  
  console.log('\n🚀 Lazy Loading Implementation:\n');
  console.log('```typescript');
  console.log(example);
  console.log('```\n');
}

// ============================================
// IMAGE OPTIMIZATION
// ============================================

function generateImageOptimizationGuide() {
  console.log('\n🖼️  Image Optimization Recommendations:\n');
  
  const recommendations = [
    {
      issue: 'Large unoptimized images',
      solution: 'Use WebP format with fallback to PNG/JPG',
      example: `
<picture>
  <source srcSet="/images/hero.webp" type="image/webp" />
  <img src="/images/hero.jpg" alt="Hero" loading="lazy" />
</picture>
      `.trim()
    },
    {
      issue: 'No lazy loading for images',
      solution: 'Add loading="lazy" attribute to all images',
      example: '<img src="/image.jpg" alt="Description" loading="lazy" />'.trim()
    },
    {
      issue: 'Missing responsive images',
      solution: 'Use srcSet for different screen sizes',
      example: `
<img
  src="/image-800.jpg"
  srcSet="
    /image-400.jpg 400w,
    /image-800.jpg 800w,
    /image-1200.jpg 1200w
  "
  sizes="(max-width: 600px) 400px, (max-width: 1000px) 800px, 1200px"
  alt="Responsive"
  loading="lazy"
/>
      `.trim()
    }
  ];
  
  recommendations.forEach(({ issue, solution, example }) => {
    console.log(`❌ Issue: ${issue}`);
    console.log(`✅ Solution: ${solution}`);
    console.log('```html');
    console.log(example);
    console.log('```\n');
  });
}

// ============================================
// PERFORMANCE BUDGET
// ============================================

function definePerformanceBudget() {
  console.log('\n📏 Performance Budget:\n');
  
  const budget = {
    'Initial Load Time': { target: '< 3s', current: 'TBD', priority: 'CRITICAL' },
    'First Contentful Paint (FCP)': { target: '< 1.8s', current: 'TBD', priority: 'HIGH' },
    'Largest Contentful Paint (LCP)': { target: '< 2.5s', current: 'TBD', priority: 'HIGH' },
    'Time to Interactive (TTI)': { target: '< 3.8s', current: 'TBD', priority: 'MEDIUM' },
    'Total Bundle Size': { target: '< 1.5 MB', current: 'TBD', priority: 'HIGH' },
    'JavaScript Size': { target: '< 1 MB', current: 'TBD', priority: 'HIGH' },
    'CSS Size': { target: '< 200 KB', current: 'TBD', priority: 'MEDIUM' },
    'Images Size': { target: '< 500 KB', current: 'TBD', priority: 'MEDIUM' },
  };
  
  console.log('┌─────────────────────────────────────┬───────────┬──────────┬──────────┐');
  console.log('│ Metric                              │ Target    │ Current  │ Priority │');
  console.log('├─────────────────────────────────────┼───────────┼──────────┼──────────┤');
  
  Object.entries(budget).forEach(([metric, { target, current, priority }]) => {
    const priorityEmoji = priority === 'CRITICAL' ? '🔴' : priority === 'HIGH' ? '🟡' : '🟢';
    console.log(`│ ${metric.padEnd(35)} │ ${target.padEnd(9)} │ ${current.padEnd(8)} │ ${priorityEmoji} ${priority.padEnd(6)} │`);
  });
  
  console.log('└─────────────────────────────────────┴───────────┴──────────┴──────────┘\n');
  
  console.log('💡 To measure current performance:');
  console.log('   1. npm run build');
  console.log('   2. npm run preview');
  console.log('   3. Open Chrome DevTools → Lighthouse');
  console.log('   4. Run Performance Audit\n');
}

// ============================================
// SERVICE WORKER FOR OFFLINE SUPPORT
// ============================================

function generateServiceWorkerConfig() {
  const config = `
// vite-plugin-pwa configuration
import { VitePWA } from 'vite-plugin-pwa';

VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
  manifest: {
    name: 'Lugn-Trygg Mental Health',
    short_name: 'Lugn-Trygg',
    description: 'AI-powered mental health tracking and therapy',
    theme_color: '#6366f1',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png'
      }
    ]
  },
  workbox: {
    runtimeCaching: [
      {
        urlPattern: /^https:\\/\\/api\\.lugn-trygg\\.se\\/.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-cache',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 5 * 60 // 5 minutes
          },
          cacheableResponse: {
            statuses: [0, 200]
          }
        }
      },
      {
        urlPattern: /\\.(?:png|jpg|jpeg|svg|gif|webp)$/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'images-cache',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
          }
        }
      }
    ]
  }
})
  `.trim();
  
  console.log('\n📴 Service Worker Configuration (Offline Support):\n');
  console.log('```javascript');
  console.log(config);
  console.log('```\n');
  
  console.log('📦 Install: npm install -D vite-plugin-pwa\n');
}

// ============================================
// MAIN EXECUTION
// ============================================

function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║   🚀 LUGN-TRYGG PERFORMANCE OPTIMIZATION TOOL                 ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  // 1. Analyze current bundle
  analyzeBundleSize();
  
  // 2. Code splitting recommendations
  generateCodeSplittingConfig();
  
  // 3. Optimized Vite config
  generateOptimizedViteConfig();
  
  // 4. Lazy loading example
  generateLazyLoadingExample();
  
  // 5. Image optimization
  generateImageOptimizationGuide();
  
  // 6. Performance budget
  definePerformanceBudget();
  
  // 7. Service worker config
  generateServiceWorkerConfig();
  
  console.log('\n✅ Performance optimization analysis complete!');
  console.log('\n📋 Next Steps:');
  console.log('   1. Review recommendations above');
  console.log('   2. Implement code splitting for large components');
  console.log('   3. Add lazy loading to routes');
  console.log('   4. Optimize images (WebP, responsive, lazy)');
  console.log('   5. Update vite.config.ts with optimizations');
  console.log('   6. Run Lighthouse audit to measure improvements');
  console.log('   7. Monitor bundle size after each deployment\n');
}

// Run the script
main();

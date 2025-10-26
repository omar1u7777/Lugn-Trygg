import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  return {
    resolve: {
      alias: {
        "@vercel/analytics/react": path.resolve(__dirname, "src/shims/vercel-analytics.tsx"),
        "@vercel/speed-insights/react": path.resolve(__dirname, "src/shims/vercel-speed-insights.tsx"),
      },
    },
    plugins: [], // Image optimization will be handled by the OptimizedImage component
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    server: {
      port: 3000,
      open: false,
      strictPort: false,
      host: true,
      hmr: {
        host: 'localhost',
        port: 3000,
        protocol: 'ws',
      },
      allowedHosts: ['localhost', '127.0.0.1', '192.168.10.154'],
      proxy: {
        "/api": {
          target: "http://localhost:54112",  // Backend-URL till Flask (user specified port)
          changeOrigin: true,
          secure: false,
          ws: true,
        },
      },
    },
    build: {
      outDir: "dist",
      sourcemap: mode === "development",
      target: "esnext",
      cssCodeSplit: true,
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: mode === 'production',
          drop_debugger: mode === 'production',
          pure_funcs: mode === 'production' ? ['console.log', 'console.info', 'console.debug'] : [],
          passes: 2,
        },
        mangle: {
          safari10: true,
        },
      },
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            // Core React chunk - keep small
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              return 'react-core';
            }
            // React ecosystem - combine to reduce chunks
            if (id.includes('node_modules/react-router') ||
                id.includes('node_modules/react-i18next') ||
                id.includes('node_modules/@reduxjs/toolkit') ||
                id.includes('node_modules/react-helmet')) {
              return 'react-ecosystem';
            }
            // Firebase chunk - large, keep separate for caching
            if (id.includes('node_modules/firebase')) {
              return 'firebase';
            }
            // MUI chunk - very large, separate
            if (id.includes('node_modules/@mui') || id.includes('node_modules/@emotion')) {
              return 'mui';
            }
            // Chart libraries - combine recharts and chart.js
            if (id.includes('node_modules/recharts') ||
                id.includes('node_modules/chart.js') ||
                id.includes('node_modules/react-chartjs-2') ||
                id.includes('node_modules/d3')) {
              return 'charts';
            }
            // Animation libraries - combine framer-motion with others
            if (id.includes('node_modules/framer-motion') ||
                id.includes('node_modules/gsap') ||
                id.includes('node_modules/lottie')) {
              return 'animations';
            }
            // Analytics & monitoring - combine all tracking
            if (id.includes('node_modules/amplitude-js') ||
                id.includes('node_modules/@sentry') ||
                id.includes('node_modules/web-vitals') ||
                id.includes('node_modules/@vercel/analytics')) {
              return 'analytics';
            }
            // Utility libraries - combine common utils
            if (id.includes('node_modules/lodash') ||
                id.includes('node_modules/date-fns') ||
                id.includes('node_modules/uuid') ||
                id.includes('node_modules/clsx')) {
              return 'utils';
            }
            // HTTP clients - combine axios and react-query
            if (id.includes('node_modules/axios') ||
                id.includes('node_modules/@tanstack/react-query') ||
                id.includes('node_modules/graphql')) {
              return 'http';
            }
            // Large libraries - separate big ones
            if (id.includes('node_modules/jspdf') ||
                id.includes('node_modules/html2canvas') ||
                id.includes('node_modules/pdfmake')) {
              return 'pdf-tools';
            }
            // Security libraries
            if (id.includes('node_modules/dompurify') ||
                id.includes('node_modules/crypto-js') ||
                id.includes('node_modules/bcryptjs')) {
              return 'security';
            }
            // Image processing
            if (id.includes('node_modules/cloudinary') ||
                id.includes('node_modules/sharp')) {
              return 'images';
            }
          },
        },
      },
    },
    define: {
      "import.meta.env.VITE_BACKEND_URL": JSON.stringify("http://localhost:54112"), // User specified port
    },
  };
});

import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === "production";

export default defineConfig({
  plugins: [react({
    jsxRuntime: 'automatic',
    jsxImportSource: 'react',
    babel: {
      plugins: [],
    },
  })],
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
      host: "localhost",
      port: 3000,
      protocol: "ws",
    },
    allowedHosts: ["localhost", "127.0.0.1", "192.168.10.154"],
    proxy: {
      "/api": {
        target: "http://localhost:54112",
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: !isProduction,
    target: "esnext",
    cssCodeSplit: true,
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: isProduction,
        drop_debugger: isProduction,
        pure_funcs: isProduction ? ["console.log", "console.info", "console.debug"] : [],
        passes: 2,
      },
      mangle: {
        safari10: true,
      },
    },
    assetsDir: "assets",
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const extType = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
            return `assets/images/[name]-[hash][extname]`;
          }
          if (/css/i.test(extType)) {
            return `assets/css/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        manualChunks: (id) => {
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) {
            return "react-core";
          }
          if (
            id.includes("node_modules/react-router") ||
            id.includes("node_modules/react-i18next") ||
            id.includes("node_modules/@reduxjs/toolkit") ||
            id.includes("node_modules/react-helmet")
          ) {
            return "react-ecosystem";
          }
          if (id.includes("node_modules/firebase")) {
            return "firebase";
          }
          if (id.includes("node_modules/@mui") || id.includes("node_modules/@emotion")) {
            return "mui";
          }
          if (
            id.includes("node_modules/recharts") ||
            id.includes("node_modules/chart.js") ||
            id.includes("node_modules/react-chartjs-2") ||
            id.includes("node_modules/d3")
          ) {
            return "charts";
          }
          if (
            id.includes("node_modules/framer-motion") ||
            id.includes("node_modules/gsap") ||
            id.includes("node_modules/lottie")
          ) {
            return "animations";
          }
          if (
            id.includes("node_modules/amplitude-js") ||
            id.includes("node_modules/@sentry") ||
            id.includes("node_modules/web-vitals") ||
            id.includes("node_modules/@vercel/analytics")
          ) {
            return "analytics";
          }
          if (
            id.includes("node_modules/lodash") ||
            id.includes("node_modules/date-fns") ||
            id.includes("node_modules/uuid") ||
            id.includes("node_modules/clsx")
          ) {
            return "utils";
          }
          if (
            id.includes("node_modules/axios") ||
            id.includes("node_modules/@tanstack/react-query") ||
            id.includes("node_modules/graphql")
          ) {
            return "http";
          }
          if (
            id.includes("node_modules/jspdf") ||
            id.includes("node_modules/html2canvas") ||
            id.includes("node_modules/pdfmake")
          ) {
            return "pdf-tools";
          }
          if (
            id.includes("node_modules/dompurify") ||
            id.includes("node_modules/crypto-js") ||
            id.includes("node_modules/bcryptjs")
          ) {
            return "security";
          }
          if (id.includes("node_modules/cloudinary") || id.includes("node_modules/sharp")) {
            return "images";
          }
        },
      },
      external: [],
    },
  },
  define: {
    "import.meta.env.VITE_BACKEND_URL": JSON.stringify("https://lugn-trygg-backend.onrender.com"),
    global: 'globalThis',
  },
});

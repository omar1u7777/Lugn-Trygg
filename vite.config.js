import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import viteCompression from "vite-plugin-compression";
import { visualizer } from "rollup-plugin-visualizer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === "production";
const enableAnalyzer = process.env.ANALYZE === "true";
const devHost = process.env.VITE_DEV_HOST || "0.0.0.0";
const devPort = Number(process.env.VITE_DEV_PORT) || 3000;
const requestHttps = process.env.VITE_DEV_HTTPS === "true";
const defaultAllowedHosts = ["localhost", "127.0.0.1", "192.168.10.154"];
const extraAllowedHosts = process.env.VITE_DEV_ALLOWED_HOSTS
  ? process.env.VITE_DEV_ALLOWED_HOSTS.split(",").map((host) => host.trim()).filter(Boolean)
  : [];
const allowedHosts = Array.from(new Set([...defaultAllowedHosts, ...extraAllowedHosts]));
const dashboardChunkTargets = [
  'src/components/WorldClassDashboard',
  'src/components/AnalyticsDashboard',
  'src/components/PerformanceDashboard',
  'src/components/MonitoringDashboard',
];
const analyticsChunkTargets = [
  'src/components/MoodAnalytics',
  'src/components/WorldClassAnalytics',
];
const normalizeId = (id) => id.split(path.sep).join('/');

const resolveDevHttpsConfig = () => {
  if (!requestHttps) {
    return false;
  }

  const certPath = process.env.VITE_DEV_HTTPS_CERT || path.resolve(__dirname, "certs", "dev-cert.pem");
  const keyPath = process.env.VITE_DEV_HTTPS_KEY || path.resolve(__dirname, "certs", "dev-key.pem");

  try {
    const cert = fs.readFileSync(certPath);
    const key = fs.readFileSync(keyPath);
    console.info(`[Vite] HTTPS enabled for dev server using ${certPath}`);
    return { cert, key };
  } catch (error) {
    console.warn("[Vite] HTTPS requested but certificates not found. Continuing with HTTP.", error?.message || error);
    return false;
  }
};

const https = resolveDevHttpsConfig();
const hmrHost = process.env.VITE_DEV_HMR_HOST || (devHost === "0.0.0.0" ? "localhost" : devHost);
const hmrPort = Number(process.env.VITE_DEV_HMR_PORT) || devPort;
const hmrProtocol = https ? "wss" : "ws";

const plugins = [
  react({
    jsxRuntime: "automatic",
    jsxImportSource: "react",
    babel: {
      plugins: [],
    },
  }),
  viteCompression({
    algorithm: "brotliCompress",
    ext: ".br",
    filter: (file) => /\.(js|css|svg|html|json)$/i.test(file),
    threshold: 1024,
  }),
  viteCompression({
    algorithm: "gzip",
    ext: ".gz",
    filter: (file) => /\.(js|css|svg|html|json)$/i.test(file),
    threshold: 1024,
  }),
];

if (enableAnalyzer) {
  plugins.push(
    visualizer({
      filename: "dist/bundle-report.html",
      template: "treemap",
      gzipSize: true,
      brotliSize: true,
      open: true,
    })
  );
}

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: devPort,
    open: false,
    strictPort: false,
    host: devHost === "0.0.0.0" ? true : devHost,
    https,
    hmr: {
      host: hmrHost,
      port: hmrPort,
      protocol: hmrProtocol,
    },
    allowedHosts,
    proxy: {
      "/api": {
        target: "http://localhost:5001",
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: !isProduction,
    target: ["es2015", "chrome70", "firefox65", "safari12", "edge79"],
    cssCodeSplit: true,
    minify: "terser",
    modulePreload: { polyfill: true },
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
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
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
          const normalizedId = normalizeId(id);
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
          if (dashboardChunkTargets.some((target) => normalizedId.includes(target))) {
            return "dashboard-routes";
          }
          if (analyticsChunkTargets.some((target) => normalizedId.includes(target))) {
            return "analytics-routes";
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

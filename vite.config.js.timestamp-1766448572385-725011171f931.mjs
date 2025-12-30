// vite.config.js
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { defineConfig } from "file:///C:/Projekt/Lugn-Trygg-main_klar/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Projekt/Lugn-Trygg-main_klar/node_modules/@vitejs/plugin-react/dist/index.js";
import viteCompression from "file:///C:/Projekt/Lugn-Trygg-main_klar/node_modules/vite-plugin-compression/dist/index.mjs";
import { visualizer } from "file:///C:/Projekt/Lugn-Trygg-main_klar/node_modules/rollup-plugin-visualizer/dist/plugin/index.js";
var __vite_injected_original_import_meta_url = "file:///C:/Projekt/Lugn-Trygg-main_klar/vite.config.js";
var __dirname = path.dirname(fileURLToPath(__vite_injected_original_import_meta_url));
var isProduction = process.env.NODE_ENV === "production";
var enableAnalyzer = process.env.ANALYZE === "true";
var devHost = process.env.VITE_DEV_HOST || "0.0.0.0";
var devPort = Number(process.env.VITE_DEV_PORT) || 3e3;
var requestHttps = process.env.VITE_DEV_HTTPS === "true";
var defaultAllowedHosts = ["localhost", "127.0.0.1", "192.168.10.154"];
var extraAllowedHosts = process.env.VITE_DEV_ALLOWED_HOSTS ? process.env.VITE_DEV_ALLOWED_HOSTS.split(",").map((host) => host.trim()).filter(Boolean) : [];
var allowedHosts = Array.from(/* @__PURE__ */ new Set([...defaultAllowedHosts, ...extraAllowedHosts]));
var dashboardChunkTargets = [
  "src/components/WorldClassDashboard",
  "src/components/AnalyticsDashboard",
  "src/components/PerformanceDashboard",
  "src/components/MonitoringDashboard"
];
var analyticsChunkTargets = [
  "src/components/MoodAnalytics",
  "src/components/WorldClassAnalytics"
];
var normalizeId = (id) => id.split(path.sep).join("/");
var resolveDevHttpsConfig = () => {
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
var https = resolveDevHttpsConfig();
var hmrHost = process.env.VITE_DEV_HMR_HOST || (devHost === "0.0.0.0" ? "localhost" : devHost);
var hmrPort = Number(process.env.VITE_DEV_HMR_PORT) || devPort;
var hmrProtocol = https ? "wss" : "ws";
var plugins = [
  react({
    jsxRuntime: "automatic",
    jsxImportSource: "react",
    babel: {
      plugins: []
    }
  }),
  viteCompression({
    algorithm: "brotliCompress",
    ext: ".br",
    filter: (file) => /\.(js|css|svg|html|json)$/i.test(file),
    threshold: 1024
  }),
  viteCompression({
    algorithm: "gzip",
    ext: ".gz",
    filter: (file) => /\.(js|css|svg|html|json)$/i.test(file),
    threshold: 1024
  })
];
if (enableAnalyzer) {
  plugins.push(
    visualizer({
      filename: "dist/bundle-report.html",
      template: "treemap",
      gzipSize: true,
      brotliSize: true,
      open: true
    })
  );
}
var vite_config_default = defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src")
    }
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
      protocol: hmrProtocol
    },
    allowedHosts,
    proxy: {
      "/api": {
        target: "http://localhost:5001",
        changeOrigin: true,
        secure: false,
        ws: true
      }
    }
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
        passes: 2
      },
      mangle: {
        safari10: true
      }
    },
    assetsDir: "assets",
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html")
      },
      output: {
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split(".");
          const extType = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
            return `assets/images/[name]-[hash][extname]`;
          }
          if (/css/i.test(extType)) {
            return `assets/css/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
        chunkFileNames: "assets/js/[name]-[hash].js",
        entryFileNames: "assets/js/[name]-[hash].js",
        manualChunks: (id) => {
          const normalizedId = normalizeId(id);
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) {
            return "react-core";
          }
          if (id.includes("node_modules/react-router") || id.includes("node_modules/react-i18next") || id.includes("node_modules/@reduxjs/toolkit") || id.includes("node_modules/react-helmet")) {
            return "react-ecosystem";
          }
          if (id.includes("node_modules/firebase")) {
            return "firebase";
          }
          if (id.includes("node_modules/@mui") || id.includes("node_modules/@emotion")) {
            return "mui";
          }
          if (id.includes("node_modules/recharts") || id.includes("node_modules/chart.js") || id.includes("node_modules/react-chartjs-2") || id.includes("node_modules/d3")) {
            return "charts";
          }
          if (id.includes("node_modules/framer-motion") || id.includes("node_modules/gsap") || id.includes("node_modules/lottie")) {
            return "animations";
          }
          if (id.includes("node_modules/amplitude-js") || id.includes("node_modules/@sentry") || id.includes("node_modules/web-vitals") || id.includes("node_modules/@vercel/analytics")) {
            return "analytics";
          }
          if (id.includes("node_modules/lodash") || id.includes("node_modules/date-fns") || id.includes("node_modules/uuid") || id.includes("node_modules/clsx")) {
            return "utils";
          }
          if (id.includes("node_modules/axios") || id.includes("node_modules/@tanstack/react-query") || id.includes("node_modules/graphql")) {
            return "http";
          }
          if (id.includes("node_modules/jspdf") || id.includes("node_modules/html2canvas") || id.includes("node_modules/pdfmake")) {
            return "pdf-tools";
          }
          if (id.includes("node_modules/dompurify") || id.includes("node_modules/crypto-js") || id.includes("node_modules/bcryptjs")) {
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
        }
      },
      external: []
    }
  },
  define: {
    "import.meta.env.VITE_BACKEND_URL": JSON.stringify("https://lugn-trygg-backend.onrender.com"),
    global: "globalThis"
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxQcm9qZWt0XFxcXEx1Z24tVHJ5Z2ctbWFpbl9rbGFyXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxQcm9qZWt0XFxcXEx1Z24tVHJ5Z2ctbWFpbl9rbGFyXFxcXHZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Qcm9qZWt0L0x1Z24tVHJ5Z2ctbWFpbl9rbGFyL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcbmltcG9ydCBmcyBmcm9tIFwiZnNcIjtcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGggfSBmcm9tIFwidXJsXCI7XG5pbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdFwiO1xuaW1wb3J0IHZpdGVDb21wcmVzc2lvbiBmcm9tIFwidml0ZS1wbHVnaW4tY29tcHJlc3Npb25cIjtcbmltcG9ydCB7IHZpc3VhbGl6ZXIgfSBmcm9tIFwicm9sbHVwLXBsdWdpbi12aXN1YWxpemVyXCI7XG5cbmNvbnN0IF9fZGlybmFtZSA9IHBhdGguZGlybmFtZShmaWxlVVJMVG9QYXRoKGltcG9ydC5tZXRhLnVybCkpO1xuY29uc3QgaXNQcm9kdWN0aW9uID0gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09IFwicHJvZHVjdGlvblwiO1xuY29uc3QgZW5hYmxlQW5hbHl6ZXIgPSBwcm9jZXNzLmVudi5BTkFMWVpFID09PSBcInRydWVcIjtcbmNvbnN0IGRldkhvc3QgPSBwcm9jZXNzLmVudi5WSVRFX0RFVl9IT1NUIHx8IFwiMC4wLjAuMFwiO1xuY29uc3QgZGV2UG9ydCA9IE51bWJlcihwcm9jZXNzLmVudi5WSVRFX0RFVl9QT1JUKSB8fCAzMDAwO1xuY29uc3QgcmVxdWVzdEh0dHBzID0gcHJvY2Vzcy5lbnYuVklURV9ERVZfSFRUUFMgPT09IFwidHJ1ZVwiO1xuY29uc3QgZGVmYXVsdEFsbG93ZWRIb3N0cyA9IFtcImxvY2FsaG9zdFwiLCBcIjEyNy4wLjAuMVwiLCBcIjE5Mi4xNjguMTAuMTU0XCJdO1xuY29uc3QgZXh0cmFBbGxvd2VkSG9zdHMgPSBwcm9jZXNzLmVudi5WSVRFX0RFVl9BTExPV0VEX0hPU1RTXG4gID8gcHJvY2Vzcy5lbnYuVklURV9ERVZfQUxMT1dFRF9IT1NUUy5zcGxpdChcIixcIikubWFwKChob3N0KSA9PiBob3N0LnRyaW0oKSkuZmlsdGVyKEJvb2xlYW4pXG4gIDogW107XG5jb25zdCBhbGxvd2VkSG9zdHMgPSBBcnJheS5mcm9tKG5ldyBTZXQoWy4uLmRlZmF1bHRBbGxvd2VkSG9zdHMsIC4uLmV4dHJhQWxsb3dlZEhvc3RzXSkpO1xuY29uc3QgZGFzaGJvYXJkQ2h1bmtUYXJnZXRzID0gW1xuICAnc3JjL2NvbXBvbmVudHMvV29ybGRDbGFzc0Rhc2hib2FyZCcsXG4gICdzcmMvY29tcG9uZW50cy9BbmFseXRpY3NEYXNoYm9hcmQnLFxuICAnc3JjL2NvbXBvbmVudHMvUGVyZm9ybWFuY2VEYXNoYm9hcmQnLFxuICAnc3JjL2NvbXBvbmVudHMvTW9uaXRvcmluZ0Rhc2hib2FyZCcsXG5dO1xuY29uc3QgYW5hbHl0aWNzQ2h1bmtUYXJnZXRzID0gW1xuICAnc3JjL2NvbXBvbmVudHMvTW9vZEFuYWx5dGljcycsXG4gICdzcmMvY29tcG9uZW50cy9Xb3JsZENsYXNzQW5hbHl0aWNzJyxcbl07XG5jb25zdCBub3JtYWxpemVJZCA9IChpZCkgPT4gaWQuc3BsaXQocGF0aC5zZXApLmpvaW4oJy8nKTtcblxuY29uc3QgcmVzb2x2ZURldkh0dHBzQ29uZmlnID0gKCkgPT4ge1xuICBpZiAoIXJlcXVlc3RIdHRwcykge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGNvbnN0IGNlcnRQYXRoID0gcHJvY2Vzcy5lbnYuVklURV9ERVZfSFRUUFNfQ0VSVCB8fCBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcImNlcnRzXCIsIFwiZGV2LWNlcnQucGVtXCIpO1xuICBjb25zdCBrZXlQYXRoID0gcHJvY2Vzcy5lbnYuVklURV9ERVZfSFRUUFNfS0VZIHx8IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiY2VydHNcIiwgXCJkZXYta2V5LnBlbVwiKTtcblxuICB0cnkge1xuICAgIGNvbnN0IGNlcnQgPSBmcy5yZWFkRmlsZVN5bmMoY2VydFBhdGgpO1xuICAgIGNvbnN0IGtleSA9IGZzLnJlYWRGaWxlU3luYyhrZXlQYXRoKTtcbiAgICBjb25zb2xlLmluZm8oYFtWaXRlXSBIVFRQUyBlbmFibGVkIGZvciBkZXYgc2VydmVyIHVzaW5nICR7Y2VydFBhdGh9YCk7XG4gICAgcmV0dXJuIHsgY2VydCwga2V5IH07XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS53YXJuKFwiW1ZpdGVdIEhUVFBTIHJlcXVlc3RlZCBidXQgY2VydGlmaWNhdGVzIG5vdCBmb3VuZC4gQ29udGludWluZyB3aXRoIEhUVFAuXCIsIGVycm9yPy5tZXNzYWdlIHx8IGVycm9yKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn07XG5cbmNvbnN0IGh0dHBzID0gcmVzb2x2ZURldkh0dHBzQ29uZmlnKCk7XG5jb25zdCBobXJIb3N0ID0gcHJvY2Vzcy5lbnYuVklURV9ERVZfSE1SX0hPU1QgfHwgKGRldkhvc3QgPT09IFwiMC4wLjAuMFwiID8gXCJsb2NhbGhvc3RcIiA6IGRldkhvc3QpO1xuY29uc3QgaG1yUG9ydCA9IE51bWJlcihwcm9jZXNzLmVudi5WSVRFX0RFVl9ITVJfUE9SVCkgfHwgZGV2UG9ydDtcbmNvbnN0IGhtclByb3RvY29sID0gaHR0cHMgPyBcIndzc1wiIDogXCJ3c1wiO1xuXG5jb25zdCBwbHVnaW5zID0gW1xuICByZWFjdCh7XG4gICAganN4UnVudGltZTogXCJhdXRvbWF0aWNcIixcbiAgICBqc3hJbXBvcnRTb3VyY2U6IFwicmVhY3RcIixcbiAgICBiYWJlbDoge1xuICAgICAgcGx1Z2luczogW10sXG4gICAgfSxcbiAgfSksXG4gIHZpdGVDb21wcmVzc2lvbih7XG4gICAgYWxnb3JpdGhtOiBcImJyb3RsaUNvbXByZXNzXCIsXG4gICAgZXh0OiBcIi5iclwiLFxuICAgIGZpbHRlcjogKGZpbGUpID0+IC9cXC4oanN8Y3NzfHN2Z3xodG1sfGpzb24pJC9pLnRlc3QoZmlsZSksXG4gICAgdGhyZXNob2xkOiAxMDI0LFxuICB9KSxcbiAgdml0ZUNvbXByZXNzaW9uKHtcbiAgICBhbGdvcml0aG06IFwiZ3ppcFwiLFxuICAgIGV4dDogXCIuZ3pcIixcbiAgICBmaWx0ZXI6IChmaWxlKSA9PiAvXFwuKGpzfGNzc3xzdmd8aHRtbHxqc29uKSQvaS50ZXN0KGZpbGUpLFxuICAgIHRocmVzaG9sZDogMTAyNCxcbiAgfSksXG5dO1xuXG5pZiAoZW5hYmxlQW5hbHl6ZXIpIHtcbiAgcGx1Z2lucy5wdXNoKFxuICAgIHZpc3VhbGl6ZXIoe1xuICAgICAgZmlsZW5hbWU6IFwiZGlzdC9idW5kbGUtcmVwb3J0Lmh0bWxcIixcbiAgICAgIHRlbXBsYXRlOiBcInRyZWVtYXBcIixcbiAgICAgIGd6aXBTaXplOiB0cnVlLFxuICAgICAgYnJvdGxpU2l6ZTogdHJ1ZSxcbiAgICAgIG9wZW46IHRydWUsXG4gICAgfSlcbiAgKTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2lucyxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCJzcmNcIiksXG4gICAgfSxcbiAgfSxcbiAgc2VydmVyOiB7XG4gICAgcG9ydDogZGV2UG9ydCxcbiAgICBvcGVuOiBmYWxzZSxcbiAgICBzdHJpY3RQb3J0OiBmYWxzZSxcbiAgICBob3N0OiBkZXZIb3N0ID09PSBcIjAuMC4wLjBcIiA/IHRydWUgOiBkZXZIb3N0LFxuICAgIGh0dHBzLFxuICAgIGhtcjoge1xuICAgICAgaG9zdDogaG1ySG9zdCxcbiAgICAgIHBvcnQ6IGhtclBvcnQsXG4gICAgICBwcm90b2NvbDogaG1yUHJvdG9jb2wsXG4gICAgfSxcbiAgICBhbGxvd2VkSG9zdHMsXG4gICAgcHJveHk6IHtcbiAgICAgIFwiL2FwaVwiOiB7XG4gICAgICAgIHRhcmdldDogXCJodHRwOi8vbG9jYWxob3N0OjUwMDFcIixcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICBzZWN1cmU6IGZhbHNlLFxuICAgICAgICB3czogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbiAgYnVpbGQ6IHtcbiAgICBvdXREaXI6IFwiZGlzdFwiLFxuICAgIHNvdXJjZW1hcDogIWlzUHJvZHVjdGlvbixcbiAgICB0YXJnZXQ6IFtcImVzMjAxNVwiLCBcImNocm9tZTcwXCIsIFwiZmlyZWZveDY1XCIsIFwic2FmYXJpMTJcIiwgXCJlZGdlNzlcIl0sXG4gICAgY3NzQ29kZVNwbGl0OiB0cnVlLFxuICAgIG1pbmlmeTogXCJ0ZXJzZXJcIixcbiAgICBtb2R1bGVQcmVsb2FkOiB7IHBvbHlmaWxsOiB0cnVlIH0sXG4gICAgdGVyc2VyT3B0aW9uczoge1xuICAgICAgY29tcHJlc3M6IHtcbiAgICAgICAgZHJvcF9jb25zb2xlOiBpc1Byb2R1Y3Rpb24sXG4gICAgICAgIGRyb3BfZGVidWdnZXI6IGlzUHJvZHVjdGlvbixcbiAgICAgICAgcHVyZV9mdW5jczogaXNQcm9kdWN0aW9uID8gW1wiY29uc29sZS5sb2dcIiwgXCJjb25zb2xlLmluZm9cIiwgXCJjb25zb2xlLmRlYnVnXCJdIDogW10sXG4gICAgICAgIHBhc3NlczogMixcbiAgICAgIH0sXG4gICAgICBtYW5nbGU6IHtcbiAgICAgICAgc2FmYXJpMTA6IHRydWUsXG4gICAgICB9LFxuICAgIH0sXG4gICAgYXNzZXRzRGlyOiBcImFzc2V0c1wiLFxuICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgIGlucHV0OiB7XG4gICAgICAgIG1haW46IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICdpbmRleC5odG1sJyksXG4gICAgICB9LFxuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIGFzc2V0RmlsZU5hbWVzOiAoYXNzZXRJbmZvKSA9PiB7XG4gICAgICAgICAgY29uc3QgaW5mbyA9IGFzc2V0SW5mby5uYW1lLnNwbGl0KCcuJyk7XG4gICAgICAgICAgY29uc3QgZXh0VHlwZSA9IGluZm9baW5mby5sZW5ndGggLSAxXTtcbiAgICAgICAgICBpZiAoL3BuZ3xqcGU/Z3xzdmd8Z2lmfHRpZmZ8Ym1wfGljby9pLnRlc3QoZXh0VHlwZSkpIHtcbiAgICAgICAgICAgIHJldHVybiBgYXNzZXRzL2ltYWdlcy9bbmFtZV0tW2hhc2hdW2V4dG5hbWVdYDtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKC9jc3MvaS50ZXN0KGV4dFR5cGUpKSB7XG4gICAgICAgICAgICByZXR1cm4gYGFzc2V0cy9jc3MvW25hbWVdLVtoYXNoXVtleHRuYW1lXWA7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBgYXNzZXRzL1tuYW1lXS1baGFzaF1bZXh0bmFtZV1gO1xuICAgICAgICB9LFxuICAgICAgICBjaHVua0ZpbGVOYW1lczogJ2Fzc2V0cy9qcy9bbmFtZV0tW2hhc2hdLmpzJyxcbiAgICAgICAgZW50cnlGaWxlTmFtZXM6ICdhc3NldHMvanMvW25hbWVdLVtoYXNoXS5qcycsXG4gICAgICAgIG1hbnVhbENodW5rczogKGlkKSA9PiB7XG4gICAgICAgICAgY29uc3Qgbm9ybWFsaXplZElkID0gbm9ybWFsaXplSWQoaWQpO1xuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9yZWFjdFwiKSB8fCBpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9yZWFjdC1kb21cIikpIHtcbiAgICAgICAgICAgIHJldHVybiBcInJlYWN0LWNvcmVcIjtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvcmVhY3Qtcm91dGVyXCIpIHx8XG4gICAgICAgICAgICBpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9yZWFjdC1pMThuZXh0XCIpIHx8XG4gICAgICAgICAgICBpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9AcmVkdXhqcy90b29sa2l0XCIpIHx8XG4gICAgICAgICAgICBpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9yZWFjdC1oZWxtZXRcIilcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIHJldHVybiBcInJlYWN0LWVjb3N5c3RlbVwiO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvZmlyZWJhc2VcIikpIHtcbiAgICAgICAgICAgIHJldHVybiBcImZpcmViYXNlXCI7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9AbXVpXCIpIHx8IGlkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL0BlbW90aW9uXCIpKSB7XG4gICAgICAgICAgICByZXR1cm4gXCJtdWlcIjtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvcmVjaGFydHNcIikgfHxcbiAgICAgICAgICAgIGlkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL2NoYXJ0LmpzXCIpIHx8XG4gICAgICAgICAgICBpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9yZWFjdC1jaGFydGpzLTJcIikgfHxcbiAgICAgICAgICAgIGlkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL2QzXCIpXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICByZXR1cm4gXCJjaGFydHNcIjtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvZnJhbWVyLW1vdGlvblwiKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvZ3NhcFwiKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvbG90dGllXCIpXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICByZXR1cm4gXCJhbmltYXRpb25zXCI7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgIGlkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL2FtcGxpdHVkZS1qc1wiKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvQHNlbnRyeVwiKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvd2ViLXZpdGFsc1wiKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvQHZlcmNlbC9hbmFseXRpY3NcIilcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIHJldHVybiBcImFuYWx5dGljc1wiO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICBpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9sb2Rhc2hcIikgfHxcbiAgICAgICAgICAgIGlkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL2RhdGUtZm5zXCIpIHx8XG4gICAgICAgICAgICBpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy91dWlkXCIpIHx8XG4gICAgICAgICAgICBpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9jbHN4XCIpXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICByZXR1cm4gXCJ1dGlsc1wiO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICBpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9heGlvc1wiKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvQHRhbnN0YWNrL3JlYWN0LXF1ZXJ5XCIpIHx8XG4gICAgICAgICAgICBpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9ncmFwaHFsXCIpXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICByZXR1cm4gXCJodHRwXCI7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgIGlkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL2pzcGRmXCIpIHx8XG4gICAgICAgICAgICBpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9odG1sMmNhbnZhc1wiKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvcGRmbWFrZVwiKVxuICAgICAgICAgICkge1xuICAgICAgICAgICAgcmV0dXJuIFwicGRmLXRvb2xzXCI7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgIGlkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL2RvbXB1cmlmeVwiKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvY3J5cHRvLWpzXCIpIHx8XG4gICAgICAgICAgICBpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9iY3J5cHRqc1wiKVxuICAgICAgICAgICkge1xuICAgICAgICAgICAgcmV0dXJuIFwic2VjdXJpdHlcIjtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL2Nsb3VkaW5hcnlcIikgfHwgaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvc2hhcnBcIikpIHtcbiAgICAgICAgICAgIHJldHVybiBcImltYWdlc1wiO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoZGFzaGJvYXJkQ2h1bmtUYXJnZXRzLnNvbWUoKHRhcmdldCkgPT4gbm9ybWFsaXplZElkLmluY2x1ZGVzKHRhcmdldCkpKSB7XG4gICAgICAgICAgICByZXR1cm4gXCJkYXNoYm9hcmQtcm91dGVzXCI7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChhbmFseXRpY3NDaHVua1RhcmdldHMuc29tZSgodGFyZ2V0KSA9PiBub3JtYWxpemVkSWQuaW5jbHVkZXModGFyZ2V0KSkpIHtcbiAgICAgICAgICAgIHJldHVybiBcImFuYWx5dGljcy1yb3V0ZXNcIjtcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgZXh0ZXJuYWw6IFtdLFxuICAgIH0sXG4gIH0sXG4gIGRlZmluZToge1xuICAgIFwiaW1wb3J0Lm1ldGEuZW52LlZJVEVfQkFDS0VORF9VUkxcIjogSlNPTi5zdHJpbmdpZnkoXCJodHRwczovL2x1Z24tdHJ5Z2ctYmFja2VuZC5vbnJlbmRlci5jb21cIiksXG4gICAgZ2xvYmFsOiAnZ2xvYmFsVGhpcycsXG4gIH0sXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBcVIsT0FBTyxVQUFVO0FBQ3RTLE9BQU8sUUFBUTtBQUNmLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsb0JBQW9CO0FBQzdCLE9BQU8sV0FBVztBQUNsQixPQUFPLHFCQUFxQjtBQUM1QixTQUFTLGtCQUFrQjtBQU5nSixJQUFNLDJDQUEyQztBQVE1TixJQUFNLFlBQVksS0FBSyxRQUFRLGNBQWMsd0NBQWUsQ0FBQztBQUM3RCxJQUFNLGVBQWUsUUFBUSxJQUFJLGFBQWE7QUFDOUMsSUFBTSxpQkFBaUIsUUFBUSxJQUFJLFlBQVk7QUFDL0MsSUFBTSxVQUFVLFFBQVEsSUFBSSxpQkFBaUI7QUFDN0MsSUFBTSxVQUFVLE9BQU8sUUFBUSxJQUFJLGFBQWEsS0FBSztBQUNyRCxJQUFNLGVBQWUsUUFBUSxJQUFJLG1CQUFtQjtBQUNwRCxJQUFNLHNCQUFzQixDQUFDLGFBQWEsYUFBYSxnQkFBZ0I7QUFDdkUsSUFBTSxvQkFBb0IsUUFBUSxJQUFJLHlCQUNsQyxRQUFRLElBQUksdUJBQXVCLE1BQU0sR0FBRyxFQUFFLElBQUksQ0FBQyxTQUFTLEtBQUssS0FBSyxDQUFDLEVBQUUsT0FBTyxPQUFP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

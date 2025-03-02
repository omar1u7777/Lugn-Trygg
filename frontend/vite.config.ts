import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    server: {
      port: 5000,
      open: false,
      strictPort: true,
      host: true,
      proxy: {
        "/api": {
          target: env.VITE_BACKEND_URL || "http://127.0.0.1:5001",  // Backend-URL till Flask
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
    },
    define: {
      "import.meta.env.VITE_BACKEND_URL": JSON.stringify(env.VITE_BACKEND_URL || "http://127.0.0.1:5001"),
    },
  };
});

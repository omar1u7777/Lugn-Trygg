import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // Load env file
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()], // Add the React plugin here
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
      proxy: {
        "/api": {
          target: "http://127.0.0.1:5001",  // Backend-URL till Flask (corrected port)
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
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          },
        },
      },
    },
    define: {
      "import.meta.env.VITE_BACKEND_URL": JSON.stringify("http://127.0.0.1:5001"), // Corrected port
    },
  };
});

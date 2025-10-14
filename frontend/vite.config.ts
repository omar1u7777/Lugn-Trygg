import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  return {
    plugins: [], // No React plugin for now - will handle JSX manually
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
      "import.meta.env.VITE_BACKEND_URL": JSON.stringify("http://localhost:54112"), // User specified port
    },
  };
});

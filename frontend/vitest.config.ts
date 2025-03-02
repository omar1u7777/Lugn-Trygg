import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

//  Exporterar Vite-konfiguration baserat på körläge (development/production)
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ""); //  Ladda miljövariabler från `.env`-filer

  return {
    plugins: [react()], // 🚀 Använder React-plugin för att hantera JSX/TSX

    server: {
      port: 5000, //  Startar dev-servern på port 5000
      open: false, //  Öppnar **inte** automatiskt webbläsaren vid start
      strictPort: true, //  Förhindrar att servern byter port om 5000 är upptagen
      host: "localhost", //  Anger att servern endast är tillgänglig lokalt

      //  Proxy för att vidarebefordra API-anrop till backend
      proxy: {
        "/api": {
          target: env.VITE_BACKEND_URL || "http://127.0.0.1:5001", // 📡 Standardvärde om `VITE_BACKEND_URL` saknas
          changeOrigin: true, //  Ändrar `Origin`-huvudet för att matcha target
          secure: false, //  Tillåter HTTP (ingen SSL-verifiering)
          ws: true, //  Stöd för WebSocket-anslutningar
        },
      },
    },

    build: {
      outDir: "dist", //  Lagrar byggda filer i `dist`-mappen
      sourcemap: mode === "development", //  Genererar sourcemaps i utvecklingsläge
      target: "esnext", //  Bygger för moderna webbläsare
      cssCodeSplit: true, //  Separera CSS i mindre filer för bättre optimering

      rollupOptions: {
        output: {
          format: "cjs", //  Ställer in utdataformat till CommonJS
        },
      },
    },

    test: {
      globals: true, //  Möjliggör globala testfunktioner utan att importera dem
      environment: "jsdom", //  Simulerar en webbläsarmiljö för testning
      setupFiles: "./src/setupTests.ts", //  Kör `setupTests.ts` innan tester startar

      coverage: {
        provider: "istanbul", //  Använder Istanbul för kodtäckning
        reporter: ["text", "json", "html", "lcov"], //  Skapar rapporter i flera format
        include: ["src/**/*.{ts,tsx}"], //  Analyserar endast källkodsfiler
        exclude: ["node_modules", "tests", "dist"], //  Ignorera beroenden och byggfiler
      },
    },

    define: {
      // 🔹 Definiera `import.meta.env`-variabler för användning i frontend
      "import.meta.env.VITE_BACKEND_URL": JSON.stringify(env.VITE_BACKEND_URL || "http://127.0.0.1:5001"),
      "import.meta.env.MODE": JSON.stringify(mode), //  Lagrar nuvarande körläge
    },
  };
});

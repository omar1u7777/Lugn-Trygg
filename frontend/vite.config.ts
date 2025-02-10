// vite.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // Gör att Vitest injicerar describe, it, expect globalt
    globals: true,

    // Sätter upp en JSDOM-miljö (krävs för att render, document, etc. ska fungera)
    environment: 'jsdom',

    // En fil som körs innan testerna startar
    setupFiles: ['./src/setupTests.ts'],
  },
});

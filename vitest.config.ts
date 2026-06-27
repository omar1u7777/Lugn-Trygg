import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/setupTests.ts",
    dangerouslyForceExit: true,
    teardownTimeout: 30000,
    // Exclude E2E tests from Vitest (they use Playwright)
    exclude: [
      "**/node_modules/**",
      "**/tests/e2e/**",
      "**/*.e2e.spec.ts",
      "**/*.e2e.spec.tsx"
    ],
    // Only run component and unit tests
    include: [
      "**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'json'],
      reportsDirectory: './coverage',
    },
  },
  define: {
    'process.env.NODE_ENV': '"test"',
    'import.meta.env.VITE_ENCRYPTION_KEY': '"a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"', // gitleaks:allow
    'import.meta.env.VITE_FIREBASE_API_KEY': '"test-api-key"',
    'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': '"test-project.firebaseapp.com"',
    'import.meta.env.VITE_FIREBASE_PROJECT_ID': '"test-project"',
    'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': '"test-project.appspot.com"',
  },
  esbuild: {
    jsxInject: `import React from 'react'`,
  },
});


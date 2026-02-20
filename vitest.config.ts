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
    ]
  },
  define: {
    'process.env.NODE_ENV': '"development"',
    'import.meta.env.VITE_ENCRYPTION_KEY': '"a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"',
  },
  esbuild: {
    jsxInject: `import React from 'react'`,
  },
});


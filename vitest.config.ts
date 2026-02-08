import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/setupTests.ts",
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
  },
  esbuild: {
    jsxInject: `import React from 'react'`,
  },
});


import { defineConfig } from "vitest/config";
export default defineConfig({
    test: {
        globals: true,
        environment: "jsdom",
        setupFiles: "./src/setupTests.ts",
    },
    define: {
        'process.env.NODE_ENV': '"development"',
    },
    esbuild: {
        jsxInject: `import React from 'react'`,
    },
});

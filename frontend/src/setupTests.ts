// src/setupTests.ts

// Polyfills for Jest
import { TextEncoder, TextDecoder } from 'util';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock import.meta.env
Object.defineProperty(global, 'import', {
  value: {
    meta: {
      env: {
        VITE_API_URL: 'http://localhost:5001',
        VITE_BACKEND_URL: 'http://localhost:5001',
      },
    },
  },
});

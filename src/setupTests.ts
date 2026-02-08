// src/setupTests.ts
// Environment polyfills for Jest (jsdom)

// Import jest-dom matchers for Vitest
import '@testing-library/jest-dom/vitest';

// Force development React for testing
process.env.NODE_ENV = 'development';

// Use browser-compatible polyfill for TextEncoder/TextDecoder if needed
if (typeof global.TextEncoder === 'undefined' || typeof global.TextDecoder === 'undefined') {
  // Use Node's util polyfills

  const util = require('util');
  if (typeof global.TextEncoder === 'undefined' && util.TextEncoder) {
    global.TextEncoder = util.TextEncoder;
  }
  if (typeof global.TextDecoder === 'undefined' && util.TextDecoder) {
    global.TextDecoder = util.TextDecoder as unknown as typeof global.TextDecoder;
  }
}

// Avoid mocking import.meta; env.ts guards test environment access

if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

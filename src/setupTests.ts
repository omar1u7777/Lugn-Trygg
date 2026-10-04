// src/setupTests.ts
// Environment polyfills for Jest (jsdom)

// Import jest-dom matchers for Vitest
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { queryClient } from './contexts/queryClient';

// Force development React for testing
process.env.NODE_ENV = 'development';

// Use browser-compatible polyfill for TextEncoder/TextDecoder if needed
if (typeof global.TextEncoder === 'undefined' || typeof global.TextDecoder === 'undefined') {
  // Use Node's util polyfills - dynamic import to avoid require()
  import('util').then((util) => {
    if (typeof global.TextEncoder === 'undefined' && util.TextEncoder) {
      global.TextEncoder = util.TextEncoder as typeof global.TextEncoder;
    }
    if (typeof global.TextDecoder === 'undefined' && util.TextDecoder) {
      global.TextDecoder = util.TextDecoder as unknown as typeof global.TextDecoder;
    }
  }).catch(() => {
    // Ignore if util module not available
  });
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

// Polyfill window.scrollTo for jsdom
if (typeof window !== 'undefined' && !window.scrollTo) {
  window.scrollTo = () => {};
}

// Components read shared lists through the app's queryClient singleton (the
// mood list, for one). Without clearing it, one test's response is still
// cached for the next and its fetch mocks are never called.
afterEach(() => {
  queryClient.clear();
});

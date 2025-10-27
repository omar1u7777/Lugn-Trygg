/**
 * Cross-Platform Compatibility Utilities for Lugn & Trygg
 * Ensures consistent behavior across different browsers and devices
 */

import { analytics } from './analytics';

// Browser detection and feature support
export const browserSupport = {
  // Check for modern browser features
  checkFeatures: () => {
    const features = {
      // Core web APIs
      fetch: 'fetch' in window,
      promises: typeof Promise !== 'undefined',
      asyncAwait: (async () => {}) instanceof Function,

      // Modern JavaScript features
      es6: (() => {
        try {
          eval('class Test {}; const arrow = () => {}; const {a} = {a:1};');
          return true;
        } catch {
          return false;
        }
      })(),

      // Web APIs for PWA
      serviceWorker: 'serviceWorker' in navigator,
      pushManager: 'PushManager' in window,
      notification: 'Notification' in window,
      indexedDB: 'indexedDB' in window,

      // Media APIs
      getUserMedia: 'getUserMedia' in navigator || 'webkitGetUserMedia' in navigator,
      webAudio: 'AudioContext' in window || 'webkitAudioContext' in window,

      // Storage APIs
      localStorage: (() => {
        try {
          localStorage.setItem('test', 'test');
          localStorage.removeItem('test');
          return true;
        } catch {
          return false;
        }
      })(),

      // CSS features
      cssGrid: CSS.supports('display', 'grid'),
      cssFlexbox: CSS.supports('display', 'flex'),
      cssCustomProperties: CSS.supports('--test', 'value'),

      // Touch and mobile features
      touch: 'ontouchstart' in window,
      passiveEvents: (() => {
        let supports = false;
        try {
          const opts = Object.defineProperty({}, 'passive', {
            get: () => { supports = true; return true; }
          });
          window.addEventListener('test', null, opts);
          window.removeEventListener('test', null, opts);
        } catch {}
        return supports;
      })(),

      // Performance APIs
      performanceObserver: 'PerformanceObserver' in window,
      intersectionObserver: 'IntersectionObserver' in window,
      resizeObserver: 'ResizeObserver' in window,
    };

    return features;
  },

  // Get browser information
  getBrowserInfo: () => {
    const ua = navigator.userAgent;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isAndroid = /Android/.test(ua);
    const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
    const isChrome = /Chrome/.test(ua) && !isSafari;
    const isFirefox = /Firefox/.test(ua);
    const isEdge = /Edg/.test(ua);

    return {
      userAgent: ua,
      isMobile,
      isIOS,
      isAndroid,
      isSafari,
      isChrome,
      isFirefox,
      isEdge,
      platform: navigator.platform,
      language: navigator.language,
      languages: navigator.languages,
    };
  },

  // Check for outdated browsers
  isOutdatedBrowser: () => {
    const ua = navigator.userAgent;

    // Check for very old browsers
    const outdatedPatterns = [
      /MSIE [6-9]/,  // IE 6-9
      /MSIE 10/,     // IE 10
      /Trident/,     // IE 11 (but still outdated for modern features)
      /Android [2-4]/, // Old Android
      /iPhone OS [6-9]/, // Old iOS
    ];

    return outdatedPatterns.some(pattern => pattern.test(ua));
  },

  // Polyfill loader for missing features
  loadPolyfills: async () => {
    const features = browserSupport.checkFeatures();

    // Load core-js for ES6+ features if needed
    if (!features.es6) {
      await loadScript('https://cdn.jsdelivr.net/npm/core-js@3/client/core.min.js');
    }

    // Load fetch polyfill if needed
    if (!features.fetch) {
      await loadScript('https://cdn.jsdelivr.net/npm/whatwg-fetch@3/dist/fetch.umd.js');
    }

    // Load IntersectionObserver polyfill
    if (!features.intersectionObserver) {
      await loadScript('https://cdn.jsdelivr.net/npm/intersection-observer@0.12.0/intersection-observer.js');
    }

    analytics.track('Polyfills Loaded', {
      features: Object.keys(features).filter(key => !features[key as keyof typeof features]),
    });
  },
};

// Device and viewport utilities
export const deviceUtils = {
  // Get device pixel ratio
  getDevicePixelRatio: () => window.devicePixelRatio || 1,

  // Get viewport dimensions
  getViewportSize: () => ({
    width: window.innerWidth,
    height: window.innerHeight,
    deviceWidth: screen.width,
    deviceHeight: screen.height,
  }),

  // Check if device is in landscape mode
  isLandscape: () => window.innerWidth > window.innerHeight,

  // Get safe area insets (for notched devices)
  getSafeAreaInsets: () => {
    const style = getComputedStyle(document.documentElement);
    return {
      top: parseInt(style.getPropertyValue('env(safe-area-inset-top)') || '0'),
      right: parseInt(style.getPropertyValue('env(safe-area-inset-right)') || '0'),
      bottom: parseInt(style.getPropertyValue('env(safe-area-inset-bottom)') || '0'),
      left: parseInt(style.getPropertyValue('env(safe-area-inset-left)') || '0'),
    };
  },

  // Check for high DPI displays
  isHighDPI: () => window.devicePixelRatio > 1,

  // Get touch capabilities
  getTouchCapabilities: () => ({
    maxTouchPoints: navigator.maxTouchPoints || 0,
    hasTouch: 'ontouchstart' in window,
    hasPointerEvents: 'onpointerdown' in window,
  }),

  // Detect device type
  getDeviceType: () => {
    const ua = navigator.userAgent;
    const viewport = deviceUtils.getViewportSize();

    if (/iPad/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document)) {
      return 'tablet';
    }

    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
      return viewport.width < 768 ? 'mobile' : 'tablet';
    }

    return 'desktop';
  },

  // Check for reduced motion preference
  prefersReducedMotion: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,

  // Check for high contrast preference
  prefersHighContrast: () => window.matchMedia('(prefers-contrast: high)').matches,

  // Check for color scheme preference
  getPreferredColorScheme: () => {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
    return 'auto';
  },
};

// Network utilities
export const networkUtils = {
  // Get network information
  getNetworkInfo: () => {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      return {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData,
      };
    }
    return null;
  },

  // Check if online
  isOnline: () => navigator.onLine,

  // Monitor network changes
  onNetworkChange: (callback: (online: boolean) => void) => {
    const handleOnline = () => callback(true);
    const handleOffline = () => callback(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Return cleanup function
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  },

  // Get connection quality
  getConnectionQuality: () => {
    const network = networkUtils.getNetworkInfo();
    if (!network) return 'unknown';

    if (network.saveData) return 'data-saver';
    if (network.effectiveType === '4g' && network.downlink > 5) return 'excellent';
    if (network.effectiveType === '4g') return 'good';
    if (network.effectiveType === '3g') return 'fair';
    return 'poor';
  },
};

// Storage compatibility
export const storageUtils = {
  // Safe localStorage with fallback
  safeLocalStorage: {
    get: (key: string, fallback: any = null) => {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : fallback;
      } catch {
        return fallback;
      }
    },

    set: (key: string, value: any) => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },

    remove: (key: string) => {
      try {
        localStorage.removeItem(key);
        return true;
      } catch {
        return false;
      }
    },

    clear: () => {
      try {
        localStorage.clear();
        return true;
      } catch {
        return false;
      }
    },
  },

  // Safe sessionStorage with fallback
  safeSessionStorage: {
    get: (key: string, fallback: any = null) => {
      try {
        const item = sessionStorage.getItem(key);
        return item ? JSON.parse(item) : fallback;
      } catch {
        return fallback;
      }
    },

    set: (key: string, value: any) => {
      try {
        sessionStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },

    remove: (key: string) => {
      try {
        sessionStorage.removeItem(key);
        return true;
      } catch {
        return false;
      }
    },

    clear: () => {
      try {
        sessionStorage.clear();
        return true;
      } catch {
        return false;
      }
    },
  },

  // IndexedDB wrapper for larger data
  indexedDB: {
    open: (dbName: string, version: number = 1) => {
      return new Promise<IDBDatabase>((resolve, reject) => {
        if (!('indexedDB' in window)) {
          reject(new Error('IndexedDB not supported'));
          return;
        }

        const request = indexedDB.open(dbName, version);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          // Create object stores if they don't exist
          if (!db.objectStoreNames.contains('lugn-trygg-data')) {
            db.createObjectStore('lugn-trygg-data');
          }
        };
      });
    },

    set: async (key: string, value: any) => {
      try {
        const db = await storageUtils.indexedDB.open('lugn-trygg');
        const transaction = db.transaction(['lugn-trygg-data'], 'readwrite');
        const store = transaction.objectStore('lugn-trygg-data');
        store.put(value, key);

        return new Promise((resolve, reject) => {
          transaction.oncomplete = () => resolve(true);
          transaction.onerror = () => reject(transaction.error);
        });
      } catch (error) {
        console.warn('IndexedDB set failed:', error);
        return false;
      }
    },

    get: async (key: string) => {
      try {
        const db = await storageUtils.indexedDB.open('lugn-trygg');
        const transaction = db.transaction(['lugn-trygg-data'], 'readonly');
        const store = transaction.objectStore('lugn-trygg-data');
        const request = store.get(key);

        return new Promise((resolve, reject) => {
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      } catch (error) {
        console.warn('IndexedDB get failed:', error);
        return null;
      }
    },
  },
};

// Media compatibility
export const mediaUtils = {
  // Get supported audio formats
  getSupportedAudioFormats: () => {
    const audio = document.createElement('audio');
    return {
      mp3: !!(audio.canPlayType && audio.canPlayType('audio/mpeg;').replace(/no/, '')),
      ogg: !!(audio.canPlayType && audio.canPlayType('audio/ogg; codecs="vorbis"').replace(/no/, '')),
      wav: !!(audio.canPlayType && audio.canPlayType('audio/wav;').replace(/no/, '')),
      webm: !!(audio.canPlayType && audio.canPlayType('audio/webm; codecs="vorbis"').replace(/no/, '')),
    };
  },

  // Get supported video formats
  getSupportedVideoFormats: () => {
    const video = document.createElement('video');
    return {
      mp4: !!(video.canPlayType && video.canPlayType('video/mp4;').replace(/no/, '')),
      webm: !!(video.canPlayType && video.canPlayType('video/webm;').replace(/no/, '')),
      ogg: !!(video.canPlayType && video.canPlayType('video/ogg;').replace(/no/, '')),
    };
  },

  // Get supported image formats
  getSupportedImageFormats: () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    return {
      webp: (() => {
        if (!ctx) return false;
        return ctx.getImageData(0, 0, 1, 1).data.length === 4; // Basic WebP support check
      })(),
      avif: false, // Would need more complex detection
      jpeg: true,  // Universally supported
      png: true,   // Universally supported
      gif: true,   // Universally supported
    };
  },

  // Request microphone permission safely
  requestMicrophonePermission: async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Microphone not supported');
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the stream immediately after getting permission
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('Microphone permission denied:', error);
      return false;
    }
  },
};

// CSS compatibility
export const cssUtils = {
  // Check if CSS property is supported
  supports: (property: string, value?: string) => {
    return CSS.supports(property, value || '');
  },

  // Add vendor prefixes automatically
  addVendorPrefixes: (property: string, value: string) => {
    const vendors = ['-webkit-', '-moz-', '-ms-', '-o-', ''];
    const styles: { [key: string]: string } = {};

    vendors.forEach(vendor => {
      styles[vendor + property] = value;
    });

    return styles;
  },

  // Get computed style safely
  getComputedStyle: (element: HTMLElement, property: string) => {
    const computed = window.getComputedStyle(element);
    return computed.getPropertyValue(property);
  },

  // Check for CSS animations support
  supportsAnimations: () => {
    const element = document.createElement('div');
    return 'animation' in element.style || 'webkitAnimation' in element.style;
  },

  // Check for CSS transforms support
  supportsTransforms: () => {
    const element = document.createElement('div');
    const transforms = ['transform', 'webkitTransform', 'mozTransform', 'msTransform'];
    return transforms.some(transform => transform in element.style);
  },
};

// Event handling compatibility
export const eventUtils = {
  // Add event listener with automatic cleanup
  addEventListener: (
    element: EventTarget,
    event: string,
    handler: EventListener,
    options?: boolean | AddEventListenerOptions
  ) => {
    element.addEventListener(event, handler, options);

    // Return cleanup function
    return () => {
      element.removeEventListener(event, handler, options);
    };
  },

  // Safe passive event listeners
  addPassiveEventListener: (
    element: EventTarget,
    event: string,
    handler: EventListener
  ) => {
    const options = cssUtils.supports('touch-action', 'none') ? { passive: true } : false;
    return eventUtils.addEventListener(element, event, handler, options);
  },

  // Prevent default with compatibility check
  preventDefault: (event: Event) => {
    if (event.preventDefault) {
      event.preventDefault();
    } else {
      (event as any).returnValue = false;
    }
  },

  // Stop propagation with compatibility check
  stopPropagation: (event: Event) => {
    if (event.stopPropagation) {
      event.stopPropagation();
    } else {
      (event as any).cancelBubble = true;
    }
  },
};

// Utility function to load scripts dynamically
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

// Initialize cross-platform compatibility
export const initCrossPlatformSupport = async () => {
  console.log('Initializing cross-platform support...');

  // Check browser compatibility
  const features = browserSupport.checkFeatures();
  const browserInfo = browserSupport.getBrowserInfo();

  console.log('Browser features:', features);
  console.log('Browser info:', browserInfo);

  // Load polyfills if needed
  if (!browserSupport.isOutdatedBrowser()) {
    await browserSupport.loadPolyfills();
  }

  // Set up device-specific optimizations
  const deviceType = deviceUtils.getDeviceType();
  document.documentElement.setAttribute('data-device', deviceType);

  // Set up network monitoring
  networkUtils.onNetworkChange((online) => {
    document.documentElement.setAttribute('data-online', online.toString());
    analytics.track('Network Status Changed', { online });
  });

  // Set initial network status
  document.documentElement.setAttribute('data-online', networkUtils.isOnline().toString());

  // Set color scheme
  const colorScheme = deviceUtils.getPreferredColorScheme();
  document.documentElement.setAttribute('data-color-scheme', colorScheme);

  // Set motion preference
  const reducedMotion = deviceUtils.prefersReducedMotion();
  document.documentElement.setAttribute('data-reduced-motion', reducedMotion.toString());

  analytics.track('Cross Platform Support Initialized', {
    deviceType,
    browser: browserInfo,
    features: Object.keys(features).filter(key => features[key as keyof typeof features]),
    missingFeatures: Object.keys(features).filter(key => !features[key as keyof typeof features]),
  });
};
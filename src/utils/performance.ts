/**
 * Advanced Performance Optimization Utilities for Lugn & Trygg
 * Bundle splitting, lazy loading, and performance monitoring
 */

import React, { lazy } from 'react';
import type { ComponentType } from 'react';

// Lazy loading with error boundaries
import { getOptimizedImageUrl } from '../../utils/cloudinary';

export const lazyWithFallback = <T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  fallback?: ComponentType
) => {
  return lazy(() =>
    importFunc().catch((error) => {
      console.error('Lazy loading failed:', error);

      if (fallback) {
        return { default: fallback };
      }

      return {
        default: () =>
          React.createElement(
            'div',
            { className: 'p-4 text-center text-sm text-error-600 dark:text-error-400' },
            React.createElement('p', null, 'Failed to load component. Please refresh the page.')
          )
      };
    })
  );
};

// Preload critical resources
export type PreloadAsset = {
  href: string;
  as: 'font' | 'image' | 'script' | 'style';
  type?: string;
  crossOrigin?: 'anonymous' | 'use-credentials';
  importance?: 'high' | 'low' | 'auto';
};

export const preloadCriticalResources = (assets: PreloadAsset[] = []) => {
  if (!assets.length || typeof document === 'undefined') {
    return;
  }

  assets.forEach((asset) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = asset.href;
    (link as HTMLLinkElement).as = asset.as;
    if (asset.type) {
      link.type = asset.type;
    }
    if (asset.crossOrigin) {
      link.crossOrigin = asset.crossOrigin;
    }
    if (asset.importance) {
      (link as any).importance = asset.importance;
    }
    document.head.appendChild(link);
  });
};

// Dynamic import with caching
const importCache = new Map<string, Promise<any>>();

export const cachedImport = <T>(key: string, importFunc: () => Promise<T>): Promise<T> => {
  if (importCache.has(key)) {
    return importCache.get(key)!;
  }

  const promise = importFunc();
  importCache.set(key, promise);

  return promise;
};

// Performance monitoring
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private observers: PerformanceObserver[] = [];
  private metrics: Map<string, any> = new Map();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  init() {
    // Monitor Core Web Vitals
    if ('PerformanceObserver' in window) {
      this.observeLCP();
      this.observeFID();
      this.observeCLS();
      this.observeFCP();
      this.observeTTFB();
    }

    // Monitor custom metrics
    this.observeCustomMetrics();
  }

  private observeLCP() {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];

        if (lastEntry) {
          this.metrics.set('LCP', {
            value: lastEntry.startTime,
            timestamp: Date.now(),
          });

          console.log('LCP:', lastEntry.startTime);
        }
      });

      observer.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(observer);
    } catch (error) {
      console.warn('LCP observation not supported');
    }
  }

  private observeFID() {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();

        entries.forEach((entry: any) => {
          this.metrics.set('FID', {
            value: entry.processingStart - entry.startTime,
            timestamp: Date.now(),
          });

          console.log('FID:', entry.processingStart - entry.startTime);
        });
      });

      observer.observe({ entryTypes: ['first-input'] });
      this.observers.push(observer);
    } catch (error) {
      console.warn('FID observation not supported');
    }
  }

  private observeCLS() {
    try {
      let clsValue = 0;
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();

        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        });

        this.metrics.set('CLS', {
          value: clsValue,
          timestamp: Date.now(),
        });

        console.log('CLS:', clsValue);
      });

      observer.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(observer);
    } catch (error) {
      console.warn('CLS observation not supported');
    }
  }

  private observeFCP() {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];

        if (lastEntry) {
          this.metrics.set('FCP', {
            value: lastEntry.startTime,
            timestamp: Date.now(),
          });

          console.log('FCP:', lastEntry.startTime);
        }
      });

      observer.observe({ entryTypes: ['paint'] });
      this.observers.push(observer);
    } catch (error) {
      console.warn('FCP observation not supported');
    }
  }

  private observeTTFB() {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();

        entries.forEach((entry: any) => {
          this.metrics.set('TTFB', {
            value: entry.responseStart - entry.requestStart,
            timestamp: Date.now(),
          });

          console.log('TTFB:', entry.responseStart - entry.requestStart);
        });
      });

      observer.observe({ entryTypes: ['navigation'] });
      this.observers.push(observer);
    } catch (error) {
      console.warn('TTFB observation not supported');
    }
  }

  private observeCustomMetrics() {
    // Monitor bundle loading
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();

      entries.forEach((entry: any) => {
        if (entry.name.includes('bundle') || entry.name.includes('chunk')) {
          this.metrics.set(`bundle-${entry.name}`, {
            loadTime: entry.duration,
            size: entry.transferSize,
            timestamp: Date.now(),
          });

          console.log(`Bundle ${entry.name}:`, entry.duration, 'ms');
        }
      });
    });

    observer.observe({ entryTypes: ['resource'] });
    this.observers.push(observer);
  }

  getMetrics() {
    return Object.fromEntries(this.metrics);
  }

  getMetric(name: string) {
    return this.metrics.get(name);
  }

  clearMetrics() {
    this.metrics.clear();
  }

  destroy() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.metrics.clear();
  }
}

// Bundle analyzer utility
export const analyzeBundle = async () => {
  if (!(import.meta as any).env?.DEV) {
    return;
  }

  console.group?.('Bundle analysis');
  console.info('Bundle visualization runs during build via rollup-plugin-visualizer.');
  console.info('Run: npm run build:analyze to generate dist/bundle-report.html.');
  console.groupEnd?.();
};

// Memory usage monitoring
export const monitorMemoryUsage = () => {
  if ('memory' in performance) {
    const memInfo = (performance as any).memory;

    return {
      used: Math.round(memInfo.usedJSHeapSize / 1048576), // MB
      total: Math.round(memInfo.totalJSHeapSize / 1048576), // MB
      limit: Math.round(memInfo.jsHeapSizeLimit / 1048576), // MB
      usagePercent: Math.round((memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit) * 100),
    };
  }

  return null;
};

// Network information
export const getNetworkInfo = () => {
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
};

// Resource hints for performance
export type ResourceHint = { rel: 'dns-prefetch' | 'preconnect'; href: string; crossOrigin?: 'anonymous' | 'use-credentials' };

const defaultResourceHints: ResourceHint[] = [
  { rel: 'dns-prefetch', href: '//fonts.googleapis.com' },
  { rel: 'dns-prefetch', href: '//fonts.gstatic.com' },
  // Removed cdnjs.cloudflare.com dns-prefetch - not using any CDN resources from there
  { rel: 'preconnect', href: '//fonts.googleapis.com', crossOrigin: 'anonymous' },
  { rel: 'preconnect', href: '//fonts.gstatic.com', crossOrigin: 'anonymous' },
];

export const addResourceHints = (hints: ResourceHint[] = defaultResourceHints) => {
  if (typeof document === 'undefined') {
    return;
  }

  hints.forEach(hint => {
    const link = document.createElement('link');
    link.rel = hint.rel;
    link.href = hint.href;
    if (hint.crossOrigin) {
      link.crossOrigin = hint.crossOrigin;
    }
    document.head.appendChild(link);
  });
};

// Image optimization utilities
export const optimizeImage = (
  src: string,
  { width, height, quality = 80, format = 'webp' }: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'jpg' | 'png';
  }
) => {
  // Use a CDN or image optimization service
  const params = new URLSearchParams();

  if (width) params.set('w', width.toString());
  if (height) params.set('h', height.toString());
  if (quality) params.set('q', quality.toString());
  if (format) params.set('f', format);

  return `${src}?${params.toString()}`;
};

// Virtual scrolling for large lists
export class VirtualScroller {
  private container: HTMLElement;
  private itemHeight: number;
  private totalItems: number;
  private visibleItems: number;
  private scrollTop: number = 0;

  constructor(
    container: HTMLElement,
    itemHeight: number,
    totalItems: number,
    visibleItems: number
  ) {
    this.container = container;
    this.itemHeight = itemHeight;
    this.totalItems = totalItems;
    this.visibleItems = visibleItems;

    this.init();
  }

  private init() {
    this.container.style.height = `${this.visibleItems * this.itemHeight}px`;
    this.container.style.overflow = 'auto';

    this.container.addEventListener('scroll', this.handleScroll.bind(this));
  }

  private handleScroll() {
    this.scrollTop = this.container.scrollTop;
    const startIndex = Math.floor(this.scrollTop / this.itemHeight);
    const endIndex = Math.min(startIndex + this.visibleItems, this.totalItems);

    // Dispatch custom event with visible range
    const event = new CustomEvent('virtual-scroll', {
      detail: { startIndex, endIndex, scrollTop: this.scrollTop }
    });

    this.container.dispatchEvent(event);
  }

  getVisibleRange() {
    const startIndex = Math.floor(this.scrollTop / this.itemHeight);
    const endIndex = Math.min(startIndex + this.visibleItems, this.totalItems);

    return { startIndex, endIndex };
  }

  scrollToIndex(index: number) {
    const scrollTop = index * this.itemHeight;
    this.container.scrollTop = scrollTop;
  }

  destroy() {
    this.container.removeEventListener('scroll', this.handleScroll.bind(this));
  }
}

// Debounced function for performance
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate?: boolean
): ((...args: Parameters<T>) => void) => {
  let timeout: number | null = null;

  return (...args: Parameters<T>) => {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };

    const callNow = immediate && !timeout;

    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);

    if (callNow) func(...args);
  };
};

// Throttled function for performance
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Intersection Observer for lazy loading
export const createIntersectionObserver = (
  callback: IntersectionObserverCallback,
  options?: IntersectionObserverInit
) => {
  if ('IntersectionObserver' in window) {
    return new IntersectionObserver(callback, {
      root: null,
      rootMargin: '50px',
      threshold: 0.1,
      ...options,
    });
  }

  return null;
};

// Web Worker utilities
export class WebWorkerManager {
  private workers: Map<string, Worker> = new Map();

  createWorker(name: string, workerScript: string) {
    if (this.workers.has(name)) {
      return this.workers.get(name)!;
    }

    const worker = new Worker(workerScript);
    this.workers.set(name, worker);

    return worker;
  }

  getWorker(name: string) {
    return this.workers.get(name);
  }

  terminateWorker(name: string) {
    const worker = this.workers.get(name);
    if (worker) {
      worker.terminate();
      this.workers.delete(name);
    }
  }

  terminateAll() {
    this.workers.forEach((worker) => worker.terminate());
    this.workers.clear();
  }
}

// Initialize performance monitoring
export interface PerformanceMonitoringOptions {
  preloadAssets?: PreloadAsset[];
  resourceHints?: ResourceHint[];
  enableResourceHints?: boolean;
}

// Initialize performance monitoring
export const initPerformanceMonitoring = (options: PerformanceMonitoringOptions = {}) => {
  const monitor = PerformanceMonitor.getInstance();
  monitor.init();

  if (options.enableResourceHints !== false) {
    addResourceHints(options.resourceHints);
  }

  if (options.preloadAssets?.length) {
    preloadCriticalResources(options.preloadAssets);
  }

  return monitor;
};
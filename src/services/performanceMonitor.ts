/**
 * Performance Monitoring Service for Lugn & Trygg
 * Real-time Core Web Vitals, user experience metrics, and performance tracking
 * GDPR compliant with privacy-focused data collection
 */

import { analytics } from './analytics';
import { logger } from '../utils/logger';


// Types for performance monitoring
interface WebVitalsMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta?: number;
}



interface PerformanceBudget {
  resource: string;
  budget: number;
  unit: 'kb' | 'ms' | 'count';
  current: number;
  exceeded: boolean;
}

// Configuration
const ENABLE_PERFORMANCE_MONITORING = import.meta.env.VITE_ENABLE_PERFORMANCE_MONITORING !== 'false';
const ENABLE_CORE_WEB_VITALS = import.meta.env.VITE_ENABLE_CORE_WEB_VITALS !== 'false';
const ENABLE_USER_TIMING = import.meta.env.VITE_ENABLE_USER_TIMING !== 'false';

// Performance budgets (configurable)
const PERFORMANCE_BUDGETS: PerformanceBudget[] = [
  { resource: 'total-js-size', budget: 500, unit: 'kb', current: 0, exceeded: false },
  { resource: 'total-css-size', budget: 100, unit: 'kb', current: 0, exceeded: false },
  { resource: 'total-image-size', budget: 1000, unit: 'kb', current: 0, exceeded: false },
  { resource: 'first-contentful-paint', budget: 1800, unit: 'ms', current: 0, exceeded: false },
  { resource: 'largest-contentful-paint', budget: 2500, unit: 'ms', current: 0, exceeded: false },
  { resource: 'first-input-delay', budget: 100, unit: 'ms', current: 0, exceeded: false },
  { resource: 'cumulative-layout-shift', budget: 0.1, unit: 'count', current: 0, exceeded: false },
];

// Performance observer instances
const performanceObserver: PerformanceObserver | null = null;
let navigationObserver: PerformanceObserver | null = null;
let resourceObserver: PerformanceObserver | null = null;
const interactionObserver: PerformanceObserver | null = null;

// Core Web Vitals tracking
const trackCoreWebVitals = () => {
  if (!ENABLE_CORE_WEB_VITALS) return;

  try {
    // Dynamically import web-vitals to avoid bundle bloat
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      // Cumulative Layout Shift
      getCLS((metric: WebVitalsMetric) => {
        trackWebVitalsMetric(metric);
        checkPerformanceBudget('cumulative-layout-shift', metric.value);
      });

      // First Input Delay
      getFID((metric: WebVitalsMetric) => {
        trackWebVitalsMetric(metric);
        checkPerformanceBudget('first-input-delay', metric.value);
      });

      // First Contentful Paint
      getFCP((metric: WebVitalsMetric) => {
        trackWebVitalsMetric(metric);
        checkPerformanceBudget('first-contentful-paint', metric.value);
      });

      // Largest Contentful Paint
      getLCP((metric: WebVitalsMetric) => {
        trackWebVitalsMetric(metric);
        checkPerformanceBudget('largest-contentful-paint', metric.value);
      });

      // Time to First Byte
      getTTFB((metric: WebVitalsMetric) => {
        trackWebVitalsMetric(metric);
      });
    }).catch((error) => {
      logger.warn('Web Vitals tracking failed:', error);
    });
  } catch (error) {
    logger.warn('Core Web Vitals initialization failed:', error);
  }
};

// Track individual Web Vitals metric
const trackWebVitalsMetric = (metric: WebVitalsMetric) => {
  analytics.performance({
    name: metric.name,
    value: metric.value,
    unit: metric.name.includes('Delay') || metric.name.includes('Paint') ? 'ms' : '',
    category: 'web-vitals',
  });

  // Log performance issues
  if (metric.rating === 'poor') {
    logger.warn(`⚠️ Poor ${metric.name}: ${metric.value}`);
  } else if (metric.rating === 'needs-improvement') {
    logger.debug(`📊 ${metric.name} needs improvement: ${metric.value}`);
  }
};

// Check performance budgets
const checkPerformanceBudget = (resource: string, value: number) => {
  const budget = PERFORMANCE_BUDGETS.find(b => b.resource === resource);
  if (!budget) return;

  budget.current = value;
  budget.exceeded = value > budget.budget;

  if (budget.exceeded) {
    analytics.track('Performance Budget Exceeded', {
      resource,
      budget: budget.budget,
      actual: value,
      unit: budget.unit,
      severity: 'warning',
    });

    logger.warn(`🚨 Performance budget exceeded: ${resource} (${value}${budget.unit} > ${budget.budget}${budget.unit})`);
  }
};

// Navigation timing tracking
const trackNavigationTiming = () => {
  if (!ENABLE_PERFORMANCE_MONITORING) return;

  try {
    navigationObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const navEntry = entry as PerformanceNavigationTiming;

        // Track key navigation metrics
        analytics.performance({
          name: 'Navigation Timing',
          value: navEntry.loadEventEnd - navEntry.fetchStart,
          unit: 'ms',
          category: 'navigation',
        });

        // Track DNS lookup time
        analytics.performance({
          name: 'DNS Lookup',
          value: navEntry.domainLookupEnd - navEntry.domainLookupStart,
          unit: 'ms',
          category: 'navigation',
        });

        // Track TCP connection time
        analytics.performance({
          name: 'TCP Connection',
          value: navEntry.connectEnd - navEntry.connectStart,
          unit: 'ms',
          category: 'navigation',
        });
      }
    });

    navigationObserver.observe({ entryTypes: ['navigation'] });
  } catch (error) {
    logger.warn('Navigation timing tracking failed:', error);
  }
};

// Resource timing tracking
const trackResourceTiming = () => {
  if (!ENABLE_PERFORMANCE_MONITORING) return;

  try {
    resourceObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const resourceEntry = entry as PerformanceResourceTiming;

        // Only track resources that exceed thresholds or are slow
        const duration = resourceEntry.responseEnd - resourceEntry.requestStart;
        const size = resourceEntry.transferSize || 0;

        // Track slow resources (>500ms)
        if (duration > 500) {
          analytics.performance({
            name: 'Slow Resource',
            value: duration,
            unit: 'ms',
            category: 'resource',
          });
        }

        // Track large resources (>100KB)
        if (size > 100 * 1024) {
          analytics.performance({
            name: 'Large Resource',
            value: size / 1024,
            unit: 'kb',
            category: 'resource',
          });
        }

        // Update performance budgets
        updateResourceBudgets(resourceEntry);
      }
    });

    resourceObserver.observe({ entryTypes: ['resource'] });
  } catch (error) {
    logger.warn('Resource timing tracking failed:', error);
  }
};

// Update resource budgets based on loaded resources
const updateResourceBudgets = (entry: PerformanceResourceTiming) => {
  const size = entry.transferSize || entry.decodedBodySize || 0;
  const sizeKb = size / 1024;

  if (entry.name.includes('.js')) {
    PERFORMANCE_BUDGETS.find(b => b.resource === 'total-js-size')!.current += sizeKb;
  } else if (entry.name.includes('.css')) {
    PERFORMANCE_BUDGETS.find(b => b.resource === 'total-css-size')!.current += sizeKb;
  } else if (entry.name.match(/\.(jpg|jpeg|png|gif|webp|svg)/)) {
    PERFORMANCE_BUDGETS.find(b => b.resource === 'total-image-size')!.current += sizeKb;
  }

  // Check if budgets are exceeded
  PERFORMANCE_BUDGETS.forEach(budget => {
    if (budget.current > budget.budget && !budget.exceeded) {
      budget.exceeded = true;
      checkPerformanceBudget(budget.resource, budget.current);
    }
  });
};

// User interaction tracking
const trackUserInteractions = () => {
  if (!ENABLE_USER_TIMING) return;

  try {
    // Track click interactions
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const startTime = performance.now();

      // Use requestIdleCallback to measure interaction duration
      requestIdleCallback(() => {
        const duration = performance.now() - startTime;

        analytics.business.userInteraction('click', duration, {
          element: target.tagName.toLowerCase(),
          className: target.className,
          id: target.id,
        });
      });
    });

    // Track form interactions
    document.addEventListener('submit', (event) => {
      const form = event.target as HTMLFormElement;
      analytics.business.userInteraction('form-submit', 0, {
        formId: form.id,
        formClass: form.className,
      });
    });

  } catch (error) {
    logger.warn('User interaction tracking failed:', error);
  }
};

// Memory usage tracking
const trackMemoryUsage = () => {
  if (!ENABLE_PERFORMANCE_MONITORING) return;

  try {
    // Track memory usage every 30 seconds
    setInterval(() => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;

        analytics.performance({
          name: 'Memory Usage',
          value: memory.usedJSHeapSize / 1024 / 1024,
          unit: 'mb',
          category: 'memory',
        });

        // Warn if memory usage is high (>50MB)
        if (memory.usedJSHeapSize > 50 * 1024 * 1024) {
          logger.warn('⚠️ High memory usage detected');
        }
      }
    }, 30000);
  } catch (error) {
    logger.warn('Memory usage tracking failed:', error);
  }
};

// Custom performance marks and measures
export const performanceMonitor = {
  // Mark a performance point
  mark: (name: string) => {
    try {
      performance.mark(name);
    } catch (error) {
      logger.warn('Performance mark failed:', error);
    }
  },

  // Measure between two marks
  measure: (name: string, startMark: string, endMark: string) => {
    try {
      performance.measure(name, startMark, endMark);

      // Get the measure and track it
      const measures = performance.getEntriesByName(name, 'measure');
      if (measures.length > 0) {
        const measure = measures[0];
        analytics.performance({
          name,
          value: measure.duration,
          unit: 'ms',
          category: 'custom',
        });
      }
    } catch (error) {
      logger.warn('Performance measure failed:', error);
    }
  },

  // Track custom timing
  timing: (name: string, duration: number, category: string = 'custom') => {
    analytics.performance({
      name,
      value: duration,
      unit: 'ms',
      category,
    });
  },

  // Get performance budgets status
  getBudgetsStatus: (): PerformanceBudget[] => {
    return PERFORMANCE_BUDGETS.map(budget => ({ ...budget }));
  },

  // Check if performance is within acceptable limits
  isPerformanceGood: (): boolean => {
    return PERFORMANCE_BUDGETS.every(budget => !budget.exceeded);
  },
};

// Initialize performance monitoring
export function initializePerformanceMonitoring() {
  if (!ENABLE_PERFORMANCE_MONITORING) {
    logger.debug('⚡ Performance monitoring disabled');
    return;
  }

  logger.debug('🚀 Initializing performance monitoring...');

  try {
    // Initialize all tracking systems
    trackCoreWebVitals();
    trackNavigationTiming();
    trackResourceTiming();
    trackUserInteractions();
    trackMemoryUsage();

    // Track initial page load performance
    if (document.readyState === 'complete') {
      trackInitialPageLoad();
    } else {
      window.addEventListener('load', trackInitialPageLoad);
    }

    logger.debug('✅ Performance monitoring initialized');
  } catch (error) {
    logger.error('❌ Performance monitoring initialization failed:', error);
  }
}

// Track initial page load performance
const trackInitialPageLoad = () => {
  try {
    // Use Navigation Timing API for initial load
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

    if (navigation) {
      analytics.performance({
        name: 'Page Load Time',
        value: navigation.loadEventEnd - navigation.fetchStart,
        unit: 'ms',
        category: 'page-load',
      });

      analytics.performance({
        name: 'DOM Content Loaded',
        value: navigation.domContentLoadedEventEnd - navigation.fetchStart,
        unit: 'ms',
        category: 'page-load',
      });
    }
  } catch (error) {
    logger.warn('Initial page load tracking failed:', error);
  }
};

// Cleanup function
export function cleanupPerformanceMonitoring() {
  try {
    if (performanceObserver) {
      performanceObserver.disconnect();
    }
    if (navigationObserver) {
      navigationObserver.disconnect();
    }
    if (resourceObserver) {
      resourceObserver.disconnect();
    }
    if (interactionObserver) {
      interactionObserver.disconnect();
    }
  } catch (error) {
    logger.warn('Performance monitoring cleanup failed:', error);
  }
}

export default performanceMonitor;
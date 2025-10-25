/**
 * Performance Monitoring Hook for Lugn & Trygg
 * Tracks user interactions and performance metrics
 */

import { useEffect, useCallback } from 'react';
import { analytics } from '../services/analytics';

interface PerformanceOptions {
  trackInteractions?: boolean;
  trackRouteChanges?: boolean;
  trackComponentRenders?: boolean;
}

export const usePerformanceMonitor = (options: PerformanceOptions = {}) => {
  const {
    trackInteractions = true,
    trackRouteChanges = true,
    trackComponentRenders = false,
  } = options;

  // Track user interactions
  const trackInteraction = useCallback((interaction: string, element?: string) => {
    if (!trackInteractions) return;

    const startTime = performance.now();

    // Use requestAnimationFrame to measure interaction duration
    requestAnimationFrame(() => {
      const duration = performance.now() - startTime;
      analytics.business.userInteraction(interaction, duration, {
        element,
        component: 'usePerformanceMonitor',
      });
    });
  }, [trackInteractions]);

  // Track route changes
  useEffect(() => {
    if (!trackRouteChanges) return;

    const handleRouteChange = () => {
      analytics.page(window.location.pathname, {
        referrer: document.referrer,
        navigation_type: 'route_change',
      });
    };

    // Listen for navigation events
    window.addEventListener('popstate', handleRouteChange);

    return () => {
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, [trackRouteChanges]);

  // Track component render performance
  useEffect(() => {
    if (!trackComponentRenders) return;

    let renderCount = 0;
    const startTime = performance.now();

    const trackRender = () => {
      renderCount++;
      if (renderCount % 10 === 0) { // Track every 10 renders
        const duration = performance.now() - startTime;
        analytics.performance({
          name: 'Component Renders',
          value: renderCount,
          unit: 'count',
          category: 'render',
        });
      }
    };

    trackRender();

    return () => {
      const totalDuration = performance.now() - startTime;
      analytics.performance({
        name: 'Component Lifecycle',
        value: totalDuration,
        unit: 'ms',
        category: 'component',
      });
    };
  }, [trackComponentRenders]);

  // Track memory usage
  const trackMemoryUsage = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      analytics.performance({
        name: 'Memory Usage',
        value: memory.usedJSHeapSize / 1024 / 1024, // Convert to MB
        unit: 'MB',
        category: 'memory',
      });
    }
  }, []);

  // Track network information
  const trackNetworkInfo = useCallback(() => {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      analytics.performance({
        name: 'Network Speed',
        value: connection.downlink || 0,
        unit: 'Mbps',
        category: 'network',
      });
    }
  }, []);

  // Track device capabilities
  const trackDeviceCapabilities = useCallback(() => {
    analytics.performance({
      name: 'Device Memory',
      value: (navigator as any).deviceMemory || 0,
      unit: 'GB',
      category: 'device',
    });

    analytics.performance({
      name: 'Hardware Concurrency',
      value: navigator.hardwareConcurrency || 0,
      unit: 'cores',
      category: 'device',
    });
  }, []);

  // Initialize performance tracking
  useEffect(() => {
    // Track initial device capabilities
    trackDeviceCapabilities();
    trackNetworkInfo();

    // Set up periodic memory tracking
    const memoryInterval = setInterval(trackMemoryUsage, 30000); // Every 30 seconds

    // Track visibility changes (tab switching)
    const handleVisibilityChange = () => {
      analytics.track('Visibility Change', {
        hidden: document.hidden,
        visibility_state: document.visibilityState,
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(memoryInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [trackMemoryUsage, trackNetworkInfo, trackDeviceCapabilities]);

  return {
    trackInteraction,
    trackMemoryUsage,
    trackNetworkInfo,
    trackDeviceCapabilities,
  };
};

export default usePerformanceMonitor;
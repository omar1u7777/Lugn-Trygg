import { logger } from './logger';
// Memory Leak Detection Utility for Lugn & Trygg
// Tracks active timers, intervals, and event listeners

interface TrackedTimer {
  id: number;
  type: 'timeout' | 'interval';
  createdAt: number;
  stack?: string;
}

interface TrackedListener {
  element: string;
  event: string;
  createdAt: number;
  stack?: string;
}

class MemoryLeakDetector {
  private timers = new Map<number, TrackedTimer>();
  private listeners = new Map<string, TrackedListener>();
  private enabled = process.env.NODE_ENV === 'development';

  // Track setTimeout
  setTimeout = (callback: () => void, delay: number): number => {
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      callback();
    }, delay);

    if (this.enabled) {
      this.timers.set(id, {
        id,
        type: 'timeout',
        createdAt: Date.now(),
        stack: new Error().stack
      });
    }

    return id;
  };

  // Track setInterval
  setInterval = (callback: () => void, delay: number): number => {
    const id = window.setInterval(callback, delay);

    if (this.enabled) {
      this.timers.set(id, {
        id,
        type: 'interval',
        createdAt: Date.now(),
        stack: new Error().stack
      });
    }

    return id;
  };

  // Track clearTimeout
  clearTimeout = (id: number): void => {
    if (this.enabled && this.timers.has(id)) {
      this.timers.delete(id);
    }
    window.clearTimeout(id);
  };

  // Track clearInterval
  clearInterval = (id: number): void => {
    if (this.enabled && this.timers.has(id)) {
      this.timers.delete(id);
    }
    window.clearInterval(id);
  };

  // Track addEventListener
  addEventListener = (element: EventTarget, event: string, listener: EventListener): void => {
    const key = `${element.toString()}-${event}-${Date.now()}`;

    if (this.enabled) {
      this.listeners.set(key, {
        element: element.toString(),
        event,
        createdAt: Date.now(),
        stack: new Error().stack
      });
    }

    element.addEventListener(event, listener);
  };

  // Track removeEventListener
  removeEventListener = (element: EventTarget, event: string, listener: EventListener): void => {
    // Note: We can't perfectly match listeners, but we can clean up our tracking
    if (this.enabled) {
      // Remove the most recent matching listener
      for (const [key, tracked] of this.listeners) {
        if (tracked.element === element.toString() && tracked.event === event) {
          this.listeners.delete(key);
          break;
        }
      }
    }

    element.removeEventListener(event, listener);
  };

  // Report potential memory leaks
  reportLeaks = (): void => {
    if (!this.enabled) return;

    const now = Date.now();
    const leakThreshold = 5 * 60 * 1000; // 5 minutes

    // Check for old timers
    const oldTimers = Array.from(this.timers.values()).filter(
      timer => now - timer.createdAt > leakThreshold
    );

    if (oldTimers.length > 0) {
      logger.warn('🚨 Potential Memory Leaks - Active Timers:', oldTimers);
    }

    // Check for old listeners
    const oldListeners = Array.from(this.listeners.values()).filter(
      listener => now - listener.createdAt > leakThreshold
    );

    if (oldListeners.length > 0) {
      logger.warn('🚨 Potential Memory Leaks - Active Event Listeners:', oldListeners);
    }

    // Summary
    logger.debug(`📊 Memory Tracker: ${this.timers.size} timers, ${this.listeners.size} listeners`);
  };

  // Start periodic reporting
  startReporting = (intervalMs = 60000): void => {
    if (!this.enabled) return;

    this.setInterval(() => {
      this.reportLeaks();
    }, intervalMs);
  };
}

// Global instance
export const memoryLeakDetector = new MemoryLeakDetector();

// Override global functions in development
if (process.env.NODE_ENV === 'development') {
  // Temporarily disabled due to type conflicts
  // const originalSetTimeout = window.setTimeout;
  // const originalSetInterval = window.setInterval;
  // const originalClearTimeout = window.clearTimeout;
  // const originalClearInterval = window.clearInterval;

  // window.setTimeout = memoryLeakDetector.setTimeout.bind(memoryLeakDetector);
  // window.setInterval = memoryLeakDetector.setInterval.bind(memoryLeakDetector);
  // window.clearTimeout = memoryLeakDetector.clearTimeout.bind(memoryLeakDetector);
  // window.clearInterval = memoryLeakDetector.clearInterval.bind(memoryLeakDetector);

  // Start reporting
  // memoryLeakDetector.startReporting();
}
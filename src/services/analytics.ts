/**
 * Advanced Analytics & Monitoring Service for Lugn & Trygg
 * Comprehensive tracking for user behavior, performance, and health metrics
 * GDPR compliant with privacy-focused data collection
 */

import { logger } from '../utils/logger';

type AnalyticsProperties = Record<string, unknown>;

interface WebVitalMetric {
  value: number;
}

interface AmplitudeInstanceLike {
  logEvent: (eventName: string, properties?: AnalyticsProperties) => void;
  getSessionId?: () => number;
  setUserId: (userId: string) => void;
  setUserProperties: (properties: AnalyticsProperties) => void;
  clearUserProperties?: () => void;
}

interface AmplitudeGlobal {
  getInstance: () => AmplitudeInstanceLike;
}

interface AnalyticsWindow extends Window {
  gtag?: (...args: unknown[]) => void;
  va?: (...args: unknown[]) => void;
  amplitude?: AmplitudeGlobal;
}

// CRITICAL FIX: Use function to safely get window reference to prevent TDZ errors
const getAppWindow = (): AnalyticsWindow | undefined => {
  if (typeof window !== 'undefined') {
    return window as AnalyticsWindow;
  }
  return undefined;
};

const appWindow = getAppWindow();

// Sentry for production error tracking
// Only initialized when VITE_SENTRY_DSN is set — no-ops gracefully otherwise
let Sentry: {
  init: (options?: Record<string, unknown>) => void;
  setUser: (user?: { id?: string; email?: string; username?: string }) => void;
  captureException: (error?: Error, context?: Record<string, unknown>) => void;
  captureMessage: (message?: string, level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug') => void;
  addBreadcrumb: (breadcrumb?: Record<string, unknown>) => void;
};

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || '';

if (SENTRY_DSN) {
  // Dynamic import to avoid bundling Sentry when not configured
  import('@sentry/react').then((SentryModule) => {
    Sentry = SentryModule;
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: import.meta.env.MODE || 'production',
      tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: import.meta.env.PROD ? 1.0 : 0,
      enabled: import.meta.env.PROD,
    });
    logger.debug('✅ Sentry initialized for error tracking');
  }).catch((err) => {
    logger.warn('⚠️ Failed to load Sentry SDK:', err);
  });
} else {
  // No DSN configured — use silent no-ops (safe for development)
  Sentry = {
    init: () => {},
    setUser: () => {},
    captureException: () => {},
    captureMessage: () => {},
    addBreadcrumb: () => {},
  };
  if (import.meta.env.DEV) {
    logger.debug('ℹ️ Sentry not configured (VITE_SENTRY_DSN not set) — error tracking disabled');
  }
}

// Types for analytics
interface UserProperties {
  userId?: string;
  email?: string;
  role?: string;
  subscription?: string;
  language?: string;
  theme?: string;
}

interface PerformanceMetric {
  name: string;
  value: number;
  unit?: string;
  category?: string;
}

interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  url?: string;
  userAgent?: string;
  [key: string]: unknown;
}

// Configuration
const VERCEL_ANALYTICS_ID = import.meta.env.VITE_VERCEL_ANALYTICS_ID || '';
const ENABLE_WEB_VITALS = import.meta.env.VITE_ENABLE_WEB_VITALS !== 'false';

// Analytics instances
const firebaseAnalytics: unknown = null;
const amplitudeInstance: AmplitudeInstanceLike | null = null;

// Production optimization: disable analytics in development unless explicitly enabled
const ENABLE_ANALYTICS = import.meta.env.PROD || import.meta.env.VITE_FORCE_ANALYTICS === 'true';

// Core Analytics Service
export const analytics = {
  // Page tracking
  page: (pageName: string, properties: AnalyticsProperties = {}) => {
    const pageData = {
      page: pageName,
      url: window.location.href,
      referrer: document.referrer,
      timestamp: Date.now(),
      ...properties,
    };

    try {
      // Amplitude
      if (amplitudeInstance) {
        amplitudeInstance.logEvent('Page Viewed', pageData);
      }

      // Firebase
      if (firebaseAnalytics && appWindow.gtag) {
        appWindow.gtag('event', 'page_view', {
          page_title: pageName,
          page_location: window.location.href,
          ...properties,
        });
      }

      // Vercel Analytics
      if (appWindow.va && VERCEL_ANALYTICS_ID) {
        appWindow.va('pageview');
      }

      logger.debug('📊 Page tracked:', pageData);
    } catch (error) {
      logger.warn('Page tracking failed:', error);
    }
  },

  // Event tracking
  track: (eventName: string, properties: AnalyticsProperties = {}) => {
    const eventData = {
      timestamp: Date.now(),
      sessionId: amplitudeInstance?.getSessionId?.() || Date.now(),
      ...properties,
    };

    try {
      // Amplitude
      if (amplitudeInstance) {
        amplitudeInstance.logEvent(eventName, eventData);
      }

      // Firebase
      if (firebaseAnalytics && appWindow.gtag) {
        appWindow.gtag('event', eventName, properties);
      }

      // Vercel Analytics
      if (appWindow.va && VERCEL_ANALYTICS_ID) {
        appWindow.va('event', { name: eventName, properties });
      }

      logger.debug('📊 Event tracked:', eventName, eventData);
    } catch (error) {
      logger.warn('Event tracking failed:', error);
    }
  },

  // User identification and properties
  identify: (userId: string, properties: UserProperties = {}) => {
    try {
      const userData = {
        userId,
        ...properties,
        identifiedAt: Date.now(),
      };

      // Amplitude
      if (amplitudeInstance) {
        amplitudeInstance.setUserId(userId);
        amplitudeInstance.setUserProperties(userData);
      }

      // Firebase
      if (firebaseAnalytics && appWindow.gtag) {
        appWindow.gtag('config', import.meta.env.VITE_FIREBASE_MEASUREMENT_ID, {
          user_id: userId,
          custom_map: properties,
        });
      }

      // Sentry
      Sentry.setUser({
        id: userId,
        email: properties.email || '',
        username: properties.email?.split('@')[0] || '',
      });

      logger.debug('👤 User identified:', userData);
    } catch (error) {
      logger.warn('User identification failed:', error);
    }
  },

  // Error tracking
  error: (error: Error, context: ErrorContext = {}) => {
    const errorData = {
      message: error.message,
      stack: error.stack,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      ...context,
    };

    try {
      // Sentry
      Sentry.captureException(error, {
        tags: {
          component: context.component,
          action: context.action,
        },
        contexts: {
          error: errorData,
        },
      });

      // Amplitude
      if (amplitudeInstance) {
        amplitudeInstance.logEvent('Error Occurred', errorData);
      }

      logger.error('❌ Error tracked:', errorData);
    } catch (err) {
      logger.warn('Error tracking failed:', err);
    }
  },

  // Performance tracking
  performance: (metric: PerformanceMetric) => {
    const performanceData = {
      ...metric,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      connection: (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType || 'unknown',
      deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 'unknown',
    };

    try {
      // Amplitude
      if (amplitudeInstance) {
        amplitudeInstance.logEvent('Performance Metric', performanceData);
      }

      // Firebase
      if (firebaseAnalytics && appWindow.gtag) {
        appWindow.gtag('event', 'performance', {
          event_category: 'performance',
          event_label: metric.name,
          value: metric.value,
          custom_map: {
            unit: metric.unit,
            category: metric.category,
            connection: performanceData.connection,
            device_memory: performanceData.deviceMemory,
          },
        });
      }

      // Sentry performance tracking
      Sentry.addBreadcrumb({
        category: 'performance',
        message: `${metric.name}: ${metric.value}${metric.unit}`,
        level: 'info',
        data: performanceData,
      });

      logger.debug('⚡ Performance tracked:', performanceData);
    } catch (error) {
      logger.warn('Performance tracking failed:', error);
    }
  },

  // Business metrics
  business: {
    moodLogged: (mood: number, context: AnalyticsProperties = {}) => {
      analytics.track('Mood Logged', {
        mood_value: mood,
        mood_category: mood > 7 ? 'positive' : mood > 4 ? 'neutral' : 'negative',
        ...context,
      });
    },

    memoryRecorded: (type: string, context: AnalyticsProperties = {}) => {
      analytics.track('Memory Recorded', {
        memory_type: type,
        ...context,
      });
    },

    // CRITICAL FIX: Add error method for business error tracking
    error: (message: string, context: AnalyticsProperties = {}) => {
      const error = new Error(message);
      analytics.error(error, {
        ...context,
        category: 'business',
      });
    },

    chatbotInteraction: (message: string, response: string, context: AnalyticsProperties = {}) => {
      analytics.track('Chatbot Interaction', {
        message_length: message.length,
        response_length: response.length,
        has_therapist_recommendation: response.includes('terapeut') || response.includes('professionell'),
        ...context,
      });
    },

    featureUsed: (feature: string, context: AnalyticsProperties = {}) => {
      analytics.track('Feature Used', {
        feature_name: feature,
        ...context,
      });
    },

    subscriptionEvent: (event: string, plan?: string, context: AnalyticsProperties = {}) => {
      analytics.track('Subscription Event', {
        event_type: event,
        subscription_plan: plan,
        ...context,
      });
    },

    // API performance tracking
    apiCall: (endpoint: string, method: string, duration: number, status: number, context: AnalyticsProperties = {}) => {
      analytics.track('API Call', {
        endpoint,
        method,
        duration_ms: duration,
        status_code: status,
        success: status >= 200 && status < 300,
        ...context,
      });

      // Track slow API calls
      if (duration > 2000) {
        analytics.performance({
          name: 'Slow API Call',
          value: duration,
          unit: 'ms',
          category: 'api',
        });
      }
    },

    // User interaction performance
    userInteraction: (interaction: string, duration: number, context: AnalyticsProperties = {}) => {
      analytics.track('User Interaction', {
        interaction_type: interaction,
        duration_ms: duration,
        ...context,
      });

      // Track slow interactions
      if (duration > 100) {
        analytics.performance({
          name: 'Slow User Interaction',
          value: duration,
          unit: 'ms',
          category: 'interaction',
        });
      }
    },
  },

  // Privacy and compliance
  privacy: {
    consentGiven: (consents: string[]) => {
      analytics.track('Privacy Consent Given', {
        consents_given: consents,
        timestamp: Date.now(),
      });
    },

    dataExportRequested: () => {
      analytics.track('Data Export Requested', {
        timestamp: Date.now(),
      });
    },

    accountDeleted: () => {
      analytics.track('Account Deleted', {
        timestamp: Date.now(),
      });
    },
  },

  // Health and safety monitoring
  health: {
    crisisDetected: (indicators: string[], context: AnalyticsProperties = {}) => {
      // High priority - ensure this gets tracked
      analytics.track('Crisis Indicators Detected', {
        indicators,
        severity: 'high',
        requires_attention: true,
        ...context,
      });

      // Also send to Sentry for monitoring
      Sentry.captureMessage('Crisis indicators detected', {
        level: 'warning',
        tags: { type: 'crisis_detection' },
        contexts: { crisis: { indicators, ...context } },
      });
    },

    safetyCheckCompleted: (result: 'safe' | 'concerning' | 'critical', context: AnalyticsProperties = {}) => {
      analytics.track('Safety Check Completed', {
        result,
        severity: result === 'critical' ? 'high' : result === 'concerning' ? 'medium' : 'low',
        ...context,
      });
    },
  },
};

// Web Vitals tracking
const trackWebVitals = () => {
  try {
    // Core Web Vitals
    import('web-vitals').then((webVitals: {
      getCLS: (onReport: (metric: WebVitalMetric) => void) => void;
      getFID: (onReport: (metric: WebVitalMetric) => void) => void;
      getFCP: (onReport: (metric: WebVitalMetric) => void) => void;
      getLCP: (onReport: (metric: WebVitalMetric) => void) => void;
      getTTFB: (onReport: (metric: WebVitalMetric) => void) => void;
    }) => {
      const { getCLS, getFID, getFCP, getLCP, getTTFB } = webVitals;

      getCLS((metric: WebVitalMetric) => analytics.performance({
        name: 'CLS',
        value: metric.value,
        unit: metric.value.toString(),
        category: 'web-vitals',
      }));

      getFID((metric: WebVitalMetric) => analytics.performance({
        name: 'FID',
        value: metric.value,
        unit: 'ms',
        category: 'web-vitals',
      }));

      getFCP((metric: WebVitalMetric) => analytics.performance({
        name: 'FCP',
        value: metric.value,
        unit: 'ms',
        category: 'web-vitals',
      }));

      getLCP((metric: WebVitalMetric) => analytics.performance({
        name: 'LCP',
        value: metric.value,
        unit: 'ms',
        category: 'web-vitals',
      }));

      getTTFB((metric: WebVitalMetric) => analytics.performance({
        name: 'TTFB',
        value: metric.value,
        unit: 'ms',
        category: 'web-vitals',
      }));
    }).catch((error) => {
      logger.warn('Web Vitals import failed:', error);
    });
  } catch (error) {
    logger.warn('Web Vitals tracking failed:', error);
  }
};

/**
  * Initialize Analytics Services
  */
export function initializeAnalytics() {
  if (!ENABLE_ANALYTICS) {
    logger.debug('📊 Analytics disabled for development');
    return;
  }

  logger.debug('🚀 Initializing analytics services...');

  try {
    // Track Web Vitals (only if enabled)
    if (ENABLE_WEB_VITALS) {
      trackWebVitals();
    }

    // Track initial page view
    analytics.page('App Loaded', {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
    });

    logger.debug('✅ Analytics initialized successfully');
  } catch (error) {
    logger.error('❌ Analytics initialization failed:', error);
  }
}

/**
 * Track events with Amplitude
 */
export function trackEvent(eventName: string, properties?: AnalyticsProperties) {
  try {
    if (typeof window !== 'undefined' && appWindow.amplitude) {
      appWindow.amplitude.getInstance().logEvent(eventName, properties);
    }
    logger.debug(`📊 Event tracked: ${eventName}`, properties);
  } catch (error) {
    logger.error('Failed to track event:', error);
    trackError(error as Error);
  }
}

/**
 * Set user properties for segmentation
 */
export function setUserProperties(userId: string, properties: AnalyticsProperties) {
  try {
    if (typeof window !== 'undefined' && appWindow.amplitude) {
      appWindow.amplitude.getInstance().setUserId(userId);
      appWindow.amplitude.getInstance().setUserProperties(properties);
    }
    Sentry.setUser({ id: userId });
    logger.debug('👤 User properties set:', properties);
  } catch (error) {
    logger.error('Failed to set user properties:', error);
  }
}

/**
 * Clear user data (on logout)
 */
export function clearUserData() {
  try {
    if (typeof window !== 'undefined' && appWindow.amplitude) {
      appWindow.amplitude.getInstance().clearUserProperties?.();
    }
    Sentry.setUser(null);
    logger.debug('🧹 User data cleared');
  } catch (error) {
    logger.error('Failed to clear user data:', error);
  }
}

/**
 * Track page views
 */
export function trackPageView(pageName: string, properties?: AnalyticsProperties) {
  trackEvent('page_view', {
    page_name: pageName,
    timestamp: new Date().toISOString(),
    ...properties,
  });
}

/**
 * Track feature usage
 */
export function trackFeatureUsage(
  featureName: string,
  action: string,
  properties?: AnalyticsProperties
) {
  trackEvent('feature_usage', {
    feature: featureName,
    action,
    timestamp: new Date().toISOString(),
    ...properties,
  });
}

/**
 * Track meditation sessions
 */
export function trackMeditationSession(
  meditationId: string,
  duration: number,
  completed: boolean,
  mood?: string
) {
  trackEvent('meditation_session', {
    meditation_id: meditationId,
    duration_seconds: duration,
    completed,
    mood,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Track mood check-in
 */
export function trackMoodCheckIn(mood: string, intensity: number) {
  trackEvent('mood_check_in', {
    mood,
    intensity,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Track retention metrics
 */
export function trackRetention(daysSinceSignup: number) {
  trackEvent('retention', {
    days_since_signup: daysSinceSignup,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Track errors to Sentry
 */
export function trackError(error: Error) {
  try {
    Sentry.captureException(error);
    logger.error('🚨 Error tracked in Sentry:', error);
  } catch (e) {
    logger.error('Failed to track error:', e);
  }
}

export default {
  initializeAnalytics,
  trackEvent,
  setUserProperties,
  clearUserData,
  trackPageView,
  trackFeatureUsage,
  trackMeditationSession,
  trackMoodCheckIn,
  trackRetention,
  trackError,
};

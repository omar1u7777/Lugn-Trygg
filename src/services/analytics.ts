/**
 * Advanced Analytics & Monitoring Service for Lugn & Trygg
 * Comprehensive tracking for user behavior, performance, and health metrics
 * GDPR compliant with privacy-focused data collection
 */

import amplitude from 'amplitude-js';
import * as Sentry from '@sentry/react';
import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';

// Types for analytics
interface AnalyticsEvent {
  name: string;
  properties?: Record<string, any>;
  timestamp?: number;
}

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
}

// Configuration
const AMPLITUDE_API_KEY = import.meta.env.VITE_AMPLITUDE_API_KEY || '';
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || '';
const VERCEL_ANALYTICS_ID = import.meta.env.VITE_VERCEL_ANALYTICS_ID || '';
const ENABLE_PERFORMANCE_MONITORING = import.meta.env.VITE_ENABLE_PERFORMANCE_MONITORING !== 'false';
const PERFORMANCE_SAMPLE_RATE = parseFloat(import.meta.env.VITE_PERFORMANCE_SAMPLE_RATE || '0.1');
const ENABLE_WEB_VITALS = import.meta.env.VITE_ENABLE_WEB_VITALS !== 'false';

// Analytics instances
let firebaseAnalytics: any = null;
let amplitudeInstance: any = null;

// Production optimization: disable analytics in development unless explicitly enabled
const ENABLE_ANALYTICS = import.meta.env.PROD || import.meta.env.VITE_FORCE_ANALYTICS === 'true';

// Initialize Amplitude
const initializeAmplitude = () => {
  // Temporarily disable Amplitude due to invalid API key (400 Bad Request)
  console.log('📊 Amplitude Analytics disabled - API key needs configuration');
  return;
  
  if (ENABLE_ANALYTICS && AMPLITUDE_API_KEY && !amplitudeInstance) {
    amplitudeInstance = amplitude.getInstance();
    amplitudeInstance.init(AMPLITUDE_API_KEY, undefined, {
      includeUtm: true,
      includeReferrer: true,
      trackingOptions: {
        city: false,
        ip_address: false,
        language: true,
        platform: true,
        region: false,
        dma: false,
      },
      // Privacy-focused settings
      disableCookies: false,
      deviceIdFromUrlParam: false,
      optOut: false,
      serverZone: 'EU', // GDPR compliance
    });

    // Set up session tracking
    amplitudeInstance.setSessionId(Date.now());
  }
};

// Initialize Sentry
const initializeSentry = () => {
  if (ENABLE_ANALYTICS && SENTRY_DSN) {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: import.meta.env.MODE,
      release: import.meta.env.VITE_APP_VERSION || '1.0.0',
      integrations: [
        // Note: BrowserTracing and Replay may not be available in all Sentry versions
        // Using basic integrations for compatibility
      ],
      // Performance monitoring - reduced in production for bundle size
      tracesSampleRate: import.meta.env.PROD ? 0.05 : 0.1,
      replaysSessionSampleRate: import.meta.env.PROD ? 0.005 : 0.01,
      replaysOnErrorSampleRate: 0.5,

      // Privacy and compliance
      beforeSend: (event) => {
        // Remove sensitive data
        if (event.request?.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['x-api-key'];
        }
        return event;
      },
    });

    // Set user context if available
    const user = getCurrentUser();
    if (user) {
      Sentry.setUser({
        id: user.id,
        email: user.email,
        username: user.username,
      });
    }
  }
};

// Initialize Firebase Analytics
const initializeFirebaseAnalytics = async () => {
  if (!ENABLE_ANALYTICS) return;

  try {
    // Temporarily disable Firebase Analytics due to 403 config errors
    console.log('📊 Firebase Analytics disabled due to configuration issues');
    return;

    const firebaseConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
      measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
    };

    // Skip if measurementId is not available (Analytics not enabled)
    if (!firebaseConfig.measurementId) {
      console.log('📊 Firebase Analytics skipped - no measurement ID');
      return;
    }

    const app = initializeApp(firebaseConfig);
    if (await isSupported()) {
      firebaseAnalytics = getAnalytics(app);

      // Set up Firebase Analytics configuration
      if ((window as any).gtag) {
        (window as any).gtag('config', firebaseConfig.measurementId, {
          anonymize_ip: true,
          allow_google_signals: false,
          allow_ad_features: false,
        });
      }
    }
  } catch (error) {
    console.warn('Firebase Analytics initialization failed:', error);
  }
};

// Helper function to get current user (implement based on your auth system)
const getCurrentUser = () => {
  try {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  } catch {
    return null;
  }
};

// Core Analytics Service
export const analytics = {
  // Page tracking
  page: (pageName: string, properties: Record<string, any> = {}) => {
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
      if (firebaseAnalytics && (window as any).gtag) {
        (window as any).gtag('event', 'page_view', {
          page_title: pageName,
          page_location: window.location.href,
          ...properties,
        });
      }

      // Vercel Analytics
      if ((window as any).va && VERCEL_ANALYTICS_ID) {
        (window as any).va('pageview');
      }

      console.log('📊 Page tracked:', pageData);
    } catch (error) {
      console.warn('Page tracking failed:', error);
    }
  },

  // Event tracking
  track: (eventName: string, properties: Record<string, any> = {}) => {
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
      if (firebaseAnalytics && (window as any).gtag) {
        (window as any).gtag('event', eventName, properties);
      }

      // Vercel Analytics
      if ((window as any).va && VERCEL_ANALYTICS_ID) {
        (window as any).va('event', { name: eventName, properties });
      }

      console.log('📊 Event tracked:', eventName, eventData);
    } catch (error) {
      console.warn('Event tracking failed:', error);
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
      if (firebaseAnalytics && (window as any).gtag) {
        (window as any).gtag('config', import.meta.env.VITE_FIREBASE_MEASUREMENT_ID, {
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

      console.log('👤 User identified:', userData);
    } catch (error) {
      console.warn('User identification failed:', error);
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

      console.error('❌ Error tracked:', errorData);
    } catch (err) {
      console.warn('Error tracking failed:', err);
    }
  },

  // Performance tracking
  performance: (metric: PerformanceMetric) => {
    const performanceData = {
      ...metric,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      connection: (navigator as any).connection?.effectiveType || 'unknown',
      deviceMemory: (navigator as any).deviceMemory || 'unknown',
    };

    try {
      // Amplitude
      if (amplitudeInstance) {
        amplitudeInstance.logEvent('Performance Metric', performanceData);
      }

      // Firebase
      if (firebaseAnalytics && (window as any).gtag) {
        (window as any).gtag('event', 'performance', {
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

      console.log('⚡ Performance tracked:', performanceData);
    } catch (error) {
      console.warn('Performance tracking failed:', error);
    }
  },

  // Business metrics
  business: {
    moodLogged: (mood: number, context: Record<string, any> = {}) => {
      analytics.track('Mood Logged', {
        mood_value: mood,
        mood_category: mood > 7 ? 'positive' : mood > 4 ? 'neutral' : 'negative',
        ...context,
      });
    },

    memoryRecorded: (type: string, context: Record<string, any> = {}) => {
      analytics.track('Memory Recorded', {
        memory_type: type,
        ...context,
      });
    },

    chatbotInteraction: (message: string, response: string, context: Record<string, any> = {}) => {
      analytics.track('Chatbot Interaction', {
        message_length: message.length,
        response_length: response.length,
        has_therapist_recommendation: response.includes('terapeut') || response.includes('professionell'),
        ...context,
      });
    },

    featureUsed: (feature: string, context: Record<string, any> = {}) => {
      analytics.track('Feature Used', {
        feature_name: feature,
        ...context,
      });
    },

    subscriptionEvent: (event: string, plan?: string, context: Record<string, any> = {}) => {
      analytics.track('Subscription Event', {
        event_type: event,
        subscription_plan: plan,
        ...context,
      });
    },

    // API performance tracking
    apiCall: (endpoint: string, method: string, duration: number, status: number, context: Record<string, any> = {}) => {
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
    userInteraction: (interaction: string, duration: number, context: Record<string, any> = {}) => {
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
    crisisDetected: (indicators: string[], context: Record<string, any> = {}) => {
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

    safetyCheckCompleted: (result: 'safe' | 'concerning' | 'critical', context: Record<string, any> = {}) => {
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
    import('web-vitals').then((webVitals: any) => {
      const { getCLS, getFID, getFCP, getLCP, getTTFB } = webVitals;

      getCLS((metric: any) => analytics.performance({
        name: 'CLS',
        value: metric.value,
        unit: metric.value.toString(),
        category: 'web-vitals',
      }));

      getFID((metric: any) => analytics.performance({
        name: 'FID',
        value: metric.value,
        unit: 'ms',
        category: 'web-vitals',
      }));

      getFCP((metric: any) => analytics.performance({
        name: 'FCP',
        value: metric.value,
        unit: 'ms',
        category: 'web-vitals',
      }));

      getLCP((metric: any) => analytics.performance({
        name: 'LCP',
        value: metric.value,
        unit: 'ms',
        category: 'web-vitals',
      }));

      getTTFB((metric: any) => analytics.performance({
        name: 'TTFB',
        value: metric.value,
        unit: 'ms',
        category: 'web-vitals',
      }));
    }).catch((error) => {
      console.warn('Web Vitals import failed:', error);
    });
  } catch (error) {
    console.warn('Web Vitals tracking failed:', error);
  }
};

/**
  * Initialize Analytics Services
  */
export function initializeAnalytics() {
  if (!ENABLE_ANALYTICS) {
    console.log('📊 Analytics disabled for development');
    return;
  }

  console.log('🚀 Initializing analytics services...');

  try {
    // Initialize in order
    initializeAmplitude();
    initializeSentry();
    initializeFirebaseAnalytics();

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

    console.log('✅ Analytics initialized successfully');
  } catch (error) {
    console.error('❌ Analytics initialization failed:', error);
  }
}

/**
 * Track events with Amplitude
 */
export function trackEvent(eventName: string, properties?: Record<string, any>) {
  try {
    if (typeof window !== 'undefined' && (window as any).amplitude) {
      (window as any).amplitude.getInstance().logEvent(eventName, properties);
    }
    console.log(`📊 Event tracked: ${eventName}`, properties);
  } catch (error) {
    console.error('Failed to track event:', error);
    trackError(error as Error);
  }
}

/**
 * Set user properties for segmentation
 */
export function setUserProperties(userId: string, properties: Record<string, any>) {
  try {
    if (typeof window !== 'undefined' && (window as any).amplitude) {
      (window as any).amplitude.getInstance().setUserId(userId);
      (window as any).amplitude.getInstance().setUserProperties(properties);
    }
    Sentry.setUser({ id: userId });
    console.log('👤 User properties set:', properties);
  } catch (error) {
    console.error('Failed to set user properties:', error);
  }
}

/**
 * Clear user data (on logout)
 */
export function clearUserData() {
  try {
    if (typeof window !== 'undefined' && (window as any).amplitude) {
      (window as any).amplitude.getInstance().clearUserProperties();
    }
    Sentry.setUser(null);
    console.log('🧹 User data cleared');
  } catch (error) {
    console.error('Failed to clear user data:', error);
  }
}

/**
 * Track page views
 */
export function trackPageView(pageName: string, properties?: Record<string, any>) {
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
  properties?: Record<string, any>
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
    console.error('🚨 Error tracked in Sentry:', error);
  } catch (e) {
    console.error('Failed to track error:', e);
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

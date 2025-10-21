/**
 * Analytics Service for Lugn & Trygg
 * Tracks user behavior using Amplitude
 * Errors are tracked with Sentry
 */

import * as Sentry from '@sentry/react';
import { isDevEnvironment } from '../config/env';

// Declare amplitude module to avoid TypeScript errors
declare const amplitude: any;

// Initialize Amplitude (public API key - safe for client-side)
const AMPLITUDE_API_KEY = 'e9a1c9b9c9c9c9c9c9c9c9c9c9c9c9c9'; // Replace with actual key
const SENTRY_DSN = ''; // Replace with actual DSN if you want Sentry error tracking

/**
 * Initialize Analytics Services
 */
export function initializeAnalytics() {
  try {
    // Initialize Sentry for error tracking (only if DSN is provided)
    if (SENTRY_DSN) {
      Sentry.init({
        dsn: SENTRY_DSN,
        environment: isDevEnvironment() ? 'development' : 'production',
        tracesSampleRate: 1.0,
      } as any);
    }

    // Initialize Amplitude (if available)
    if (typeof window !== 'undefined' && (window as any).amplitude) {
      (window as any).amplitude.getInstance().init(AMPLITUDE_API_KEY, null, {
        useHttps: true,
        batchEvents: true,
        eventUploadThreshold: 10,
      });
    }

    console.log('📊 Analytics initialized: Sentry + Amplitude');
  } catch (error) {
    console.error('Failed to initialize analytics:', error);
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

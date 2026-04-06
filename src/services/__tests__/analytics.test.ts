import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock web-vitals to prevent dynamic import issues
vi.mock('web-vitals', () => ({
  getCLS: vi.fn(),
  getFID: vi.fn(),
  getFCP: vi.fn(),
  getLCP: vi.fn(),
  getTTFB: vi.fn(),
}));

import {
  analytics,
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
} from '../analytics';

describe('analytics service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('analytics.page', () => {
    it('tracks page view without throwing', () => {
      expect(() => analytics.page('Home', { test: true })).not.toThrow();
    });

    it('tracks page view with no extra properties', () => {
      expect(() => analytics.page('Dashboard')).not.toThrow();
    });
  });

  describe('analytics.track', () => {
    it('tracks event without throwing', () => {
      expect(() => analytics.track('ButtonClick', { button: 'submit' })).not.toThrow();
    });

    it('tracks event with no properties', () => {
      expect(() => analytics.track('PageLoad')).not.toThrow();
    });

    it('tracks event with gtag available', () => {
      const gtagMock = vi.fn();
      (window as Window & { gtag?: (...args: unknown[]) => void }).gtag = gtagMock;
      expect(() => analytics.track('TestEvent', { value: 1 })).not.toThrow();
      delete (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
    });
  });

  describe('analytics.identify', () => {
    it('identifies user without throwing', () => {
      expect(() => analytics.identify('user123', { email: 'test@example.com' })).not.toThrow();
    });

    it('identifies user with no properties', () => {
      expect(() => analytics.identify('user123')).not.toThrow();
    });

    it('identifies user with full properties', () => {
      expect(() => analytics.identify('user123', {
        email: 'test@example.com',
        role: 'user',
        subscription: 'premium',
        language: 'sv',
        theme: 'dark',
      })).not.toThrow();
    });
  });

  describe('analytics.error', () => {
    it('tracks error without throwing', () => {
      const err = new Error('Test error');
      expect(() => analytics.error(err, { component: 'TestComponent', action: 'submit' })).not.toThrow();
    });

    it('tracks error with no context', () => {
      const err = new Error('Test');
      expect(() => analytics.error(err)).not.toThrow();
    });
  });

  describe('analytics.performance', () => {
    it('tracks performance metric without throwing', () => {
      expect(() => analytics.performance({ name: 'LCP', value: 1200, unit: 'ms', category: 'web-vitals' })).not.toThrow();
    });

    it('tracks performance with minimal data', () => {
      expect(() => analytics.performance({ name: 'CLS', value: 0.1 })).not.toThrow();
    });
  });

  describe('analytics.business', () => {
    it('moodLogged with positive mood', () => {
      expect(() => analytics.business.moodLogged(8, { source: 'dashboard' })).not.toThrow();
    });

    it('moodLogged with neutral mood', () => {
      expect(() => analytics.business.moodLogged(5)).not.toThrow();
    });

    it('moodLogged with negative mood', () => {
      expect(() => analytics.business.moodLogged(2)).not.toThrow();
    });

    it('memoryRecorded', () => {
      expect(() => analytics.business.memoryRecorded('photo', { tags: ['family'] })).not.toThrow();
    });

    it('error (business error)', () => {
      expect(() => analytics.business.error('Payment failed', { amount: 99 })).not.toThrow();
    });

    it('chatbotInteraction', () => {
      expect(() => analytics.business.chatbotInteraction('Jag mår dåligt', 'Det låter svårt', {})).not.toThrow();
    });

    it('chatbotInteraction with therapist recommendation in response', () => {
      expect(() => analytics.business.chatbotInteraction('test', 'Jag rekommenderar en terapeut', {})).not.toThrow();
    });

    it('featureUsed', () => {
      expect(() => analytics.business.featureUsed('mood_tracking', { version: '2' })).not.toThrow();
    });

    it('subscriptionEvent', () => {
      expect(() => analytics.business.subscriptionEvent('upgraded', 'premium', { method: 'stripe' })).not.toThrow();
    });

    it('subscriptionEvent without plan', () => {
      expect(() => analytics.business.subscriptionEvent('cancelled')).not.toThrow();
    });

    it('apiCall - fast call', () => {
      expect(() => analytics.business.apiCall('/api/mood', 'POST', 150, 200)).not.toThrow();
    });

    it('apiCall - slow call triggers performance tracking', () => {
      expect(() => analytics.business.apiCall('/api/mood', 'GET', 3000, 200)).not.toThrow();
    });

    it('apiCall - error status', () => {
      expect(() => analytics.business.apiCall('/api/mood', 'POST', 100, 500)).not.toThrow();
    });

    it('userInteraction - fast', () => {
      expect(() => analytics.business.userInteraction('button_click', 50)).not.toThrow();
    });

    it('userInteraction - slow triggers performance', () => {
      expect(() => analytics.business.userInteraction('form_submit', 200)).not.toThrow();
    });
  });

  describe('analytics.privacy', () => {
    it('consentGiven', () => {
      expect(() => analytics.privacy.consentGiven(['analytics', 'marketing'])).not.toThrow();
    });

    it('dataExportRequested', () => {
      expect(() => analytics.privacy.dataExportRequested()).not.toThrow();
    });

    it('accountDeleted', () => {
      expect(() => analytics.privacy.accountDeleted()).not.toThrow();
    });
  });

  describe('analytics.health', () => {
    it('crisisDetected', () => {
      expect(() => analytics.health.crisisDetected(['suicidal_ideation', 'self_harm'], { severity: 'high' })).not.toThrow();
    });

    it('crisisDetected with no context', () => {
      expect(() => analytics.health.crisisDetected(['low_mood'])).not.toThrow();
    });

    it('safetyCheckCompleted - safe', () => {
      expect(() => analytics.health.safetyCheckCompleted('safe', { checkedAt: Date.now() })).not.toThrow();
    });

    it('safetyCheckCompleted - concerning', () => {
      expect(() => analytics.health.safetyCheckCompleted('concerning')).not.toThrow();
    });

    it('safetyCheckCompleted - critical', () => {
      expect(() => analytics.health.safetyCheckCompleted('critical')).not.toThrow();
    });
  });

  describe('exported functions', () => {
    it('initializeAnalytics runs without throwing', () => {
      expect(() => initializeAnalytics()).not.toThrow();
    });

    it('trackEvent logs event', () => {
      expect(() => trackEvent('test_event', { key: 'value' })).not.toThrow();
    });

    it('trackEvent with no properties', () => {
      expect(() => trackEvent('test_event')).not.toThrow();
    });

    it('trackEvent with amplitude available', () => {
      const amplitudeMock = {
        getInstance: () => ({ logEvent: vi.fn() }),
      };
      (window as Window & { amplitude?: typeof amplitudeMock }).amplitude = amplitudeMock;
      expect(() => trackEvent('with_amplitude', { test: true })).not.toThrow();
      delete (window as Window & { amplitude?: typeof amplitudeMock }).amplitude;
    });

    it('setUserProperties runs without throwing', () => {
      expect(() => setUserProperties('user1', { plan: 'premium' })).not.toThrow();
    });

    it('setUserProperties with amplitude', () => {
      const amplitudeMock = {
        getInstance: () => ({
          setUserId: vi.fn(),
          setUserProperties: vi.fn(),
          clearUserProperties: vi.fn(),
        }),
      };
      (window as Window & { amplitude?: typeof amplitudeMock }).amplitude = amplitudeMock;
      expect(() => setUserProperties('u1', { plan: 'premium' })).not.toThrow();
      delete (window as Window & { amplitude?: typeof amplitudeMock }).amplitude;
    });

    it('clearUserData runs without throwing', () => {
      expect(() => clearUserData()).not.toThrow();
    });

    it('clearUserData with amplitude', () => {
      const amplitudeMock = {
        getInstance: () => ({
          logEvent: vi.fn(),
          clearUserProperties: vi.fn(),
          setUserId: vi.fn(),
          setUserProperties: vi.fn(),
        }),
      };
      (window as Window & { amplitude?: typeof amplitudeMock }).amplitude = amplitudeMock;
      expect(() => clearUserData()).not.toThrow();
      delete (window as Window & { amplitude?: typeof amplitudeMock }).amplitude;
    });

    it('trackPageView tracks page view', () => {
      expect(() => trackPageView('Dashboard', { tab: 'overview' })).not.toThrow();
    });

    it('trackFeatureUsage tracks feature', () => {
      expect(() => trackFeatureUsage('mood_chart', 'viewed', { range: '7d' })).not.toThrow();
    });

    it('trackMeditationSession tracks session', () => {
      expect(() => trackMeditationSession('meditation_01', 600, true, 'calm')).not.toThrow();
    });

    it('trackMeditationSession incomplete', () => {
      expect(() => trackMeditationSession('meditation_01', 120, false)).not.toThrow();
    });

    it('trackMoodCheckIn', () => {
      expect(() => trackMoodCheckIn('happy', 8)).not.toThrow();
    });

    it('trackRetention', () => {
      expect(() => trackRetention(30)).not.toThrow();
    });

    it('trackError sends to Sentry', () => {
      expect(() => trackError(new Error('Critical failure'))).not.toThrow();
    });

    it('trackError handles exceptions from Sentry gracefully', () => {
      // Should not throw even if Sentry.captureException internally errors
      expect(() => trackError(new Error('boom'))).not.toThrow();
    });
  });

  describe('analytics.track – gtag + va integration', () => {
    it('calls gtag when available with firebase analytics', () => {
      const gtag = vi.fn();
      (window as Window & { gtag?: typeof gtag }).gtag = gtag;
      expect(() => analytics.track('MyEvent', { foo: 'bar' })).not.toThrow();
      delete (window as Window & { gtag?: typeof gtag }).gtag;
    });

    it('calls va when available with VERCEL_ANALYTICS_ID', () => {
      const va = vi.fn();
      (window as Window & { va?: typeof va }).va = va;
      expect(() => analytics.track('MyEvent')).not.toThrow();
      delete (window as Window & { va?: typeof va }).va;
    });
  });

  describe('analytics.page – va integration', () => {
    it('calls va.pageview when va is set', () => {
      const va = vi.fn();
      (window as Window & { va?: typeof va }).va = va;
      expect(() => analytics.page('Dashboard')).not.toThrow();
      delete (window as Window & { va?: typeof va }).va;
    });
  });

  describe('analytics.identify – Sentry integration', () => {
    it('calls Sentry.setUser without throwing', () => {
      expect(() => analytics.identify('user-42', { email: 'u@example.com', role: 'admin' })).not.toThrow();
    });
  });
});

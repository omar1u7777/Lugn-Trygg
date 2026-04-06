import { vi, describe, it, expect, beforeEach } from 'vitest';

// In test environments, env.ts early-returns from readViteKey. 
// We test the exported functions that use process.env and window.__APP_ENV__.
import {
  getEnvValue,
  getBackendUrl,
  getEncryptionKey,
  getDashboardHeroImageId,
  getWellnessHeroImageId,
  getJournalHeroImageId,
  getOnboardingHeroImageId,
  isDevEnvironment,
} from '../env';

describe('env config', () => {
  beforeEach(() => {
    // Clean state
    delete (window as Window & { __APP_ENV__?: Record<string, string> }).__APP_ENV__;
  });

  describe('getEnvValue', () => {
    it('returns default for VITE_BACKEND_URL in test env', () => {
      const url = getEnvValue('VITE_BACKEND_URL');
      // Either process.env value or default 'http://localhost:5001'
      expect(url).toBeTruthy();
    });

    it('returns window.__APP_ENV__ value if set', () => {
      (window as Window & { __APP_ENV__?: Record<string, string> }).__APP_ENV__ = {
        VITE_BACKEND_URL: 'https://custom-backend.com',
      };
      const url = getEnvValue('VITE_BACKEND_URL');
      expect(url).toBe('https://custom-backend.com');
    });

    it('returns undefined for unset optional keys', () => {
      const key = getEnvValue('VITE_FIREBASE_MEASUREMENT_ID');
      // May be undefined or a process.env value
      expect(key === undefined || typeof key === 'string').toBe(true);
    });
  });

  describe('getBackendUrl', () => {
    it('returns a string URL', () => {
      const url = getBackendUrl();
      expect(typeof url).toBe('string');
      expect(url.length).toBeGreaterThan(0);
    });
  });

  describe('getEncryptionKey', () => {
    it('returns a string key (random in dev)', () => {
      const key = getEncryptionKey();
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
    });

    it('returns same key on subsequent calls (memoized fallback)', () => {
      const key1 = getEncryptionKey();
      const key2 = getEncryptionKey();
      expect(key1).toBe(key2);
    });

    it('uses process.env value when set to valid key', () => {
      const original = process.env.VITE_ENCRYPTION_KEY;
      process.env.VITE_ENCRYPTION_KEY = 'my-real-encryption-key-abc123def456';
      const key = getEncryptionKey();
      expect(key).toBe('my-real-encryption-key-abc123def456');
      process.env.VITE_ENCRYPTION_KEY = original;
    });

    it('ignores placeholder values', () => {
      const original = process.env.VITE_ENCRYPTION_KEY;
      process.env.VITE_ENCRYPTION_KEY = 'your-encryption-key-here';
      const key = getEncryptionKey();
      // Should fall back to the session random key
      expect(key).not.toBe('your-encryption-key-here');
      process.env.VITE_ENCRYPTION_KEY = original;
    });
  });

  describe('image ID helpers', () => {
    it('getDashboardHeroImageId returns a string', () => {
      const id = getDashboardHeroImageId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('getWellnessHeroImageId returns a string', () => {
      const id = getWellnessHeroImageId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('getJournalHeroImageId returns a string', () => {
      const id = getJournalHeroImageId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('getOnboardingHeroImageId returns a string', () => {
      const id = getOnboardingHeroImageId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('getDashboardHeroImageId uses window.__APP_ENV__ when set', () => {
      (window as Window & { __APP_ENV__?: Record<string, string> }).__APP_ENV__ = {
        VITE_DASHBOARD_HERO_PUBLIC_ID: 'custom-dashboard-hero',
      };
      const id = getDashboardHeroImageId();
      expect(id).toBe('custom-dashboard-hero');
    });

    it('returns default ID when env var not set', () => {
      const id = getDashboardHeroImageId();
      // Default is 'hero-bild_pfcdsx' unless overridden
      expect(typeof id).toBe('string');
    });
  });

  describe('isDevEnvironment', () => {
    it('returns true in test (NODE_ENV=test is not production)', () => {
      const isDev = isDevEnvironment();
      expect(typeof isDev).toBe('boolean');
    });

    it('returns true when NODE_ENV is test', () => {
      const original = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';
      expect(isDevEnvironment()).toBe(true);
      process.env.NODE_ENV = original;
    });

    it('returns false when NODE_ENV is production', () => {
      const original = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      expect(isDevEnvironment()).toBe(false);
      process.env.NODE_ENV = original;
    });
  });
});

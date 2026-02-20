/**
 * Tests for the API client (axios instance + interceptors).
 *
 * We mock all external dependencies (tokenStorage, auth, analytics,
 * offlineStorage, logger, env) so the tests focus on interceptor logic.
 */
import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';

// ─── Mocks ───────────────────────────────────────────────

vi.mock('../../config/env', () => ({
  getBackendUrl: () => 'http://localhost:5001',
}));

vi.mock('../../utils/secureStorage', () => ({
  tokenStorage: {
    getAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
    setAccessToken: vi.fn().mockResolvedValue(undefined),
    getRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
    setRefreshToken: vi.fn().mockResolvedValue(undefined),
    clearTokens: vi.fn(),
  },
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    log: vi.fn(), debug: vi.fn(), info: vi.fn(),
    warn: vi.fn(), error: vi.fn(),
  },
}));

vi.mock('../../services/analytics.lazy', () => ({
  analytics: {
    business: {
      apiCall: vi.fn(),
      error: vi.fn(),
    },
  },
}));

vi.mock('../auth', () => ({
  refreshAccessToken: vi.fn().mockResolvedValue('new-access-token'),
  logoutUser: vi.fn(),
  getCsrfToken: vi.fn().mockResolvedValue('csrf-token-123'),
}));

vi.mock('../../services/offlineStorage', () => ({
  queueRequest: vi.fn(),
}));

// ─── Import AFTER mocks ─────────────────────────────────

import { api, API_BASE_URL } from '../client';
import { tokenStorage } from '../../utils/secureStorage';

describe('API client', () => {
  describe('configuration', () => {
    it('has correct baseURL', () => {
      expect(API_BASE_URL).toBe('http://localhost:5001');
    });

    it('has 15 second timeout', () => {
      expect(api.defaults.timeout).toBe(15000);
    });

    it('sends credentials', () => {
      expect(api.defaults.withCredentials).toBe(true);
    });

    it('sets Content-Type to application/json', () => {
      expect(api.defaults.headers['Content-Type']).toBe('application/json');
    });
  });

  describe('request interceptor', () => {
    it('adds Authorization header from tokenStorage', async () => {
      // Build a minimal config object
      const config: InternalAxiosRequestConfig = {
        url: '/test',
        method: 'get',
        headers: new axios.AxiosHeaders(),
      };

      // Execute the request interceptor manually
      const interceptors = (api.interceptors.request as any).handlers;
      const fulfilled = interceptors[interceptors.length - 1]?.fulfilled;

      if (fulfilled) {
        const result = await fulfilled(config);
        expect(result.headers['Authorization']).toBe('Bearer mock-access-token');
      }
    });

    it('adds CSRF header for POST requests', async () => {
      const config: InternalAxiosRequestConfig = {
        url: '/test',
        method: 'post',
        headers: new axios.AxiosHeaders(),
      };

      const interceptors = (api.interceptors.request as any).handlers;
      const fulfilled = interceptors[interceptors.length - 1]?.fulfilled;

      if (fulfilled) {
        const result = await fulfilled(config);
        expect(result.headers['X-CSRFToken']).toBe('csrf-token-123');
      }
    });

    it('does NOT add CSRF header for GET requests', async () => {
      const config: InternalAxiosRequestConfig = {
        url: '/test',
        method: 'get',
        headers: new axios.AxiosHeaders(),
      };

      const interceptors = (api.interceptors.request as any).handlers;
      const fulfilled = interceptors[interceptors.length - 1]?.fulfilled;

      if (fulfilled) {
        const result = await fulfilled(config);
        expect(result.headers['X-CSRFToken']).toBeUndefined();
      }
    });

    it('sets startTime on config for performance tracking', async () => {
      const config: InternalAxiosRequestConfig = {
        url: '/test',
        method: 'get',
        headers: new axios.AxiosHeaders(),
      };

      const interceptors = (api.interceptors.request as any).handlers;
      const fulfilled = interceptors[interceptors.length - 1]?.fulfilled;

      if (fulfilled) {
        const before = performance.now();
        const result = await fulfilled(config);
        expect((result as any).startTime).toBeGreaterThanOrEqual(before);
      }
    });
  });

  describe('exports', () => {
    it('exports api as named export', () => {
      expect(api).toBeDefined();
      expect(typeof api.get).toBe('function');
      expect(typeof api.post).toBe('function');
    });

    it('exports apiClient as alias', async () => {
      const { apiClient } = await import('../client');
      expect(apiClient).toBe(api);
    });

    it('exports API_BASE_URL', () => {
      expect(API_BASE_URL).toBe('http://localhost:5001');
    });
  });
});

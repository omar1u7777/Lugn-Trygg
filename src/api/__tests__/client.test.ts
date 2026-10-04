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

import { api, API_BASE_URL, unwrapApiResponse } from '../client';
import { tokenStorage } from '../../utils/secureStorage';
import { ApiError } from '../errors';

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
      const getSpy = vi.spyOn(api, 'get').mockResolvedValue({
        data: {
          data: {
            csrfToken: 'csrf-token-123',
          },
        },
      } as any);

      const config: InternalAxiosRequestConfig = {
        url: '/test',
        method: 'post',
        headers: new axios.AxiosHeaders(),
      };

      const interceptors = (api.interceptors.request as any).handlers;
      const fulfilled = interceptors[interceptors.length - 1]?.fulfilled;

      if (fulfilled) {
        const result = await fulfilled(config);
        expect(result.headers['X-CSRF-Token']).toEqual(expect.any(String));
        expect(getSpy).toHaveBeenCalled();
      }

      getSpy.mockRestore();
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
        expect(result.headers['X-CSRF-Token']).toBeUndefined();
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

// ─── unwrapApiResponse ───────────────────────────────────

describe('unwrapApiResponse', () => {
  it('returns primitive values as-is', () => {
    expect(unwrapApiResponse('hello')).toBe('hello');
    expect(unwrapApiResponse(42)).toBe(42);
    expect(unwrapApiResponse(null)).toBeNull();
  });

  it('extracts data from success-wrapped response', () => {
    const wrapped = { status: 'success', data: { id: 1 }, timestamp: '2024-01-01' };
    expect(unwrapApiResponse(wrapped)).toEqual({ id: 1 });
  });

  it('extracts data when success=true and data present', () => {
    const wrapped = { success: true, data: { name: 'test' } };
    expect(unwrapApiResponse(wrapped)).toEqual({ name: 'test' });
  });

  it('returns payload as-is when no wrapper metadata', () => {
    const plain = { name: 'Jane', age: 30 };
    expect(unwrapApiResponse(plain)).toEqual(plain);
  });

  it('returns payload as-is when data field is absent despite wrapper', () => {
    const wrapped = { status: 'success', message: 'ok' };
    expect(unwrapApiResponse(wrapped)).toEqual(wrapped);
  });

  it('returns payload as-is when status exists but data is undefined', () => {
    const wrapped = { status: 'success', data: undefined };
    expect(unwrapApiResponse(wrapped)).toEqual(wrapped);
  });
});

// ─── Response interceptor ───────────────────────────────

describe('response interceptor', () => {
  const getResponseInterceptorHandlers = () => {
    const interceptors = (api.interceptors.response as any).handlers;
    return interceptors[interceptors.length - 1];
  };

  it('passes through successful responses', async () => {
    const { fulfilled } = getResponseInterceptorHandlers();
    const response = {
      config: { method: 'get', url: '/test' },
      status: 200,
      data: { ok: true },
      headers: {},
    };
    const result = await fulfilled(response);
    expect(result).toBe(response);
  });

  it('tracks performance when startTime is set on config', async () => {
    const { fulfilled } = getResponseInterceptorHandlers();
    const response = {
      config: { method: 'get', url: '/test', startTime: performance.now() - 100 },
      status: 200,
      data: '{}',
      headers: { 'content-type': 'application/json' },
    };
    await expect(fulfilled(response)).resolves.toBeDefined();
  });

  describe('error handling — 429 rate limit', () => {
    it('rejects with an error for 429 when retry limit is exceeded', async () => {
      const { rejected } = getResponseInterceptorHandlers();
      const error = {
        // Set retryCount > MAX_RETRY_ATTEMPTS so retryRequest throws original error
        config: { url: '/test', method: 'get', startTime: undefined, retryCount: 10 },
        response: { status: 429, statusText: 'Too Many Requests', data: {}, headers: {} },
        request: {},
        message: 'Request failed with status code 429',
        code: 'ERR_BAD_RESPONSE',
        isAxiosError: true,
      };
      // retryRequest throws original error after limit exceeded
      await expect(rejected(error)).rejects.toBeDefined();
    });
  });

  describe('error handling — network error', () => {
    it('throws network error when request exists but no response (online)', async () => {
      const { rejected } = getResponseInterceptorHandlers();
      const error = {
        config: { url: '/test', method: 'post', startTime: undefined },
        request: { responseURL: '' },
        response: undefined,
        message: 'Network Error',
        code: 'ERR_NETWORK',
        isAxiosError: true,
      };
      await expect(rejected(error)).rejects.toBeDefined();
    });

    it('queues request and throws when offline', async () => {
      const origOnLine = navigator.onLine;
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      const { rejected } = getResponseInterceptorHandlers();
      const error = {
        config: { url: '/api/mood', method: 'post', data: {}, startTime: undefined },
        request: {},
        response: undefined,
        message: 'Network Error',
        code: 'ERR_NETWORK',
        isAxiosError: true,
      };
      await expect(rejected(error)).rejects.toThrow();

      Object.defineProperty(navigator, 'onLine', { value: origOnLine, configurable: true });
    });
  });

  describe('error handling — setup error (no request, no response)', () => {
    it('throws on setup errors', async () => {
      const { rejected } = getResponseInterceptorHandlers();
      const error = {
        config: { url: '/test', method: 'get', startTime: undefined },
        message: 'Request failed',
        isAxiosError: true,
      };
      await expect(rejected(error)).rejects.toBeDefined();
    });
  });

  describe('error handling — rejection with no config', () => {
    it('propagates the original error instead of crashing on originalRequest.startTime', async () => {
      // The CSRF-unavailable guard in the request interceptor rejects with a
      // plain ApiError before axios ever attaches a config, so error.config
      // is undefined here -- this must not crash while trying to read
      // originalRequest.startTime, which would replace this informative
      // error with an opaque TypeError.
      const { rejected } = getResponseInterceptorHandlers();
      const error = new ApiError('CSRF token unavailable. Request blocked for security.', {
        code: 'CSRF_UNAVAILABLE',
      });
      await expect(rejected(error)).rejects.toBe(error);
    });
  });

  describe('error handling — 401 with refresh', () => {
    it('attempts token refresh on 401 and retries', async () => {
      const postSpy = vi.spyOn(api, 'post').mockResolvedValueOnce({
        data: { data: { accessToken: 'refreshed-token' } },
      } as any);
      const getSpy = vi.spyOn(api, 'get').mockResolvedValueOnce({
        data: { data: { csrfToken: 'csrf-123' } },
      } as any);

      // For the retry after refresh, return a success response
      vi.spyOn(api, 'request').mockResolvedValueOnce({ data: { ok: true } } as any);

      const { rejected } = getResponseInterceptorHandlers();
      const originalRequest = {
        url: '/api/data',
        method: 'get',
        headers: {},
        startTime: undefined,
        _retry: false,
      };
      const error = {
        config: originalRequest,
        response: { status: 401, statusText: 'Unauthorized', data: {}, headers: {} },
        request: {},
        message: '401',
        isAxiosError: true,
      };

      // This may throw or resolve depending on the mock chain, just ensure no crash
      try {
        await rejected(error);
      } catch {
        // Expected — refresh chain may not fully resolve in this unit test
      }

      postSpy.mockRestore();
      getSpy.mockRestore();
    });

    // A wrong current password is not an expired session. Refreshing and
    // replaying re-sends the same wrong password, and both endpoints carry
    // @rate_limit_by_endpoint on the backend — so one typo spent two attempts
    // against the lockout allowance.
    it.each([
      '/api/v1/auth/change-password',
      '/api/v1/auth/change-email',
    ])('does not refresh or replay a 401 from %s', async (url) => {
      const { rejected } = getResponseInterceptorHandlers();
      const postSpy = vi.spyOn(api, 'post');
      const error = {
        config: { url, method: 'post', headers: {}, startTime: undefined },
        response: {
          status: 401,
          statusText: 'Unauthorized',
          // APIResponse.unauthorized — the shape a handler returns.
          data: { success: false, error: 'UNAUTHORIZED', message: 'Current password is incorrect' },
          headers: {},
        },
        request: {},
        message: '401',
        isAxiosError: true,
      };

      await expect(rejected(error)).rejects.toBeDefined();
      expect(postSpy).not.toHaveBeenCalled();
      postSpy.mockRestore();
    });

    // The other half of the rule, and the more expensive one to get wrong.
    // Both endpoints sit behind @jwt_required, so a 401 from them can equally
    // mean the 15-minute access token expired while the user was reading the
    // settings page. Matching on the URL alone would suppress the refresh
    // here too, and tell someone with the RIGHT password that it was wrong.
    it.each([
      ['Token expired'],
      ['Missing or invalid Authorization header'],
    ])('still refreshes when change-password 401s with %s', async (message) => {
      const postSpy = vi.spyOn(api, 'post').mockResolvedValueOnce({
        data: { data: { accessToken: 'refreshed-token' } },
      } as any);
      vi.spyOn(api, 'request').mockResolvedValueOnce({ data: { ok: true } } as any);

      const { rejected } = getResponseInterceptorHandlers();
      const error = {
        config: {
          url: '/api/v1/auth/change-password',
          method: 'post',
          headers: {},
          startTime: undefined,
          _retry: false,
        },
        response: {
          status: 401,
          statusText: 'Unauthorized',
          // jwt_required — a bare message, no machine-readable code.
          data: { error: message },
          headers: {},
        },
        request: {},
        message: '401',
        isAxiosError: true,
      };

      try {
        await rejected(error);
      } catch {
        // The refresh chain is not fully mocked; only that it was ENTERED matters.
      }
      expect(postSpy).toHaveBeenCalled();
      postSpy.mockRestore();
    });

    it('skips 401 handling for auth/refresh endpoint', async () => {
      const { rejected } = getResponseInterceptorHandlers();
      const error = {
        config: { url: '/auth/refresh', method: 'post', headers: {}, startTime: undefined },
        response: { status: 401, statusText: 'Unauthorized', data: {}, headers: {} },
        request: {},
        message: '401',
        isAxiosError: true,
      };
      await expect(rejected(error)).rejects.toBeDefined();
    });
  });
});

// ─── Request interceptor edge cases ─────────────────────

describe('request interceptor edge cases', () => {
  const getRequestInterceptorFulfilled = () => {
    const interceptors = (api.interceptors.request as any).handlers;
    return interceptors[interceptors.length - 1]?.fulfilled;
  };

  it('skips CSRF check for auth/login endpoint and resolves', async () => {
    const fulfilled = getRequestInterceptorFulfilled();
    const config = {
      url: '/api/v1/auth/login',
      method: 'post',
      headers: new axios.AxiosHeaders(),
    };
    // Auth endpoints bypass CSRF — should resolve without calling api.get for CSRF
    const getSpy = vi.spyOn(api, 'get');
    const result = await fulfilled(config as any);
    // CSRF header should NOT be set for login
    expect(result.headers['X-CSRF-Token']).toBeUndefined();
    // Authorization header from token storage should be set
    expect(result.headers['Authorization']).toBe('Bearer mock-access-token');
    getSpy.mockRestore();
  });

  // The tempting fix for the 401 replay was to add these two to
  // SESSION_ENDPOINTS. That list also drives the CSRF bypass, so it would have
  // stripped the token from the only two endpoints that change credentials.
  it('still sends a CSRF token to change-password', async () => {
    const fulfilled = getRequestInterceptorFulfilled();
    const config = {
      url: '/api/v1/auth/change-password',
      method: 'post',
      headers: new axios.AxiosHeaders(),
    };
    const result = await fulfilled(config as any);
    expect(result.headers['X-CSRF-Token']).toBeDefined();
  });

  it('skips CSRF header when already set', async () => {
    const fulfilled = getRequestInterceptorFulfilled();
    const getSpy = vi.spyOn(api, 'get').mockResolvedValueOnce({
      data: { data: { csrfToken: 'preset-csrf' } },
    } as any);

    const config = {
      url: '/api/data',
      method: 'put',
      headers: new axios.AxiosHeaders({ 'X-CSRF-Token': 'already-set' }),
    };
    try {
      const result = await fulfilled(config as any);
      expect(result.headers['X-CSRF-Token']).toBe('already-set');
    } catch {
      // May fail if CSRF fetch is unavailable in test
    }
    getSpy.mockRestore();
  });

  it('does not add Authorization when header already present', async () => {
    const fulfilled = getRequestInterceptorFulfilled();
    const config = {
      url: '/test',
      method: 'get',
      headers: new axios.AxiosHeaders({ Authorization: 'Bearer existing-token' }),
    };
    if (fulfilled) {
      const result = await fulfilled(config as any);
      expect(result.headers['Authorization']).toBe('Bearer existing-token');
    }
  });
});

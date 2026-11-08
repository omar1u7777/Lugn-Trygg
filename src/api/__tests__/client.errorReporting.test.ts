/**
 * One failed request is one console error and one Sentry event.
 *
 * Each failure was logged by the interceptor ("API Error Response:"), again by
 * analytics for a synthetic `new Error('API Error 500')` it sent to Sentry
 * ("❌ Error tracked:"), and a third time by the caller, whose ApiError went to
 * Sentry as well. A request the app cancelled itself took the same path, and
 * was filed in Sentry as "Error: Network Error".
 *
 * These run the real client, logger and analytics in production mode, with
 * only the network and the Sentry SDK replaced.
 */
import axios, { AxiosError, AxiosHeaders, CanceledError } from 'axios';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));

vi.mock('../../config/env', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../config/env')>()),
  getBackendUrl: () => 'http://localhost:5001',
  isDevEnvironment: () => false,
}));

vi.mock('../../services/sentryClient', () => ({
  captureException,
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
  setUser: vi.fn(),
  isSentryConfigured: () => true,
}));

vi.mock('../../utils/secureStorage', () => ({
  tokenStorage: {
    getAccessToken: vi.fn().mockResolvedValue('access-token'),
    setAccessToken: vi.fn().mockResolvedValue(undefined),
    clearTokens: vi.fn(),
  },
  purgeUserScopedStorage: vi.fn(),
}));

vi.mock('../../services/offlineStorage', () => ({ queueRequest: vi.fn() }));

import { api } from '../client';
import { ApiError } from '../errors';
import { getDashboardSummary } from '../dashboard';
import { logger } from '../../utils/logger';
import { analytics } from '../../services/analytics';

const respondWith = (status: number, data: unknown = { message: 'Serverfel' }): AxiosAdapter =>
  async (config: InternalAxiosRequestConfig) => {
    throw new AxiosError(
      `Request failed with status code ${status}`,
      status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
      config,
      {},
      { status, statusText: '', data, headers: {}, config },
    );
  };

const noResponse: AxiosAdapter = async (config) => {
  throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config, {});
};

/** A request the caller aborted after it was sent. */
const cancelledInFlight: AxiosAdapter = async (config) => {
  throw new CanceledError(undefined, config, {});
};

/** What a component does with the failure: log it with its own words. */
const callerLogs = async (request: Promise<unknown>) => {
  try {
    await request;
  } catch (error) {
    logger.error('Failed to load dashboard data:', error);
    return error;
  }
  throw new Error('expected the request to fail');
};

const consoleErrors = () => vi.mocked(console.error).mock.calls.length;

describe('API failure reporting', () => {
  const originalAdapter = api.defaults.adapter;

  beforeEach(() => {
    captureException.mockClear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
    vi.restoreAllMocks();
  });

  it('reports a server error once, as the ApiError the caller receives', async () => {
    api.defaults.adapter = respondWith(500);

    const error = await callerLogs(api.get('/api/v1/mood'));

    expect(error).toBeInstanceOf(ApiError);
    expect(consoleErrors()).toBe(1);
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException.mock.calls[0]?.[0]).toBe(error);
  });

  it('reports a request that got no response once', async () => {
    api.defaults.adapter = noResponse;

    await callerLogs(api.get('/api/v1/mood'));

    expect(consoleErrors()).toBe(1);
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it('reports a rate limit once', async () => {
    api.defaults.adapter = respondWith(429, { error: 'Rate limit exceeded' });

    await callerLogs(api.get('/api/v1/mood/weekly-analysis'));

    expect(consoleErrors()).toBe(1);
    expect(console.warn).not.toHaveBeenCalled();
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it('reports once when the caller wraps the failure in its own error', async () => {
    api.defaults.adapter = respondWith(500);

    await callerLogs(
      api.get('/api/v1/dashboard/u1/summary').catch((error: unknown) => {
        throw new Error('Tjänsten svarade inte. Det kan vara tillfälligt.', { cause: error });
      }),
    );

    expect(consoleErrors()).toBe(1);
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it('reports a failed dashboard load once, through the API module and the hook', async () => {
    api.defaults.adapter = respondWith(500);

    const error = await callerLogs(getDashboardSummary('u1'));

    expect((error as Error).message).toBe('Serverfel');
    expect(consoleErrors()).toBe(1);
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it('reports a retried request once, after its last attempt', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    try {
      const adapter = vi.fn(respondWith(503));
      api.defaults.adapter = adapter;

      const pending = callerLogs(api.get('/api/v1/mood'));
      await vi.runAllTimersAsync();
      await pending;

      expect(adapter.mock.calls.length).toBeGreaterThan(1);
      expect(consoleErrors()).toBe(1);
      expect(captureException).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports nothing for a request cancelled before it was sent', async () => {
    api.defaults.adapter = respondWith(500);
    const controller = new AbortController();
    controller.abort();

    const error = await callerLogs(api.get('/api/v1/mood', { signal: controller.signal }));

    expect(axios.isCancel((error as Error).cause) || axios.isCancel(error)).toBe(true);
    expect(consoleErrors()).toBe(0);
    expect(captureException).not.toHaveBeenCalled();
  });

  it('reports nothing for a request cancelled in flight', async () => {
    api.defaults.adapter = cancelledInFlight;

    await callerLogs(api.get('/api/v1/mood'));

    expect(consoleErrors()).toBe(0);
    expect(captureException).not.toHaveBeenCalled();
  });

  it('reports nothing for a 401 the token refresh recovers from', async () => {
    let attempt = 0;
    api.defaults.adapter = async (config) => {
      if (config.url?.includes('/auth/refresh')) {
        return { status: 200, statusText: 'OK', data: { accessToken: 'fresh' }, headers: {}, config };
      }
      attempt += 1;
      if (attempt === 1) {
        return respondWith(401, { error: 'Token expired' })(config);
      }
      return { status: 200, statusText: 'OK', data: { ok: true }, headers: new AxiosHeaders(), config };
    };

    await expect(api.get('/api/v1/mood')).resolves.toMatchObject({ data: { ok: true } });

    expect(consoleErrors()).toBe(0);
    expect(captureException).not.toHaveBeenCalled();
  });
});

describe('logger.error', () => {
  beforeEach(() => {
    captureException.mockClear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports the same error once however many places log it', () => {
    const error = new Error('Boom');

    logger.error('ErrorBoundary caught an error:', error);
    logger.error('Failed to render:', error);

    expect(consoleErrors()).toBe(1);
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it('is not sent to Sentry again by analytics, as the ErrorBoundary does', () => {
    const error = new Error('Render crashed');

    logger.error('ErrorBoundary caught an error:', error);
    analytics.error(error, { component: 'ErrorBoundary' });

    expect(consoleErrors()).toBe(1);
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it('still reports different errors separately', () => {
    logger.error('First:', new Error('One'));
    logger.error('Second:', new Error('Two'));

    expect(consoleErrors()).toBe(2);
    expect(captureException).toHaveBeenCalledTimes(2);
  });
});

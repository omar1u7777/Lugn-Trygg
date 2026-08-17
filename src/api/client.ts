import axios, { AxiosRequestConfig, AxiosResponse, AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from "axios";
import { getBackendUrl } from "../config/env";
import { tokenStorage, purgeUserScopedStorage } from "../utils/secureStorage";
import { logger } from "../utils/logger";
import { API_ENDPOINTS } from "./constants";
import { getCsrfToken as getSharedCsrfToken, clearCsrfToken, registerCsrfFetcher } from "./csrf";
import { ApiError } from "./errors";

// Constants for better maintainability
const AUTHORIZATION_HEADER = "Authorization";
const BEARER_PREFIX = "Bearer ";
const CSRF_HEADER = "X-CSRF-Token";
const CONTENT_TYPE_HEADER = "Content-Type";
const CONTENT_TYPE_JSON = "application/json";
const RETRY_AFTER_HEADER = "retry-after";
const DEFAULT_RETRY_AFTER = 60;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

// State-changing HTTP methods
const STATE_CHANGING_METHODS = ["POST", "PUT", "DELETE", "PATCH"];

/**
 * Endpoints that establish or end a session rather than consuming one.
 *
 * A 401 from any of these means "those credentials are wrong", not "your token
 * expired" — there is no session to refresh. The 401 handler only excluded
 * /auth/refresh, so a failed login fired a refresh that also 401'd and then
 * cleared local auth state: two wasted requests, two Sentry events, and a real
 * risk of a refresh loop. The CSRF bypass below needs exactly the same list, so
 * it lives in one place rather than being spelled out twice and drifting.
 */
const SESSION_ENDPOINTS = [
  '/auth/login',
  '/auth/register',
  '/auth/google-login',
  '/auth/logout',
  '/auth/refresh',
  '/auth/reset-password',
  '/auth/confirm-password-reset',
];

const isSessionEndpoint = (url?: string): boolean =>
  !!url && SESSION_ENDPOINTS.some(path => url.includes(path));

// Error messages (keeping Swedish as per original)
const RATE_LIMIT_MESSAGE = (retryAfter: number) => `För många förfrågningar. Försök igen om ${retryAfter} sekunder.`;
const OFFLINE_MESSAGE = "Nätverksfel. Förfrågan sparad för senare synkronisering.";
const NETWORK_ERROR_MESSAGE = "Nätverksfel. Förfrågan sparad för senare synkronisering.";

// Type definitions for better type safety
export interface ApiConfig extends AxiosRequestConfig {
  startTime?: number;
  _retry?: boolean;
  _csrfRetry?: boolean;
  retryCount?: number;
  /**
   * Set once the request body has been persisted to the offline queue.
   * Retrying after that point would submit the same write twice: once from
   * the retry that happens to reconnect, and once more when the queue replays.
   */
  _offlineQueued?: boolean;
}

/**
 * THE canonical response envelope. All new backend endpoints must return this
 * shape; the legacy bare-payload branch below exists only until the remaining
 * endpoints are migrated and must not be extended with new tolerated formats.
 */
export interface ApiEnvelope<T> {
  status?: 'success' | 'error';
  success?: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp?: string;
}

/**
 * Normalize API payloads to the canonical envelope contract.
 *
 * - Wrapped success ({ status:'success'|success:true, data }) → returns data.
 * - Error-shaped envelope on a 2xx transport ({ status:'error' } or
 *   { success:false }) → REJECTED with a typed ApiError instead of being
 *   silently handed to the caller as if it were payload data.
 * - Legacy bare payload → passed through unchanged (documented debt).
 */
export const unwrapApiResponse = <T>(payload: ApiEnvelope<T> | T): T => {
  if (!payload || typeof payload !== 'object') {
    return payload as T;
  }

  const candidate = payload as ApiEnvelope<T>;

  // Defensive contract enforcement: an error envelope must never masquerade
  // as successful data just because the HTTP layer returned 2xx.
  if (candidate.status === 'error' || candidate.success === false) {
    throw new ApiError(candidate.error || candidate.message || 'Malformed API response envelope', {
      code: 'MALFORMED_ENVELOPE',
      data: payload,
    });
  }

  const hasWrapperMetadata =
    typeof candidate.status === 'string' ||
    typeof candidate.success === 'boolean' ||
    typeof candidate.timestamp === 'string';

  if (hasWrapperMetadata && 'data' in candidate && candidate.data !== undefined) {
    return candidate.data;
  }

  return payload as T;
};

// Base URL for API
export const API_BASE_URL = getBackendUrl();

// Force reload environment variables in development
if (typeof import.meta !== "undefined" && import.meta.hot) {
  import.meta.hot.accept(() => {
    logger.debug("Environment variables reloaded");
  });
}

// Create Axios instance for API calls
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000, // 15 second timeout to prevent hung requests
  withCredentials: true, // Ensures cookies are sent for session handling
  headers: { [CONTENT_TYPE_HEADER]: CONTENT_TYPE_JSON },
});

// Alias for modules that import as apiClient
export const apiClient = api;

// Export api as default export
export default api;

// Re-export ApiError for convenience
export { ApiError } from './errors';

// Prevent infinite loop during token refresh
let isRefreshing = false;
// Queue of requests waiting for a token refresh to complete
let refreshSubscribers: Array<(token: string | null) => void> = [];

const onRefreshed = (token: string | null) => {
  refreshSubscribers.forEach(cb => cb(token));
  refreshSubscribers = [];
};

const subscribeTokenRefresh = (cb: (token: string | null) => void) => {
  refreshSubscribers.push(cb);
};

// Cache for dynamic imports to improve performance.
// These were typed `ReturnType<typeof import(...)>`, but a module namespace is
// not callable, so ReturnType's constraint was violated — the annotation never
// described what the variables actually hold.
let analyticsModule: typeof import('../services/analytics.lazy') | null = null;
let offlineStorageModule: typeof import('../services/offlineStorage') | null = null;

// Helper functions for analytics
const getAnalytics = async () => {
  if (!analyticsModule) {
    analyticsModule = await import('../services/analytics.lazy');
  }
  return analyticsModule.analytics;
};

const getOfflineStorage = async () => {
  if (!offlineStorageModule) {
    offlineStorageModule = await import('../services/offlineStorage');
  }
  return offlineStorageModule;
};

// Register the CSRF fetcher so the shared csrf.ts module can fetch tokens via the api instance
registerCsrfFetcher(async (): Promise<string | null> => {
  try {
    const response = await api.get(API_ENDPOINTS.AUTH.CSRF_TOKEN);
    const responseData = response.data?.data || response.data;
    const csrfToken = responseData?.csrfToken || responseData?.csrf_token;
    return (typeof csrfToken === 'string' && csrfToken.length > 0) ? csrfToken : null;
  } catch (csrfError) {
    logger.warn('Failed to fetch CSRF token in API client', { csrfError });
    return null;
  }
});

// Helper function to track API calls
const trackApiCall = async (
  url: string,
  method: string,
  duration: number,
  status: number,
  extraData: Record<string, unknown>
) => {
  try {
    const analytics = await getAnalytics();
    analytics.business.apiCall(url, method, duration, status, extraData);
  } catch (error) {
    logger.warn('Failed to track API call:', { error: String(error) });
  }
};

// Helper function to track errors
const trackError = async (
  errorType: string,
  extraData: Record<string, unknown>
) => {
  try {
    const analytics = await getAnalytics();
    analytics.business.error(errorType, extraData);
  } catch (error) {
    logger.warn('Failed to track error:', { error: String(error) });
  }
};

/** Coerce an axios request body into the plain object the offline queue stores. */
const normalizeQueuedBody = (data: unknown): Record<string, unknown> => {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    // FormData/Blob cannot be JSON-persisted; queueing them would replay an
    // empty body, which is worse than declining to queue the payload.
    if (data instanceof FormData || data instanceof Blob) {
      return {};
    }
    return data as Record<string, unknown>;
  }

  if (typeof data === 'string') {
    try {
      const parsed: unknown = JSON.parse(data);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Not JSON — fall through.
    }
  }

  return {};
};

// Helper function to handle offline queuing
const queueOfflineRequest = async (
  method: 'POST' | 'PUT' | 'DELETE',
  url: string,
  data: unknown
) => {
  try {
    const { queueRequest } = await getOfflineStorage();
    // The queue stores a JSON object. An axios request body reaches here as
    // whatever the caller passed — often already a JSON string, sometimes
    // FormData. Normalize so a string body round-trips as its parsed object
    // instead of being persisted as an unusable scalar and replayed wrong.
    queueRequest(method, url, normalizeQueuedBody(data));
    logger.info('Request queued for offline sync');
  } catch (error) {
    logger.error('Failed to queue request:', error);
  }
};

// Response interceptor handlers
const handleSuccessfulResponse = async (response: AxiosResponse): Promise<AxiosResponse> => {
  const config = response.config as ApiConfig;
  const startTime = config.startTime;
  if (startTime) {
    const duration = performance.now() - startTime;
    await trackApiCall(
      response.config.url || 'unknown',
      response.config.method?.toUpperCase() || 'GET',
      duration,
      response.status,
      {
        response_size: JSON.stringify(response.data).length,
        content_type: response.headers[CONTENT_TYPE_HEADER.toLowerCase()],
      }
    );
  }
  return response;
};

const handleRateLimitError = async (error: AxiosError, originalRequest: ApiConfig): Promise<never> => {
  const retryAfter = parseInt(error.response?.headers[RETRY_AFTER_HEADER] || DEFAULT_RETRY_AFTER.toString());
  logger.warn(`Rate limit exceeded. Retry after ${retryAfter} seconds`);
  await trackError('Rate Limit Exceeded', {
    endpoint: originalRequest.url,
    retryAfter,
  });
  // Unified contract: ApiError with status + code so consumers can branch on
  // error.code / error.response.status instead of parsing the Swedish message.
  throw new ApiError(RATE_LIMIT_MESSAGE(retryAfter), {
    status: 429,
    code: 'RATE_LIMITED',
    retryAfter,
    data: error.response?.data,
    url: originalRequest.url,
    method: originalRequest.method,
    cause: error,
  });
};

const handleTimeoutError = async (error: AxiosError, originalRequest: ApiConfig): Promise<never> => {
  logger.warn("Request timeout - checking offline status");
  if (!navigator.onLine) {
    originalRequest._offlineQueued = true;
    await queueOfflineRequest(
      (originalRequest.method?.toUpperCase() as 'POST' | 'PUT' | 'DELETE') || 'POST',
      originalRequest.url || '',
      originalRequest.data || {}
    );
    throw new ApiError(OFFLINE_MESSAGE, {
      code: 'OFFLINE_QUEUED',
      url: originalRequest.url,
      method: originalRequest.method,
      cause: error,
    });
  }
  throw error;
};

const handleNetworkError = async (error: AxiosError, originalRequest: ApiConfig): Promise<never> => {
  logger.error("API Network Error:", {
    message: error.message,
    url: originalRequest.url,
    method: originalRequest.method,
    code: error.code,
    offline: !navigator.onLine
  });

  if (!navigator.onLine && originalRequest) {
    originalRequest._offlineQueued = true;
    await queueOfflineRequest(
      (originalRequest.method?.toUpperCase() as 'POST' | 'PUT' | 'DELETE') || 'POST',
      originalRequest.url || '',
      originalRequest.data || {}
    );
    throw new ApiError(NETWORK_ERROR_MESSAGE, {
      code: 'OFFLINE_QUEUED',
      url: originalRequest.url,
      method: originalRequest.method,
      cause: error,
    });
  }

  await trackError('Network Error', {
    endpoint: originalRequest.url,
    method: originalRequest.method,
    code: error.code,
    offline: !navigator.onLine
  });
  throw error;
};

const handleSetupError = async (error: AxiosError, originalRequest: ApiConfig): Promise<never> => {
  logger.error("API Error:", error.message);
  await trackError('API Setup Error', {
    message: error.message,
    url: originalRequest.url
  });
  throw error;
};

const clearLocalAuthState = () => {
  tokenStorage.clearTokens();
  clearCsrfToken();
  try {
    localStorage.removeItem('secure_user');
    localStorage.removeItem('user');
    purgeUserScopedStorage();
  } catch (storageError) {
    logger.warn('Failed to clear local auth state after refresh failure', { storageError });
  }
  // Notify AuthContext to clear its React state and redirect to /login.
  // Without this, the UI shows logged-in but all API calls silently fail.
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('auth:force-logout'));
  }
};

const refreshAccessTokenWithCookie = async (): Promise<string | null> => {
  try {
    const response = await api.post(API_ENDPOINTS.AUTH.REFRESH_TOKEN, {});
    const responseData = response.data?.data || response.data;
    const accessToken = responseData?.accessToken;

    if (typeof accessToken === 'string' && accessToken.length > 0) {
      return accessToken;
    }

    return null;
  } catch (refreshError) {
    logger.warn('Refresh token request failed', { refreshError });
    return null;
  }
};

const handle401Error = async (error: AxiosError, originalRequest: ApiConfig): Promise<AxiosResponse> => {
  // If already refreshing, queue this request to retry after refresh completes
  if (isRefreshing) {
    return new Promise<AxiosResponse>((resolve, reject) => {
      subscribeTokenRefresh(async (token: string | null) => {
        if (token) {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers[AUTHORIZATION_HEADER] = `${BEARER_PREFIX}${token}`;
          try {
            resolve(await api(originalRequest));
          } catch (retryError) {
            reject(retryError);
          }
        } else {
          reject(error);
        }
      });
    });
  }

  isRefreshing = true;
  originalRequest._retry = true;

  // The critical section MUST always release the mutex and flush subscribers.
  // Without the finally, an exception (e.g. from tokenStorage) would leave
  // isRefreshing=true forever and queue every future 401 indefinitely.
  let refreshedToken: string | null = null;
  try {
    const newAccessToken = await refreshAccessTokenWithCookie();
    if (newAccessToken) {
      await tokenStorage.setAccessToken(newAccessToken);
      api.defaults.headers[AUTHORIZATION_HEADER] = `${BEARER_PREFIX}${newAccessToken}`;
      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers[AUTHORIZATION_HEADER] = `${BEARER_PREFIX}${newAccessToken}`;
      logger.info("Token refreshed successfully");
      refreshedToken = newAccessToken;
    } else {
      logger.warn("Token refresh failed, clearing local auth state");
      clearLocalAuthState();
    }
  } finally {
    isRefreshing = false;
    onRefreshed(refreshedToken);
  }

  if (refreshedToken) {
    return api(originalRequest);
  }
  throw error;
};

/**
 * Does this 403 body come from the CSRF middleware?
 *
 * `error.response.data` is typed `unknown`/`{}` by axios, so the previous
 * `data?.error?.includes('CSRF')` did not type-check and would have thrown at
 * runtime for any non-string `error` field. Narrow explicitly.
 */
const isCsrfRejection = (data: unknown): boolean => {
  if (!data || typeof data !== 'object') {
    return false;
  }
  const message = (data as { error?: unknown }).error;
  return typeof message === 'string' && message.includes('CSRF');
};

const handleErrorResponse = async (error: AxiosError): Promise<AxiosResponse | never> => {
  const originalRequest = error.config as ApiConfig | undefined;

  // A rejection from the request interceptor itself (e.g. the CSRF-unavailable
  // guard below) never reaches axios's dispatch, so it carries no config --
  // nothing here to retry or attribute a duration to. Propagate it as-is
  // instead of crashing on originalRequest.startTime below, which would
  // replace the original, informative error with a raw TypeError.
  if (!originalRequest) {
    throw error;
  }

  // Track failed API call
  const startTime = originalRequest.startTime;
  if (startTime) {
    const duration = performance.now() - startTime;
    await trackApiCall(
      originalRequest.url || 'unknown',
      originalRequest.method?.toUpperCase() || 'GET',
      duration,
      error.response?.status || 0,
      {
        error_type: error.code || 'unknown',
        error_message: error.message,
      }
    );
  }

  if (error.response) {
    // Server responded with error status
    const errorData = {
      status: error.response.status,
      statusText: error.response.statusText,
      data: error.response.data,
      url: originalRequest.url,
      method: originalRequest.method,
      timestamp: Date.now()
    };
    logger.error("API Error Response:", errorData);

    if (error.response.status === 401 && !originalRequest._retry && !isSessionEndpoint(originalRequest.url)) {
      return await handle401Error(error, originalRequest);
    }

    // 403 from CSRF middleware: token may be expired/missing while JWT is valid.
    // Clear cached CSRF, fetch a fresh token, and retry the request once.
    if (error.response.status === 403
        && !originalRequest._csrfRetry
        && originalRequest.headers?.[AUTHORIZATION_HEADER]
        && isCsrfRejection(error.response.data)) {
      originalRequest._csrfRetry = true;
      clearCsrfToken();
      const freshCsrf = await getSharedCsrfToken();
      if (freshCsrf) {
        originalRequest.headers[CSRF_HEADER] = freshCsrf;
        return api(originalRequest);
      }
    }

    if (error.response.status === 429) {
      await handleRateLimitError(error, originalRequest);
    }

    if (error.response.status === 408 || error.response.status === 504) {
      await handleTimeoutError(error, originalRequest);
    }

    await trackError(`API Error ${error.response.status}`, {
      endpoint: originalRequest.url,
      method: originalRequest.method,
      status: error.response.status
    });
  } else if (error.request) {
    await handleNetworkError(error, originalRequest);
  } else {
    await handleSetupError(error, originalRequest);
  }

  throw error;
};

// Retry logic for transient errors (NOT 429, NOT 500 — rate limits need backoff, server bugs won't self-resolve)
const shouldRetry = (error: AxiosError): boolean => {
  const status = error.response?.status;
  if (!status || ![408, 502, 503, 504].includes(status)) {
    return false;
  }
  // A request already persisted to the offline queue must not also be
  // retried: if a retry happens to reconnect and succeed, the queued copy
  // still replays on the next sync and the write lands twice (a duplicate
  // mood entry, a duplicate journal save).
  return !(error.config as ApiConfig | undefined)?._offlineQueued;
};

const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const retryRequest = async (error: AxiosError): Promise<AxiosResponse> => {
  const config = error.config as ApiConfig;
  config.retryCount = (config.retryCount || 0) + 1;

  if (config.retryCount <= MAX_RETRY_ATTEMPTS && shouldRetry(error)) {
    logger.warn(`Retrying request (${config.retryCount}/${MAX_RETRY_ATTEMPTS}): ${config.url}`);
    await delay(RETRY_DELAY_MS * config.retryCount);
    return api(config);
  }

  throw error;
};

/**
 * Single normalization gateway: every rejection leaving the api client is an
 * ApiError. Raw AxiosErrors never escape the interceptor, so consumers have
 * exactly one error contract (status/code/data + axios-compatible .response).
 */
const normalizeToApiError = (err: unknown): Error => {
  if (err instanceof ApiError) {
    return err;
  }
  if (axios.isAxiosError(err)) {
    return ApiError.fromAxiosError(err);
  }
  return err instanceof Error ? err : new ApiError(String(err));
};

// Response interceptor with modular error handling and retry logic
api.interceptors.response.use(
  handleSuccessfulResponse,
  async (error: AxiosError) => {
    try {
      // First, try to handle the error with our logic
      return await handleErrorResponse(error);
    } catch (handledError) {
      // If not handled, check if we should retry
      if (shouldRetry(error)) {
        try {
          return await retryRequest(error);
        } catch (retryError) {
          throw normalizeToApiError(retryError);
        }
      }
      throw normalizeToApiError(handledError);
    }
  }
);

// Request interceptor for adding Authorization and CSRF headers
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Ensure headers object exists. An AxiosHeaders instance, not a bare
    // object literal: axios expects the class here, and the literal did not
    // satisfy AxiosRequestHeaders.
    if (!config.headers) {
      config.headers = new AxiosHeaders();
    }

    // Get token from secure storage
    const token = await tokenStorage.getAccessToken();
    if (token && !config.headers[AUTHORIZATION_HEADER]) {
      config.headers[AUTHORIZATION_HEADER] = `${BEARER_PREFIX}${token}`;
    }

    // Add CSRF token for state-changing operations
    // Skip CSRF for initial auth endpoints to prevent bootstrap deadlocks
    // when the CSRF fetch itself needs a valid token.
    const method = config.method?.toUpperCase();
    if (method && STATE_CHANGING_METHODS.includes(method) && !isSessionEndpoint(config.url)) {
      const csrf = await getSharedCsrfToken();
      if (!csrf) {
        // [S4] Block the request — sending state-changing requests without CSRF
        // protection is a security vulnerability. Never silently continue.
        logger.error('CSRF token unavailable. Request blocked.', { url: config.url, method });
        return Promise.reject(new ApiError('CSRF token unavailable. Request blocked for security.', {
          code: 'CSRF_UNAVAILABLE',
          url: config.url,
          method,
        }));
      }
      if (!config.headers[CSRF_HEADER]) {
        config.headers[CSRF_HEADER] = csrf;
      }
    }

    // Track API call start time
    (config as ApiConfig).startTime = performance.now();

    return config;
  },
  (error) => Promise.reject(error)
);


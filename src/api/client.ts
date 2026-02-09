import axios, { AxiosRequestConfig, AxiosResponse, AxiosError, InternalAxiosRequestConfig } from "axios";
import { getBackendUrl } from "../config/env";
import { tokenStorage } from "../utils/secureStorage";
import { logger } from "../utils/logger";

// Constants for better maintainability
const AUTHORIZATION_HEADER = "Authorization";
const BEARER_PREFIX = "Bearer ";
const CSRF_HEADER = "X-CSRFToken";
const CONTENT_TYPE_HEADER = "Content-Type";
const CONTENT_TYPE_JSON = "application/json";
const RETRY_AFTER_HEADER = "retry-after";
const DEFAULT_RETRY_AFTER = 60;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

// State-changing HTTP methods
const STATE_CHANGING_METHODS = ["POST", "PUT", "DELETE", "PATCH"];

// Error messages (keeping Swedish as per original)
const RATE_LIMIT_MESSAGE = (retryAfter: number) => `För många förfrågningar. Försök igen om ${retryAfter} sekunder.`;
const OFFLINE_MESSAGE = "Nätverksfel. Förfrågan sparad för senare synkronisering.";
const NETWORK_ERROR_MESSAGE = "Nätverksfel. Förfrågan sparad för senare synkronisering.";

// Type definitions for better type safety
export interface ApiConfig extends AxiosRequestConfig {
  startTime?: number;
  _retry?: boolean;
  retryCount?: number;
}

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
  withCredentials: true, // Ensures cookies are sent for session handling
  headers: { [CONTENT_TYPE_HEADER]: CONTENT_TYPE_JSON },
});

// Alias for modules that import as apiClient
export const apiClient = api;

// Export api as default export
export default api;

// Prevent infinite loop during token refresh
let isRefreshing = false;

// Cache for dynamic imports to improve performance
let analyticsModule: ReturnType<typeof import('../services/analytics.lazy')> | null = null;
let authModule: ReturnType<typeof import('../services/authUtils')> | null = null;
let offlineStorageModule: ReturnType<typeof import('../services/offlineStorage')> | null = null;

// Helper functions for analytics
const getAnalytics = async () => {
  if (!analyticsModule) {
    analyticsModule = await import('../services/analytics.lazy');
  }
  return analyticsModule.analytics;
};

const getAuth = async () => {
  if (!authModule) {
    authModule = await import('./auth');
  }
  return authModule;
};

const getOfflineStorage = async () => {
  if (!offlineStorageModule) {
    offlineStorageModule = await import('../services/offlineStorage');
  }
  return offlineStorageModule;
};

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

// Helper function to handle offline queuing
const queueOfflineRequest = async (
  method: 'POST' | 'PUT' | 'DELETE',
  url: string,
  data: unknown
) => {
  try {
    const { queueRequest } = await getOfflineStorage();
    queueRequest(method, url, data);
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
  throw new Error(RATE_LIMIT_MESSAGE(retryAfter));
};

const handleTimeoutError = async (error: AxiosError, originalRequest: ApiConfig): Promise<never> => {
  logger.warn("Request timeout - checking offline status");
  if (!navigator.onLine) {
    await queueOfflineRequest(
      (originalRequest.method?.toUpperCase() as 'POST' | 'PUT' | 'DELETE') || 'POST',
      originalRequest.url || '',
      originalRequest.data || {}
    );
    throw new Error(OFFLINE_MESSAGE);
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
    await queueOfflineRequest(
      (originalRequest.method?.toUpperCase() as 'POST' | 'PUT' | 'DELETE') || 'POST',
      originalRequest.url || '',
      originalRequest.data || {}
    );
    throw new Error(NETWORK_ERROR_MESSAGE);
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

const handle401Error = async (error: AxiosError, originalRequest: ApiConfig): Promise<AxiosResponse> => {
  if (isRefreshing) {
    throw error;
  }

  isRefreshing = true;
  originalRequest._retry = true;

  try {
    const { refreshAccessToken } = await getAuth();
    const newAccessToken = await refreshAccessToken();
    if (newAccessToken) {
      await tokenStorage.setAccessToken(newAccessToken);
      api.defaults.headers[AUTHORIZATION_HEADER] = `${BEARER_PREFIX}${newAccessToken}`;
      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers[AUTHORIZATION_HEADER] = `${BEARER_PREFIX}${newAccessToken}`;
      logger.info("Token refreshed successfully");
      isRefreshing = false;
      return api(originalRequest);
    }
  } catch (refreshError) {
    logger.error("Automatic token refresh failed:", refreshError);
    logger.warn("Token refresh failed, logging out user");
    isRefreshing = false;
    const { logoutUser } = await getAuth();
    logoutUser();
  }
  throw error;
};

const handleErrorResponse = async (error: AxiosError): Promise<AxiosResponse | never> => {
  const originalRequest = error.config as ApiConfig;

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

    if (error.response.status === 401 && !originalRequest._retry) {
      return await handle401Error(error, originalRequest);
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

// Retry logic for transient errors
const shouldRetry = (error: AxiosError): boolean => {
  const status = error.response?.status;
  return !!(status && [408, 429, 500, 502, 503, 504].includes(status));
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
        return retryRequest(error);
      }
      throw handledError;
    }
  }
);

// Request interceptor for adding Authorization and CSRF headers
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Ensure headers object exists
    if (!config.headers) {
      config.headers = {};
    }

    // Get token from secure storage
    const token = await tokenStorage.getAccessToken();
    if (token && !config.headers[AUTHORIZATION_HEADER]) {
      config.headers[AUTHORIZATION_HEADER] = `${BEARER_PREFIX}${token}`;
    }

    // Add CSRF token for state-changing operations
    const method = config.method?.toUpperCase();
    if (method && STATE_CHANGING_METHODS.includes(method)) {
      try {
        const { getCsrfToken } = await getAuth();
        const csrf = await getCsrfToken();
        if (csrf && !config.headers[CSRF_HEADER]) {
          config.headers[CSRF_HEADER] = csrf;
        }
      } catch (error) {
        logger.warn('Failed to get CSRF token, proceeding without it:', { error: String(error) });
      }
    }

    // Track API call start time
    (config as ApiConfig).startTime = performance.now();

    return config;
  },
  (error) => Promise.reject(error)
);


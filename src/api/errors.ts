/**
 * Custom error classes for better error handling and type safety
 */

import { AxiosError } from 'axios';
import { extractErrorMessage } from './errorMessage';

/**
 * Machine-readable error codes for the unified API error contract.
 * UI layers should branch/translate on `code`, never on message text.
 */
export type ApiErrorCode =
  | 'RATE_LIMITED'
  | 'OFFLINE_QUEUED'
  | 'CSRF_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'MALFORMED_ENVELOPE'
  | 'HTTP_ERROR'
  | 'REQUEST_SETUP';

/**
 * Options accepted by every error in the hierarchy. Properties explicitly
 * allow `undefined` so call sites can forward optional values under
 * `exactOptionalPropertyTypes` without ceremony.
 */
export interface ApiErrorOptions {
  status?: number | undefined;
  statusText?: string | undefined;
  data?: unknown;
  url?: string | undefined;
  method?: string | undefined;
  code?: ApiErrorCode | undefined;
  retryAfter?: number | undefined;
  cause?: Error | undefined;
}

export class ApiError extends Error {
  public readonly status: number | undefined;
  public readonly statusText: string | undefined;
  public readonly data: unknown;
  public readonly url: string | undefined;
  public readonly method: string | undefined;
  public readonly code: ApiErrorCode | undefined;
  public readonly retryAfter: number | undefined;
  public readonly timestamp: number;
  public readonly isNetworkError: boolean;
  public readonly isServerError: boolean;
  public readonly isClientError: boolean;

  constructor(
    message: string,
    options: ApiErrorOptions = {}
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status;
    this.statusText = options.statusText;
    this.data = options.data;
    this.url = options.url;
    this.method = options.method;
    this.code = options.code;
    this.retryAfter = options.retryAfter;
    this.timestamp = Date.now();
    this.isNetworkError = !options.status;
    this.isServerError = options.status ? options.status >= 500 : false;
    this.isClientError = options.status ? options.status >= 400 && options.status < 500 : false;

    if (options.cause) {
      this.cause = options.cause;
    }
  }

  /**
   * Axios-shaped compatibility view. Lets existing call sites that read
   * `error.response?.status` / `error.response?.data` keep working after the
   * interceptor switched from throwing AxiosError to throwing ApiError.
   */
  get response(): { status: number; statusText: string | undefined; data: unknown } | undefined {
    if (this.status === undefined) {
      return undefined;
    }
    return { status: this.status, statusText: this.statusText, data: this.data };
  }

  /**
   * Creates an ApiError from an Axios error response
   */
  static fromAxiosError(error: AxiosError): ApiError {
    if (error.response) {
      // This had its own message-precedence rule, close to but not the same as
      // extractErrorMessage's: it took `error` even when that field held a bare
      // code, so ApiError.message could be "SERVICE_UNAVAILABLE" — and
      // components display ApiError.message directly. One rule, in one place.
      // Axios' own text stays as the last resort so debugging keeps a detail
      // to grab when the server sent nothing usable.
      return new ApiError(
        extractErrorMessage(error, error.message),
        {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          url: error.config?.url,
          method: error.config?.method,
          cause: error
        }
      );
    } else if (error.request) {
      // Request made but no response (network error)
      return new ApiError(
        'Network error - no response received',
        {
          url: error.config?.url,
          method: error.config?.method,
          cause: error
        }
      );
    } else {
      // Error in request setup
      return new ApiError(
        error.message || 'Request setup error',
        {
          cause: error
        }
      );
    }
  }

  /**
   * Checks if the error is a rate limit error (429)
   */
  get isRateLimit(): boolean {
    return this.status === 429;
  }

  /**
   * Checks if the error is an authentication error (401)
   */
  get isAuthError(): boolean {
    return this.status === 401;
  }

  /**
   * Checks if the error is a timeout error (408, 504)
   */
  get isTimeout(): boolean {
    return this.status === 408 || this.status === 504;
  }

  /**
   * Gets user-friendly error message in Swedish
   */
  get userMessage(): string {
    if (this.isRateLimit) {
      const retryAfter = (this.data as Record<string, unknown>)?.retryAfter || 60;
      return `För många förfrågningar. Försök igen om ${retryAfter} sekunder.`;
    }

    if (this.isTimeout) {
      return 'Förfrågan tog för lång tid. Kontrollera din internetanslutning.';
    }

    if (this.isNetworkError) {
      return 'Nätverksfel. Kontrollera din internetanslutning.';
    }

    if (this.isAuthError) {
      return 'Du är inte inloggad. Logga in igen.';
    }

    if (this.isServerError) {
      return 'Serverfel. Försök igen senare.';
    }

    return this.message;
  }
}

export class ValidationError extends ApiError {
  public readonly field: string | undefined;

  constructor(message: string, field?: string, options: ApiErrorOptions = {}) {
    super(message, options);
    this.name = 'ValidationError';
    this.field = field;
  }
}

export class AuthenticationError extends ApiError {
  constructor(message = 'Authentication required', options: ApiErrorOptions = {}) {
    super(message, { status: 401, ...options });
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends ApiError {
  constructor(message = 'Insufficient permissions', options: ApiErrorOptions = {}) {
    super(message, { status: 403, ...options });
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends ApiError {
  constructor(resource = 'Resource', options: ApiErrorOptions = {}) {
    super(`${resource} not found`, { status: 404, ...options });
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends ApiError {
  public readonly retryAfter: number;

  constructor(retryAfter = 60, options: ApiErrorOptions = {}) {
    super(`Rate limit exceeded. Retry after ${retryAfter} seconds`, {
      status: 429,
      ...options
    });
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class NetworkError extends ApiError {
  constructor(message = 'Network error', options: ApiErrorOptions = {}) {
    super(message, options);
    this.name = 'NetworkError';
  }
}

/**
 * Type guard to check if an error is an ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Type guard to check if an error is a specific ApiError type
 */
export function isApiErrorType<T extends ApiError>(
  error: unknown,
  ErrorClass: new (...args: unknown[]) => T
): error is T {
  return error instanceof ErrorClass;
}
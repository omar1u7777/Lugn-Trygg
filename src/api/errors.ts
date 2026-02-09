/**
 * Custom error classes for better error handling and type safety
 */

import { AxiosError } from 'axios';

export class ApiError extends Error {
  public readonly status?: number;
  public readonly statusText?: string;
  public readonly data?: unknown;
  public readonly url?: string;
  public readonly method?: string;
  public readonly timestamp: number;
  public readonly isNetworkError: boolean;
  public readonly isServerError: boolean;
  public readonly isClientError: boolean;

  constructor(
    message: string,
    options: {
      status?: number;
      statusText?: string;
      data?: unknown;
      url?: string;
      method?: string;
      cause?: Error;
    } = {}
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status;
    this.statusText = options.statusText;
    this.data = options.data;
    this.url = options.url;
    this.method = options.method;
    this.timestamp = Date.now();
    this.isNetworkError = !options.status;
    this.isServerError = options.status ? options.status >= 500 : false;
    this.isClientError = options.status ? options.status >= 400 && options.status < 500 : false;

    if (options.cause) {
      this.cause = options.cause;
    }
  }

  /**
   * Creates an ApiError from an Axios error response
   */
  static fromAxiosError(error: AxiosError): ApiError {
    if (error.response) {
      const responseData = error.response.data as Record<string, unknown> | undefined;
      // Server responded with error status
      return new ApiError(
        (responseData?.message as string) || (responseData?.error as string) || error.message,
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
  public readonly field?: string;

  constructor(message: string, field?: string, options: {
    status?: number;
    statusText?: string;
    data?: unknown;
    url?: string;
    method?: string;
    cause?: Error;
  } = {}) {
    super(message, options);
    this.name = 'ValidationError';
    this.field = field;
  }
}

export class AuthenticationError extends ApiError {
  constructor(message = 'Authentication required', options: {
    status?: number;
    statusText?: string;
    data?: unknown;
    url?: string;
    method?: string;
    cause?: Error;
  } = {}) {
    super(message, { status: 401, ...options });
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends ApiError {
  constructor(message = 'Insufficient permissions', options: {
    status?: number;
    statusText?: string;
    data?: unknown;
    url?: string;
    method?: string;
    cause?: Error;
  } = {}) {
    super(message, { status: 403, ...options });
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends ApiError {
  constructor(resource = 'Resource', options: {
    status?: number;
    statusText?: string;
    data?: unknown;
    url?: string;
    method?: string;
    cause?: Error;
  } = {}) {
    super(`${resource} not found`, { status: 404, ...options });
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends ApiError {
  public readonly retryAfter: number;

  constructor(retryAfter = 60, options: {
    status?: number;
    statusText?: string;
    data?: unknown;
    url?: string;
    method?: string;
    cause?: Error;
  } = {}) {
    super(`Rate limit exceeded. Retry after ${retryAfter} seconds`, {
      status: 429,
      ...options
    });
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class NetworkError extends ApiError {
  constructor(message = 'Network error', options: {
    status?: number;
    statusText?: string;
    data?: unknown;
    url?: string;
    method?: string;
    cause?: Error;
  } = {}) {
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
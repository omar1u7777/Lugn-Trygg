/**
 * Tests for ApiError and ValidationError classes.
 */
import { AxiosError } from 'axios';
import { describe, it, expect } from 'vitest';
import { ApiError, ValidationError } from '../errors';

function makeAxiosError(
  status?: number,
  data?: unknown,
  url = '/test',
  method = 'get',
  hasRequest = true
): AxiosError {
  const err = new AxiosError('Request failed');
  err.config = { url, method } as AxiosError['config'];
  if (status !== undefined) {
    err.response = {
      status,
      statusText: String(status),
      data,
      headers: {},
      config: err.config!,
    } as AxiosError['response'];
  } else if (hasRequest) {
    err.request = {};
  }
  return err;
}

describe('ApiError', () => {
  describe('constructor', () => {
    it('sets message and name', () => {
      const err = new ApiError('Something went wrong');
      expect(err.message).toBe('Something went wrong');
      expect(err.name).toBe('ApiError');
    });

    it('sets timestamp', () => {
      const before = Date.now();
      const err = new ApiError('msg');
      expect(err.timestamp).toBeGreaterThanOrEqual(before);
    });

    it('is instanceof Error', () => {
      expect(new ApiError('msg') instanceof Error).toBe(true);
    });

    it('isNetworkError when no status', () => {
      expect(new ApiError('net').isNetworkError).toBe(true);
    });

    it('isNetworkError false when status set', () => {
      expect(new ApiError('net', { status: 500 }).isNetworkError).toBe(false);
    });

    it('isServerError for 5xx', () => {
      expect(new ApiError('', { status: 500 }).isServerError).toBe(true);
      expect(new ApiError('', { status: 503 }).isServerError).toBe(true);
    });

    it('isServerError false for 4xx', () => {
      expect(new ApiError('', { status: 400 }).isServerError).toBe(false);
    });

    it('isClientError for 4xx', () => {
      expect(new ApiError('', { status: 400 }).isClientError).toBe(true);
      expect(new ApiError('', { status: 404 }).isClientError).toBe(true);
      expect(new ApiError('', { status: 499 }).isClientError).toBe(true);
    });

    it('isClientError false for 5xx', () => {
      expect(new ApiError('', { status: 500 }).isClientError).toBe(false);
    });

    it('stores optional fields', () => {
      const err = new ApiError('msg', {
        status: 422,
        statusText: 'Unprocessable',
        data: { field: 'email' },
        url: '/api/v1/user',
        method: 'post',
      });
      expect(err.status).toBe(422);
      expect(err.statusText).toBe('Unprocessable');
      expect(err.data).toEqual({ field: 'email' });
      expect(err.url).toBe('/api/v1/user');
      expect(err.method).toBe('post');
    });
  });

  describe('getters', () => {
    it('isRateLimit true for 429', () => {
      expect(new ApiError('', { status: 429 }).isRateLimit).toBe(true);
    });

    it('isRateLimit false for other status', () => {
      expect(new ApiError('', { status: 400 }).isRateLimit).toBe(false);
    });

    it('isAuthError true for 401', () => {
      expect(new ApiError('', { status: 401 }).isAuthError).toBe(true);
    });

    it('isAuthError false for 403', () => {
      expect(new ApiError('', { status: 403 }).isAuthError).toBe(false);
    });

    it('isTimeout true for 408 and 504', () => {
      expect(new ApiError('', { status: 408 }).isTimeout).toBe(true);
      expect(new ApiError('', { status: 504 }).isTimeout).toBe(true);
    });

    it('isTimeout false for others', () => {
      expect(new ApiError('', { status: 500 }).isTimeout).toBe(false);
    });
  });

  describe('userMessage', () => {
    it('rate limit with retryAfter in data', () => {
      const err = new ApiError('rate', { status: 429, data: { retryAfter: 30 } });
      expect(err.userMessage).toContain('30 sekunder');
    });

    it('rate limit defaults to 60s when no retryAfter', () => {
      const err = new ApiError('rate', { status: 429, data: {} });
      expect(err.userMessage).toContain('60 sekunder');
    });

    it('timeout message mentions internetanslutning', () => {
      expect(new ApiError('', { status: 408 }).userMessage).toContain('internetanslutning');
    });

    it('network error message', () => {
      expect(new ApiError('net').userMessage).toContain('Nätverksfel');
    });

    it('auth error message mentions inloggad', () => {
      expect(new ApiError('', { status: 401 }).userMessage).toContain('inloggad');
    });

    it('server error message', () => {
      expect(new ApiError('', { status: 500 }).userMessage).toContain('Serverfel');
    });

    it('returns message as fallback for client errors', () => {
      expect(new ApiError('Custom error', { status: 400 }).userMessage).toBe('Custom error');
    });
  });

  describe('fromAxiosError', () => {
    it('creates from server response with message field', () => {
      const axiosErr = makeAxiosError(500, { message: 'Server down' });
      const err = ApiError.fromAxiosError(axiosErr);
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(500);
      expect(err.message).toBe('Server down');
    });

    it('uses error field when message absent', () => {
      const axiosErr = makeAxiosError(422, { error: 'Validation failed' });
      const err = ApiError.fromAxiosError(axiosErr);
      expect(err.message).toBe('Validation failed');
    });

    it('falls back to axiosError.message when data has neither field', () => {
      const axiosErr = makeAxiosError(400, {});
      const err = ApiError.fromAxiosError(axiosErr);
      expect(err.message).toBe(axiosErr.message);
    });

    it('creates network error when request exists but no response', () => {
      const axiosErr = makeAxiosError(undefined, undefined, '/url', 'get', true);
      const err = ApiError.fromAxiosError(axiosErr);
      expect(err.isNetworkError).toBe(true);
      expect(err.message).toBe('Network error - no response received');
    });

    it('creates setup error when no response and no request', () => {
      const axiosErr = makeAxiosError(undefined, undefined, '/url', 'get', false);
      const err = ApiError.fromAxiosError(axiosErr);
      expect(err.isNetworkError).toBe(true);
    });

    it('sets url and method from config', () => {
      const axiosErr = makeAxiosError(404, {}, '/api/users', 'delete');
      const err = ApiError.fromAxiosError(axiosErr);
      expect(err.url).toBe('/api/users');
      expect(err.method).toBe('delete');
    });

    it('sets status and statusText from response', () => {
      const axiosErr = makeAxiosError(503, {}, '/health', 'get');
      const err = ApiError.fromAxiosError(axiosErr);
      expect(err.status).toBe(503);
      expect(err.statusText).toBe('503');
    });
  });
});

describe('ValidationError', () => {
  it('sets name to ValidationError', () => {
    const err = new ValidationError('Email invalid', 'email');
    expect(err.name).toBe('ValidationError');
  });

  it('stores field', () => {
    const err = new ValidationError('Email invalid', 'email');
    expect(err.field).toBe('email');
  });

  it('stores message', () => {
    const err = new ValidationError('Email invalid', 'email');
    expect(err.message).toBe('Email invalid');
  });

  it('extends ApiError', () => {
    const err = new ValidationError('msg', 'field', { status: 400 });
    expect(err instanceof ApiError).toBe(true);
    expect(err.status).toBe(400);
  });

  it('works without field', () => {
    const err = new ValidationError('Generic');
    expect(err.field).toBeUndefined();
  });

  it('is instanceof Error', () => {
    expect(new ValidationError('msg') instanceof Error).toBe(true);
  });
});

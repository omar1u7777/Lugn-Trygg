/**
 * Centralized CSRF Token Manager
 *
 * Single source of truth for CSRF token caching.
 * Used by both the Axios interceptor (client.ts) and auth functions (auth.ts).
 */
import { logger } from '../utils/logger';

const CSRF_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

// Lazy reference to the api instance to avoid circular imports.
// Set once by client.ts after the Axios instance is created.
type ApiFetcher = () => Promise<string | null>;
let _fetchFn: ApiFetcher | null = null;

/**
 * Register the CSRF fetch function. Called once from client.ts.
 */
export const registerCsrfFetcher = (fn: ApiFetcher): void => {
  _fetchFn = fn;
};

/**
 * Get a cached CSRF token, fetching a fresh one if expired.
 */
export const getCsrfToken = async (): Promise<string | null> => {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  if (!_fetchFn) {
    logger.warn('CSRF fetcher not registered yet');
    return null;
  }

  try {
    const token = await _fetchFn();
    if (token) {
      cachedToken = token;
      tokenExpiresAt = Date.now() + CSRF_TOKEN_TTL_MS;
    }
    return token;
  } catch (error) {
    logger.warn('Failed to fetch CSRF token', { error });
    return null;
  }
};

/**
 * Clear the cached CSRF token (e.g. on logout).
 */
export const clearCsrfToken = (): void => {
  cachedToken = null;
  tokenExpiresAt = 0;
};

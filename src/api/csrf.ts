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
/**
 * The in-flight fetch, shared by every concurrent caller.
 *
 * Only the RESOLVED token used to be cached, so N parallel state-changing
 * requests on app boot each fired their own /csrf-token call. The backend
 * re-issues and re-sets the csrf_token cookie on every one of those, so the
 * cookie ended up holding the last-issued token while requests already
 * dispatched still carried an earlier one — and the double-submit check
 * (csrf_middleware.py compares cookie to header with compare_digest) rejected
 * the mismatches with 403. Sharing the promise means one fetch, one cookie,
 * one token for the whole burst.
 */
let inFlight: Promise<string | null> | null = null;

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

  if (inFlight) {
    return inFlight;
  }

  if (!_fetchFn) {
    logger.warn('CSRF fetcher not registered yet');
    return null;
  }

  const fetchFn = _fetchFn;
  inFlight = (async () => {
    try {
      const token = await fetchFn();
      if (token) {
        cachedToken = token;
        tokenExpiresAt = Date.now() + CSRF_TOKEN_TTL_MS;
      }
      return token;
    } catch (error) {
      logger.warn('Failed to fetch CSRF token', { error });
      return null;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
};

/**
 * Clear the cached CSRF token (e.g. on logout).
 */
export const clearCsrfToken = (): void => {
  cachedToken = null;
  tokenExpiresAt = 0;
  // Drop the shared fetch too: after a 403 the in-flight token is the one the
  // server just rejected, so callers waiting on it must re-fetch, not inherit
  // a stale result.
  inFlight = null;
};

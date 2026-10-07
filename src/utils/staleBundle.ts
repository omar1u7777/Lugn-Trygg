/**
 * Recovery from a stale bundle: a tab opened before a deploy asks for a chunk
 * whose hashed file no longer exists. Retrying the import cannot help (the
 * file is gone and React.lazy caches the rejection), so the only recovery is
 * loading the new index.html.
 *
 * Shared by ErrorBoundary and FeatureErrorBoundary. Feature boundaries sit
 * closer to the lazy routes, so they catch the error first; before this they
 * showed "Något gick fel" with a retry button that could never work.
 */
import { logger } from './logger';

const RECOVERY_TS_KEY = 'bundle_recovery_attempt_ts';
const RECOVERY_COUNT_KEY = 'bundle_recovery_attempt_count';
const MAX_RECOVERY_ATTEMPTS = 3;
const MIN_RECOVERY_INTERVAL_MS = 10_000;

export const isStaleBundleError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const message = error.message ?? '';
  const isChunkLoadError =
    error.name === 'ChunkLoadError' ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    (/missing/i.test(message) && /dynamically imported/i.test(message));
  // Mixed old and new chunks evaluating in the wrong order.
  const isInitializationReferenceError =
    error.name === 'ReferenceError' && /Cannot access '.*' before initialization/i.test(message);
  return isChunkLoadError || isInitializationReferenceError;
};

const readInt = (key: string): number => {
  try {
    return parseInt(sessionStorage.getItem(key) ?? '', 10) || 0;
  } catch {
    return 0;
  }
};

/**
 * Reload onto the current deploy, at most MAX_RECOVERY_ATTEMPTS times per tab
 * and once per MIN_RECOVERY_INTERVAL_MS, so a genuinely broken chunk cannot
 * loop. Returns true when a reload was started (or one just was), false when
 * the limit is spent and the caller should show and report the error.
 */
export const recoverFromStaleBundle = (): boolean => {
  if (typeof window === 'undefined') return false;

  const attemptCount = readInt(RECOVERY_COUNT_KEY);
  if (attemptCount >= MAX_RECOVERY_ATTEMPTS) {
    logger.warn('Stale bundle auto-recovery retry limit reached', {
      attemptCount,
      maxRetries: MAX_RECOVERY_ATTEMPTS,
    });
    return false;
  }

  const now = Date.now();
  const lastAttempt = readInt(RECOVERY_TS_KEY);
  if (lastAttempt && now - lastAttempt <= MIN_RECOVERY_INTERVAL_MS) {
    return true;
  }

  try {
    sessionStorage.setItem(RECOVERY_TS_KEY, now.toString());
    sessionStorage.setItem(RECOVERY_COUNT_KEY, String(attemptCount + 1));
  } catch {
    // Without storage there is no loop guard; do not reload.
    return false;
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => reg.unregister());
    }).catch(() => undefined);
  }

  if ('caches' in window) {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    }).catch(() => undefined);
  }

  const url = new URL(window.location.href);
  url.searchParams.set('t', now.toString());
  window.location.replace(url.toString());
  return true;
};

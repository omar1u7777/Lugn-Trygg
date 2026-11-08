/**
 * Which errors have already been reported, so that one failure is one report.
 *
 * A failed request used to reach the console three times and Sentry twice:
 * the API client logged it, analytics logged it again with a synthetic copy,
 * and the component that caught it logged it a third time. Each of them is
 * right to want the failure recorded; only the first should record it.
 *
 * An error counts as reported when it, or any error in its `cause` chain, was
 * marked. That covers the common shape where an API module catches an
 * ApiError and throws `new Error(message, { cause: error })` to its caller.
 *
 * Deliberately import-free: the logger imports this, and nearly every module
 * imports the logger.
 */

const reported = new WeakSet<object>();

const isObject = (value: unknown): value is object =>
  typeof value === 'object' && value !== null;

/**
 * Record that `error` needs no further report: it was reported, or its owner
 * decided it is not a failure (a request the app cancelled itself).
 */
export const markReported = (error: unknown): void => {
  if (isObject(error)) {
    reported.add(error);
  }
};

export const wasReported = (error: unknown): boolean => {
  const seen = new Set<object>();
  let current: unknown = error;
  while (isObject(current) && !seen.has(current)) {
    if (reported.has(current)) {
      return true;
    }
    seen.add(current);
    current = (current as { cause?: unknown }).cause;
  }
  return false;
};

/**
 * Share one request between callers that ask for the same thing at the same
 * time.
 *
 * A single load of /daily-insights produced fifteen identical failed calls in
 * one burst — same endpoint, same user, same millisecond, fifteen separate
 * round trips and fifteen separate errors in the console. Several components
 * mount together and each asks for the dashboard summary independently; none
 * of them knows the others exist.
 *
 * Deduplication is the honest fix for that, and it is not caching: nothing is
 * retained after the promise settles. The second caller during a flight gets
 * the first caller's promise; the first caller after it lands gets a fresh
 * request. That distinction matters — a cache would have to reason about
 * staleness, and this does not.
 *
 * Its own module rather than part of ./client, for the same reason
 * requestOptions is: the API test suites mock './client' wholesale, and every
 * export added there has to be mirrored into every mock.
 */

const inFlight = new Map<string, Promise<unknown>>();

/**
 * Run `fn`, or join the run already under way for the same `key`.
 *
 * Failures are shared too. Fifteen callers hitting a 503 should see one 503,
 * not fifteen — and retrying fifteen times in the same instant would not have
 * helped any of them.
 */
export const dedupeInFlight = <T>(key: string, fn: () => Promise<T>): Promise<T> => {
  const existing = inFlight.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = fn().finally(() => {
    // Cleared on settle, success or failure. Leaving it would turn this into a
    // cache that never expires and permanently serve one stale answer.
    inFlight.delete(key);
  });

  inFlight.set(key, promise);
  return promise;
};

/** Test seam. Nothing in the app should need this. */
export const __clearInFlight = (): void => {
  inFlight.clear();
};

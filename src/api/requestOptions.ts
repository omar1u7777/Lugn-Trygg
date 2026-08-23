/**
 * Small helpers for building axios request configs under
 * `exactOptionalPropertyTypes: true`.
 *
 * Deliberately its own module rather than part of ./client. Test suites mock
 * './client' wholesale, so anything exported from there has to be added to
 * every mock — and a helper that is missing from a mock fails the test with
 * "No export is defined", which looks like a production bug and is not one.
 * This module has no side effects and nothing to mock.
 */

/**
 * Spread an optional AbortSignal into a request config.
 *
 * `{ signal }` where `signal?: AbortSignal` widens to `AbortSignal | undefined`,
 * and under `exactOptionalPropertyTypes` that is not assignable to
 * AxiosRequestConfig: an optional property may be ABSENT, not present-and-
 * undefined. Six call sites hit this.
 *
 * Omitting the key rather than casting keeps the distinction the compiler flag
 * exists to preserve — `{}` means "no signal", `{ signal: undefined }` means
 * "a signal, which is undefined", and axios accepts only the first.
 */
export const withSignal = (signal?: AbortSignal): { signal?: AbortSignal } =>
  signal ? { signal } : {};

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * analytics.ts loads Sentry with a dynamic import when VITE_SENTRY_DSN is set.
 * `Sentry` used to be declared with no initial value and assigned only inside
 * that import's .then(), so between module evaluation and the import
 * resolving it was undefined — and every call site except addBreadcrumb was
 * unguarded.
 *
 * That window is short but it is page load in production, which is when early
 * errors happen and when you most want them reported. One of the unguarded
 * callers is analytics.health.crisisDetected().
 *
 * These run with a DSN configured so the dynamic-import branch is the one
 * under test. Without the stubbed DSN the module takes its else branch, which
 * was always safe, and the tests could not fail.
 */
describe('analytics telemetry before Sentry finishes loading', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_SENTRY_DSN', 'https://examplePublicKey@o0.ingest.sentry.io/0');
    // Keep the import pending for the duration of each test: this is exactly
    // the state the old code crashed in.
    vi.doMock('@sentry/react', () => new Promise(() => {}) as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock('@sentry/react');
  });

  it('reports a crisis without throwing', async () => {
    const { analytics } = await import('../analytics');

    expect(() =>
      analytics.health.crisisDetected(['suicidal_ideation'], { source: 'chat' })
    ).not.toThrow();
  });

  it('captures an exception without throwing', async () => {
    const { analytics } = await import('../analytics');

    expect(() =>
      analytics.error(new Error('boom'), { component: 'Test' })
    ).not.toThrow();
  });

  it('identifies a user without throwing', async () => {
    const { analytics } = await import('../analytics');

    expect(() => analytics.identify('user-1', { email: 'a@b.se' })).not.toThrow();
  });

  it('clears user data without throwing', async () => {
    // Sentry.setUser(null) on sign-out — also unguarded.
    const { clearUserData } = await import('../analytics');

    expect(() => clearUserData()).not.toThrow();
  });
});

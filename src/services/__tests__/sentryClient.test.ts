import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * sentryClient is the single owner of the Sentry SDK. Two properties matter:
 *
 *  1. Calls made BEFORE the dynamic import resolves are queued and replayed,
 *     not dropped. That window is page load in production, and one of the
 *     callers is analytics.health.crisisDetected().
 *  2. The queue is bounded, so a boot-time error storm (or a DSN whose SDK
 *     never loads) cannot grow it without limit.
 *
 * Each test stubs the DSN and keeps @sentry/react pending, which is exactly
 * the state the old `window.Sentry` / bare-noop code silently dropped events in.
 */
describe('sentryClient', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_SENTRY_DSN', 'https://examplePublicKey@o0.ingest.sentry.io/0');
    vi.doMock('@sentry/react', () => new Promise(() => {}) as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock('@sentry/react');
  });

  it('queues calls made before the SDK resolves and replays them on arrival', async () => {
    const client = await import('../sentryClient');

    const boom = new Error('boom');
    client.captureException(boom, { tags: { source: 'test' } });
    client.captureMessage('Crisis indicators detected', {
      level: 'warning',
      tags: { type: 'crisis_detection' },
    });
    client.setUser({ id: 'user-1' });
    client.addBreadcrumb({ category: 'analytics', message: 'Mood Logged' });

    expect(client.__getQueueLengthForTests()).toBe(4);

    const fake = {
      init: vi.fn(),
      setUser: vi.fn(),
      captureException: vi.fn(),
      captureMessage: vi.fn(),
      addBreadcrumb: vi.fn(),
    };
    client.__setSentryClientForTests(fake);

    // Everything raised during the load window reached the real client.
    expect(fake.captureException).toHaveBeenCalledWith(boom, { tags: { source: 'test' } });
    expect(fake.captureMessage).toHaveBeenCalledWith('Crisis indicators detected', {
      level: 'warning',
      tags: { type: 'crisis_detection' },
    });
    expect(fake.setUser).toHaveBeenCalledWith({ id: 'user-1' });
    expect(fake.addBreadcrumb).toHaveBeenCalledTimes(1);
    expect(client.__getQueueLengthForTests()).toBe(0);
  });

  it('passes straight through once the SDK is present', async () => {
    const client = await import('../sentryClient');

    const fake = {
      init: vi.fn(),
      setUser: vi.fn(),
      captureException: vi.fn(),
      captureMessage: vi.fn(),
      addBreadcrumb: vi.fn(),
    };
    client.__setSentryClientForTests(fake);

    const boom = new Error('after load');
    client.captureException(boom);

    expect(fake.captureException).toHaveBeenCalledWith(boom, undefined);
    expect(client.__getQueueLengthForTests()).toBe(0);
  });

  it('bounds the queue so an error storm cannot grow it without limit', async () => {
    const client = await import('../sentryClient');

    for (let i = 0; i < 500; i += 1) {
      client.captureException(new Error(`err-${i}`));
    }

    expect(client.__getQueueLengthForTests()).toBe(50);

    // The events kept are the NEWEST — the ones describing the failure still
    // in progress, not the first 50 from five minutes ago.
    const fake = {
      init: vi.fn(),
      setUser: vi.fn(),
      captureException: vi.fn(),
      captureMessage: vi.fn(),
      addBreadcrumb: vi.fn(),
    };
    client.__setSentryClientForTests(fake);

    const firstReplayed = fake.captureException.mock.calls[0]?.[0] as Error;
    const lastReplayed = fake.captureException.mock.calls.at(-1)?.[0] as Error;
    expect(firstReplayed.message).toBe('err-450');
    expect(lastReplayed.message).toBe('err-499');
  });

  it('does not queue when no DSN is configured', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_SENTRY_DSN', '');

    const client = await import('../sentryClient');

    expect(client.isSentryConfigured()).toBe(false);
    client.captureException(new Error('nowhere to send this'));
    // Queueing events that can never be delivered would be a memory leak.
    expect(client.__getQueueLengthForTests()).toBe(0);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { isStaleBundleError, recoverFromStaleBundle } from '../staleBundle';

describe('isStaleBundleError', () => {
  it.each([
    new TypeError('Failed to fetch dynamically imported module: https://x/a.js'),
    new TypeError('Importing a module script failed.'),
    Object.assign(new Error('Loading chunk 3 failed'), { name: 'ChunkLoadError' }),
    new ReferenceError("Cannot access 'Xe' before initialization"),
  ])('recognises %s', (error) => {
    expect(isStaleBundleError(error)).toBe(true);
  });

  it.each([new Error('boom'), new ReferenceError('foo is not defined'), 'string', null])(
    'ignores %s',
    (error) => {
      expect(isStaleBundleError(error)).toBe(false);
    },
  );
});

describe('recoverFromStaleBundle', () => {
  const replace = vi.fn();
  const originalLocation = window.location;

  beforeEach(() => {
    sessionStorage.clear();
    replace.mockReset();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: 'https://app.test/ai-chat', replace },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    vi.useRealTimers();
  });

  it('reloads onto the current deploy with a cache-busting parameter', () => {
    expect(recoverFromStaleBundle()).toBe(true);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace.mock.calls[0][0]).toMatch(/^https:\/\/app\.test\/ai-chat\?t=\d+$/);
  });

  it('does not reload twice within ten seconds, but still reports recovery in progress', () => {
    recoverFromStaleBundle();
    expect(recoverFromStaleBundle()).toBe(true);
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it('gives up after three reloads so a broken chunk cannot loop', () => {
    vi.useFakeTimers();
    for (let i = 0; i < 3; i++) {
      expect(recoverFromStaleBundle()).toBe(true);
      vi.advanceTimersByTime(11_000);
    }
    expect(recoverFromStaleBundle()).toBe(false);
    expect(replace).toHaveBeenCalledTimes(3);
  });
});

/**
 * BUG-28: a single load of /daily-insights produced fifteen identical calls to
 * the dashboard summary in one burst — same endpoint, same user, same instant,
 * fifteen round trips and fifteen errors in the console.
 *
 * Several components mount together and each asks independently; none knows the
 * others exist. Deduplication is the fix, and it is deliberately NOT a cache:
 * nothing survives the promise settling, so no one has to reason about
 * staleness.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dedupeInFlight, __clearInFlight } from '../inFlight';

beforeEach(() => {
  __clearInFlight();
});

/** A promise you can settle by hand, so "in flight" is a real state here. */
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

describe('overlapping callers share one request', () => {
  it('runs the work once for fifteen simultaneous callers', async () => {
    const d = deferred<string>();
    const work = vi.fn(() => d.promise);

    const calls = Array.from({ length: 15 }, () => dedupeInFlight('k', work));
    d.resolve('value');

    expect(await Promise.all(calls)).toEqual(Array(15).fill('value'));
    expect(work).toHaveBeenCalledTimes(1);
  });

  it('shares the failure too', async () => {
    // Fifteen callers hitting a 503 should see one 503. Retrying fifteen times
    // in the same instant would not have helped any of them.
    const d = deferred<string>();
    const work = vi.fn(() => d.promise);

    const calls = Array.from({ length: 15 }, () => dedupeInFlight('k', work).catch((e) => e));
    d.reject(new Error('503'));

    const results = await Promise.all(calls);
    expect(results.every((r) => r instanceof Error && r.message === '503')).toBe(true);
    expect(work).toHaveBeenCalledTimes(1);
  });

  it('keeps different keys apart', async () => {
    const work = vi.fn((v: string) => Promise.resolve(v));

    await Promise.all([
      dedupeInFlight('a', () => work('a')),
      dedupeInFlight('b', () => work('b')),
    ]);

    expect(work).toHaveBeenCalledTimes(2);
  });
});

describe('it is not a cache', () => {
  it('runs again once the first request has landed', async () => {
    const work = vi.fn(() => Promise.resolve('value'));

    await dedupeInFlight('k', work);
    await dedupeInFlight('k', work);

    // Sharing a settled promise would be caching, and caching needs a staleness
    // story this has no business having.
    expect(work).toHaveBeenCalledTimes(2);
  });

  it('runs again after a failure rather than remembering it', async () => {
    const work = vi.fn()
      .mockRejectedValueOnce(new Error('503'))
      .mockResolvedValueOnce('recovered');

    await expect(dedupeInFlight('k', work)).rejects.toThrow('503');
    await expect(dedupeInFlight('k', work)).resolves.toBe('recovered');
    expect(work).toHaveBeenCalledTimes(2);
  });
});

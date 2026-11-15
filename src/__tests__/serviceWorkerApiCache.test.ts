/**
 * The service worker keeps no API answers.
 *
 * It cached every successful GET to /api/ and served the copy when the network
 * failed. Those are signed-in answers (moods, journal, profile) keyed by
 * address only: they stayed in the browser after sign-out, and the next person
 * to sign in on that browser could be shown them while offline. API requests
 * now go to the network only, and copies an older worker left are removed.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Handler = (event: Record<string, unknown>) => void;

const SOURCE = readFileSync(join(process.cwd(), 'public', 'sw.js'), 'utf8');
const API = 'https://api.example.test/api/v1/mood';

const setup = (cached: string[] = []) => {
  const handlers: Record<string, Handler> = {};
  const cache = {
    put: vi.fn(),
    addAll: vi.fn().mockResolvedValue(undefined),
    keys: vi.fn().mockResolvedValue(cached.map((url) => ({ url }))),
    delete: vi.fn().mockResolvedValue(true),
  };
  const caches = {
    open: vi.fn().mockResolvedValue(cache),
    match: vi.fn().mockResolvedValue(new Response('{"stale":true}', { status: 200 })),
    keys: vi.fn().mockResolvedValue(['lugn-trygg-v4-production']),
    delete: vi.fn().mockResolvedValue(true),
  };
  const self = {
    addEventListener: (type: string, handler: Handler) => { handlers[type] = handler; },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn() },
    location: { origin: 'https://app.example.test' },
  };
  const fetchMock = vi.fn();
  // eslint-disable-next-line no-new-func
  new Function('self', 'caches', 'fetch', 'console', SOURCE)(self, caches, fetchMock, { log: () => {}, error: () => {} });
  return { handlers, cache, caches, fetchMock };
};

const fetchEvent = (handlers: Record<string, Handler>, url: string) => {
  let answer: Promise<Response> | undefined;
  handlers.fetch?.({
    request: { url, method: 'GET', mode: 'cors', headers: new Headers() },
    respondWith: (promise: Promise<Response>) => { answer = promise; },
  });
  return answer;
};

describe('service worker and API answers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not store a successful API answer', async () => {
    const { handlers, cache, fetchMock } = setup();
    fetchMock.mockResolvedValue(new Response('{"moods":[]}', { status: 200 }));

    const answer = fetchEvent(handlers, API);
    if (answer) await answer;
    await Promise.resolve();

    expect(cache.put).not.toHaveBeenCalled();
  });

  it('answers an API request with "offline" when the network fails, never with a stored copy', async () => {
    const { handlers, caches, fetchMock } = setup();
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const answer = fetchEvent(handlers, API);

    expect(answer).toBeDefined();
    const response = await answer!;
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('stale');
    expect(caches.match).not.toHaveBeenCalled();
  });

  it('removes the API answers an older worker stored, and keeps the app shell', async () => {
    const { handlers, cache } = setup([API, 'https://app.example.test/assets/js/main.js']);
    let done: Promise<unknown> = Promise.resolve();

    handlers.activate?.({ waitUntil: (promise: Promise<unknown>) => { done = promise; } });
    await done;

    expect(cache.delete.mock.calls.map(([request]) => (request as { url: string }).url)).toEqual([API]);
  });
});

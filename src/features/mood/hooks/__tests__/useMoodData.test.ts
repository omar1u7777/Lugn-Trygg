/**
 * useMoodData pages through the server, and fetches only when asked.
 *
 * `offset` used to be state listed in fetchMoods' dependencies, and the
 * mount effect depended on fetchMoods: every page it fetched created a new
 * fetchMoods, which re-ran the effect and fetched again, with no check of
 * hasMore. /analytics stayed on "Laddar din analys…" sending about three
 * requests a second until the rate limiter answered 429.
 *
 * Paging was also done in the browser. Every page called getMoods(), which
 * sends no limit or offset, so the server answered with its newest 50 each
 * time, and the hook cut `[offset, offset + limit)` out of those 50. "Ladda
 * fler" asked for entries 50-99 of a 50-entry list, got none, and hid itself:
 * nothing older than the newest 50 could be reached.
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';

const SERVER_DEFAULT_LIMIT = 50;

// The user's entries on the server, newest first.
let serverMoods: Array<Record<string, unknown>> = [];

const { getMoods, getMoodPage, getWeeklyAnalysis, logMood } = vi.hoisted(() => ({
  getMoods: vi.fn(),
  getMoodPage: vi.fn(),
  getWeeklyAnalysis: vi.fn(),
  logMood: vi.fn(),
}));

vi.mock('../../../../api/api', () => ({ getMoods, getMoodPage, getWeeklyAnalysis, logMood }));

let currentUserId = 'user-0';
vi.mock('../../../../hooks/useAuth', () => ({
  default: () => ({ user: { user_id: currentUserId } }),
}));

import { useMoodData } from '../useMoodData';

const entries = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `m${i}`,
    mood_score: 5,
    timestamp: new Date(Date.UTC(2026, 10, 7, 0, 0) - i * 60_000).toISOString(),
  }));

// The module caches per user; a fresh user keeps each test independent.
let nextUser = 0;
const newUser = () => {
  nextUser += 1;
  currentUserId = `user-${nextUser}`;
};

const settle = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
};

const requests = () => getMoods.mock.calls.length + getMoodPage.mock.calls.length;
const ids = (moods: Array<{ id: string }>) => moods.map((m) => m.id);

describe('useMoodData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    newUser();
    serverMoods = entries(128);
    // What the real endpoint does: no parameters means the newest 50.
    getMoods.mockImplementation(async () => serverMoods.slice(0, SERVER_DEFAULT_LIMIT));
    getMoodPage.mockImplementation(async ({ offset, limit }: { offset: number; limit: number }) => {
      const moods = serverMoods.slice(offset, offset + limit);
      return { moods, total: serverMoods.length, hasMore: offset + moods.length < serverMoods.length };
    });
    getWeeklyAnalysis.mockResolvedValue({ streak: 2 });
    logMood.mockResolvedValue({});
  });

  test('fetches the first page once on mount and then stops', async () => {
    const { result } = renderHook(() => useMoodData({ limit: 50 }));

    await waitFor(() => expect(result.current.moods).toHaveLength(50));
    await settle();

    expect(requests()).toBe(1);
    expect(getWeeklyAnalysis).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasMore).toBe(true);
  });

  test('loadMore fetches the next page from the server and appends it', async () => {
    const { result } = renderHook(() => useMoodData({ limit: 50 }));
    await waitFor(() => expect(result.current.moods).toHaveLength(50));

    await act(async () => {
      await result.current.loadMore();
    });
    await settle();

    expect(ids(result.current.moods)).toEqual(ids(entries(100)));
    expect(result.current.hasMore).toBe(true);
    expect(requests()).toBe(2);
    // The weekly analysis does not change with the page.
    expect(getWeeklyAnalysis).toHaveBeenCalledTimes(1);
  });

  test('reaches the oldest entry and then stops', async () => {
    const { result } = renderHook(() => useMoodData({ limit: 50 }));
    await waitFor(() => expect(result.current.moods).toHaveLength(50));

    for (let page = 0; page < 2; page += 1) {
      await act(async () => {
        await result.current.loadMore();
      });
    }
    await settle();

    expect(result.current.moods).toHaveLength(128);
    expect(result.current.moods.at(-1)?.id).toBe('m127');
    expect(result.current.hasMore).toBe(false);
  });

  test('stops when a user has fewer entries than one page', async () => {
    serverMoods = entries(3);

    const { result } = renderHook(() => useMoodData({ limit: 50 }));

    await waitFor(() => expect(result.current.moods).toHaveLength(3));
    await settle();

    expect(requests()).toBe(1);
    expect(result.current.hasMore).toBe(false);
  });

  test('a failed next page keeps what was loaded and can be retried', async () => {
    const { result } = renderHook(() => useMoodData({ limit: 50 }));
    await waitFor(() => expect(result.current.moods).toHaveLength(50));

    getMoodPage.mockRejectedValueOnce(new Error('offline'));
    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.moods).toHaveLength(50);
    expect(result.current.error).not.toBeNull();
    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      await result.current.loadMore();
    });
    expect(result.current.moods).toHaveLength(100);
  });

  test('a cached first page still offers the next one', async () => {
    const first = renderHook(() => useMoodData({ limit: 50 }));
    await waitFor(() => expect(first.result.current.moods).toHaveLength(50));
    first.unmount();

    const second = renderHook(() => useMoodData({ limit: 50 }));
    await waitFor(() => expect(second.result.current.moods).toHaveLength(50));

    expect(second.result.current.hasMore).toBe(true);
    await act(async () => {
      await second.result.current.loadMore();
    });
    expect(ids(second.result.current.moods)).toEqual(ids(entries(100)));
  });

  test('refetch and logging a mood reload the first page instead of appending', async () => {
    const { result } = renderHook(() => useMoodData({ limit: 50 }));
    await waitFor(() => expect(result.current.moods).toHaveLength(50));

    await act(async () => {
      await result.current.logMood({ score: 7, mood: 'happy', tags: [] });
    });
    await act(async () => {
      await result.current.refetch();
    });
    await settle();

    expect(result.current.moods).toHaveLength(50);
    expect(new Set(ids(result.current.moods)).size).toBe(50);
    // Mount, after logging, and the refetch: each asked the server.
    expect(requests()).toBe(3);
  });
});

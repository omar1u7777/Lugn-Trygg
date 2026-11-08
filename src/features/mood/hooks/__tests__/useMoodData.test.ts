/**
 * useMoodData fetches once per user, and again only when asked.
 *
 * `offset` used to be state listed in fetchMoods' dependencies, and the
 * mount effect depended on fetchMoods: every page it fetched created a new
 * fetchMoods, which re-ran the effect and fetched again, with no check of
 * hasMore. /analytics stayed on "Laddar din analys…" sending about three
 * requests a second until the rate limiter answered 429.
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';

const { getMoods, getWeeklyAnalysis, logMood } = vi.hoisted(() => ({
  getMoods: vi.fn(),
  getWeeklyAnalysis: vi.fn(),
  logMood: vi.fn(),
}));

vi.mock('../../../../api/api', () => ({ getMoods, getWeeklyAnalysis, logMood }));

let currentUserId = 'user-0';
vi.mock('../../../../hooks/useAuth', () => ({
  default: () => ({ user: { user_id: currentUserId } }),
}));

import { useMoodData } from '../useMoodData';

const entries = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `m${i}`,
    mood_score: 5,
    timestamp: new Date(Date.UTC(2026, 10, 1, 0, i)).toISOString(),
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

describe('useMoodData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    newUser();
    getMoods.mockResolvedValue(entries(60));
    getWeeklyAnalysis.mockResolvedValue({ streak: 2 });
    logMood.mockResolvedValue({});
  });

  test('fetches once on mount and then stops', async () => {
    const { result } = renderHook(() => useMoodData({ limit: 50 }));

    await waitFor(() => expect(result.current.moods).toHaveLength(50));
    await settle();

    expect(getMoods).toHaveBeenCalledTimes(1);
    expect(getWeeklyAnalysis).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasMore).toBe(true);
  });

  test('stops when a user has fewer entries than one page', async () => {
    getMoods.mockResolvedValue(entries(3));

    const { result } = renderHook(() => useMoodData({ limit: 50 }));

    await waitFor(() => expect(result.current.moods).toHaveLength(3));
    await settle();

    expect(getMoods).toHaveBeenCalledTimes(1);
    expect(result.current.hasMore).toBe(false);
  });

  test('loadMore appends the next page once, and only when asked', async () => {
    const { result } = renderHook(() => useMoodData({ limit: 50 }));
    await waitFor(() => expect(result.current.moods).toHaveLength(50));

    await act(async () => {
      await result.current.loadMore();
    });
    await settle();

    expect(result.current.moods).toHaveLength(60);
    expect(result.current.hasMore).toBe(false);
    expect(getMoods).toHaveBeenCalledTimes(2);
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
    expect(new Set(result.current.moods.map((m) => m.id)).size).toBe(50);
    // Mount, after logging, and the refetch: each asked the server.
    expect(getMoods).toHaveBeenCalledTimes(3);
  });
});

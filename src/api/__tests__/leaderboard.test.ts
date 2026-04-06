import { vi, describe, it, expect, beforeEach } from 'vitest';

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../client', () => ({ api: apiMock, default: apiMock, apiClient: apiMock }));

import {
  getXPLeaderboard,
  getStreakLeaderboard,
  getMoodLeaderboard,
  getUserRanking,
  getWeeklyWinners,
} from '../leaderboard';

describe('leaderboard API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getXPLeaderboard returns leaderboard', async () => {
    const data = { entries: [], total: 0 };
    apiMock.get.mockResolvedValueOnce({ data: { data } });
    await getXPLeaderboard();
    expect(apiMock.get).toHaveBeenCalled();
  });

  it('getXPLeaderboard with params', async () => {
    apiMock.get.mockResolvedValueOnce({ data: { data: { entries: [] } } });
    await getXPLeaderboard(10, 'global');
    expect(apiMock.get).toHaveBeenCalled();
  });

  it('getXPLeaderboard throws on error', async () => {
    apiMock.get.mockRejectedValueOnce(new Error('fail'));
    await expect(getXPLeaderboard()).rejects.toThrow();
  });

  it('getStreakLeaderboard returns data', async () => {
    apiMock.get.mockResolvedValueOnce({ data: { data: { entries: [] } } });
    await getStreakLeaderboard();
    expect(apiMock.get).toHaveBeenCalled();
  });

  it('getStreakLeaderboard throws on error', async () => {
    apiMock.get.mockRejectedValueOnce(new Error('fail'));
    await expect(getStreakLeaderboard()).rejects.toThrow();
  });

  it('getMoodLeaderboard returns data', async () => {
    apiMock.get.mockResolvedValueOnce({ data: { data: { entries: [] } } });
    await getMoodLeaderboard();
    expect(apiMock.get).toHaveBeenCalled();
  });

  it('getMoodLeaderboard throws on error', async () => {
    apiMock.get.mockRejectedValueOnce(new Error('fail'));
    await expect(getMoodLeaderboard()).rejects.toThrow();
  });

  it('getUserRanking returns user rankings', async () => {
    const rankData = {
      success: true,
      data: {
        rankings: { xp: { rank: 5, value: 100, percentile: 80 }, streak: { rank: 3, value: 10, percentile: 90 }, moods: { rank: 8, value: 50, percentile: 70 } },
        totalUsers: 100,
      },
      message: 'ok',
    };
    apiMock.get.mockResolvedValueOnce({ data: rankData });
    const result = await getUserRanking('u1');
    expect(result).toHaveProperty('xp');
    expect(result).toHaveProperty('streak');
    expect(result).toHaveProperty('moods');
  });

  it('getUserRanking throws on error', async () => {
    apiMock.get.mockRejectedValueOnce(new Error('fail'));
    await expect(getUserRanking('u1')).rejects.toThrow();
  });

  it('getWeeklyWinners returns winners', async () => {
    const response = {
      success: true,
      data: { weekStart: '2026-04-01', weekEnd: '2026-04-07', winners: { xp: [] } },
      message: 'ok',
    };
    apiMock.get.mockResolvedValueOnce({ data: response });
    const result = await getWeeklyWinners();
    expect(result).toHaveProperty('data');
    expect(result.data).toHaveProperty('winners');
  });

  it('getWeeklyWinners throws on error', async () => {
    apiMock.get.mockRejectedValueOnce(new Error('fail'));
    await expect(getWeeklyWinners()).rejects.toThrow();
  });
});

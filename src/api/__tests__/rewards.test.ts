import { vi, describe, it, expect, beforeEach } from 'vitest';

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../client', () => ({ api: apiMock, default: apiMock, apiClient: apiMock }));

import {
  getUserRewards,
  getRewardCatalog,
  getAchievements,
  claimReward,
  checkAchievements,
  getUserBadges,
} from '../rewards';

describe('rewards API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getUserRewards returns reward data', async () => {
    const reward = { xp: 100, level: 3, badges: [], achievements: [] };
    apiMock.get.mockResolvedValueOnce({ data: { data: { rewards: reward } } });
    const result = await getUserRewards();
    expect(result).toMatchObject(reward);
  });

  it('getUserRewards throws on error', async () => {
    apiMock.get.mockRejectedValueOnce(new Error('fail'));
    await expect(getUserRewards()).rejects.toThrow();
  });

  it('getRewardCatalog returns items array', async () => {
    const items = [{ id: 'r1', name: 'Badge' }];
    apiMock.get.mockResolvedValueOnce({ data: { data: items } });
    const result = await getRewardCatalog();
    expect(Array.isArray(result)).toBe(true);
  });

  it('getRewardCatalog throws on error', async () => {
    apiMock.get.mockRejectedValueOnce(new Error('fail'));
    await expect(getRewardCatalog()).rejects.toThrow();
  });

  it('getAchievements returns list', async () => {
    apiMock.get.mockResolvedValueOnce({ data: { data: [] } });
    const result = await getAchievements();
    expect(Array.isArray(result)).toBe(true);
  });

  it('getAchievements throws on error', async () => {
    apiMock.get.mockRejectedValueOnce(new Error('fail'));
    await expect(getAchievements()).rejects.toThrow();
  });

  it('claimReward returns claim result', async () => {
    const claim = { success: true, reward: { id: 'r1' } };
    apiMock.post.mockResolvedValueOnce({ data: { data: claim } });
    const result = await claimReward('r1');
    expect(result).toMatchObject(claim);
  });

  it('claimReward throws on error', async () => {
    apiMock.post.mockRejectedValueOnce(new Error('fail'));
    await expect(claimReward('r1')).rejects.toThrow();
  });

  it('checkAchievements returns achievements', async () => {
    const achievements = [{ id: 'a1', unlocked: true }];
    apiMock.post.mockResolvedValueOnce({ data: { data: achievements } });
    const result = await checkAchievements({ mood_count: 10 });
    expect(Array.isArray(result)).toBe(true);
  });

  it('checkAchievements sends only the UTC offset, never counts', async () => {
    apiMock.post.mockResolvedValueOnce({ data: { data: { newAchievements: [] } } });
    await checkAchievements({ mood_count: 100000 });
    const body = apiMock.post.mock.calls[0][1];
    expect(body).toEqual({ tz_offset_minutes: -new Date().getTimezoneOffset() });
  });

  it('checkAchievements throws on error', async () => {
    apiMock.post.mockRejectedValueOnce(new Error('fail'));
    await expect(checkAchievements({})).rejects.toThrow();
  });

  it('getUserBadges returns badges', async () => {
    apiMock.get.mockResolvedValueOnce({ data: { data: [] } });
    const result = await getUserBadges();
    expect(result).toBeDefined();
  });

  it('getUserBadges throws on error', async () => {
    apiMock.get.mockRejectedValueOnce(new Error('fail'));
    await expect(getUserBadges()).rejects.toThrow();
  });
});

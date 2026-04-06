import { vi, describe, it, expect, beforeEach } from 'vitest';

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../client', () => ({ api: apiMock, default: apiMock, apiClient: apiMock }));

import {
  getUserProfile,
  getUserStats,
  updateUserPreferences,
  updateNotificationPreferences,
  setNotificationSchedule,
} from '../users';

describe('users API', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('getUserProfile', () => {
    it('returns user profile', async () => {
      const profile = { id: 'u1', displayName: 'Test User', email: 'test@example.com' };
      apiMock.get.mockResolvedValueOnce({ data: { data: profile } });
      const result = await getUserProfile();
      expect(result).toMatchObject(profile);
    });

    it('throws on error', async () => {
      apiMock.get.mockRejectedValueOnce(new Error('fail'));
      await expect(getUserProfile()).rejects.toThrow();
    });
  });

  describe('getUserStats', () => {
    it('returns user stats', async () => {
      const stats = { totalMoods: 42, streak: 7, avgScore: 7.5 };
      apiMock.get.mockResolvedValueOnce({ data: { data: stats } });
      const result = await getUserStats();
      expect(result).toMatchObject(stats);
    });

    it('throws on error', async () => {
      apiMock.get.mockRejectedValueOnce(new Error('fail'));
      await expect(getUserStats()).rejects.toThrow();
    });
  });

  describe('updateUserPreferences', () => {
    it('updates prefs and returns them', async () => {
      const prefs = { language: 'sv', theme: 'dark' };
      apiMock.put.mockResolvedValueOnce({ data: { data: prefs } });
      const result = await updateUserPreferences({ language: 'sv', theme: 'dark' });
      expect(result).toMatchObject(prefs);
    });

    it('throws on error', async () => {
      apiMock.put.mockRejectedValueOnce(new Error('fail'));
      await expect(updateUserPreferences({ language: 'sv' })).rejects.toThrow();
    });
  });

  describe('updateNotificationPreferences', () => {
    it('updates notification prefs', async () => {
      apiMock.put.mockResolvedValueOnce({ data: { success: true } });
      await expect(updateNotificationPreferences({ emailNotifications: true })).resolves.not.toThrow();
    });

    it('throws on error', async () => {
      apiMock.put.mockRejectedValueOnce(new Error('fail'));
      await expect(updateNotificationPreferences({})).rejects.toThrow();
    });
  });

  describe('setNotificationSchedule', () => {
    it('sets schedule', async () => {
      apiMock.post.mockResolvedValueOnce({ data: { success: true } });
      await expect(setNotificationSchedule({ time: '09:00', days: ['mon'] })).resolves.not.toThrow();
    });

    it('throws on error', async () => {
      apiMock.post.mockRejectedValueOnce(new Error('fail'));
      await expect(setNotificationSchedule({ time: '09:00' })).rejects.toThrow();
    });
  });
});

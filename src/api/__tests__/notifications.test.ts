import { vi, describe, it, expect, beforeEach } from 'vitest';

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../client', () => ({ api: apiMock, default: apiMock, apiClient: apiMock }));
vi.mock('../../utils/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import {
  saveFCMToken,
  sendReminder,
  scheduleDailyNotifications,
  disableAllNotifications,
  getNotificationSettings,
  updateNotificationSettings,
} from '../notifications';

describe('notifications API', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('saveFCMToken', () => {
    it('posts token and returns data', async () => {
      apiMock.post.mockResolvedValueOnce({ data: { success: true } });
      const result = await saveFCMToken('tok123');
      expect(apiMock.post).toHaveBeenCalled();
      expect(result).toMatchObject({ success: true });
    });

    it('throws on error', async () => {
      apiMock.post.mockRejectedValueOnce(new Error('fail'));
      await expect(saveFCMToken('tok')).rejects.toThrow();
    });
  });

  describe('sendReminder', () => {
    it('sends with default type', async () => {
      apiMock.post.mockResolvedValueOnce({ data: { success: true, scheduled: true } });
      const result = await sendReminder('Check in!');
      expect(result).toMatchObject({ success: true });
    });

    it('sends with custom type', async () => {
      apiMock.post.mockResolvedValueOnce({ data: { success: true } });
      const result = await sendReminder('Hello', 'weekly');
      expect(result).toMatchObject({ success: true });
    });

    it('throws on error', async () => {
      apiMock.post.mockRejectedValueOnce(new Error('fail'));
      await expect(sendReminder('msg')).rejects.toThrow();
    });
  });

  describe('scheduleDailyNotifications', () => {
    it('schedules with defaults', async () => {
      apiMock.post.mockResolvedValueOnce({ data: { success: true, scheduled: true } });
      const result = await scheduleDailyNotifications(true);
      expect(result).toMatchObject({ success: true });
    });

    it('schedules at custom time', async () => {
      apiMock.post.mockResolvedValueOnce({ data: { success: true } });
      const result = await scheduleDailyNotifications(false, '18:00');
      expect(result).toMatchObject({ success: true });
    });

    it('throws on error', async () => {
      apiMock.post.mockRejectedValueOnce(new Error('fail'));
      await expect(scheduleDailyNotifications(true)).rejects.toThrow();
    });
  });

  describe('disableAllNotifications', () => {
    it('disables and returns allDisabled', async () => {
      apiMock.post.mockResolvedValueOnce({ data: { allDisabled: true } });
      const result = await disableAllNotifications();
      expect(result.allDisabled).toBe(true);
    });

    it('throws on error', async () => {
      apiMock.post.mockRejectedValueOnce(new Error('fail'));
      await expect(disableAllNotifications()).rejects.toThrow();
    });
  });

  describe('getNotificationSettings', () => {
    it('returns settings', async () => {
      const settings = { enabled: true, time: '09:00', timezone: 'Europe/Stockholm' };
      apiMock.get.mockResolvedValueOnce({ data: settings });
      const result = await getNotificationSettings();
      expect(result).toMatchObject(settings);
    });

    it('returns default settings on error', async () => {
      apiMock.get.mockRejectedValueOnce(new Error('fail'));
      const result = await getNotificationSettings();
      // Function has catch that returns defaults instead of throwing
      expect(result).toHaveProperty('dailyRemindersEnabled');
    });
  });

  describe('updateNotificationSettings', () => {
    it('updates and returns settings', async () => {
      const updated = { updated: true };
      apiMock.post.mockResolvedValueOnce({ data: { data: updated } });
      const result = await updateNotificationSettings({ dailyRemindersEnabled: false, reminderTime: '09:00' });
      expect(result).toMatchObject(updated);
    });

    it('throws on error', async () => {
      apiMock.post.mockRejectedValueOnce(new Error('fail'));
      await expect(updateNotificationSettings({ dailyRemindersEnabled: true, reminderTime: '09:00' })).rejects.toThrow();
    });
  });
});

import { vi, describe, it, expect, beforeEach } from 'vitest';

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../client', () => ({ api: apiMock, default: apiMock, apiClient: apiMock }));

import { saveMeditationSession, getMeditationSessions } from '../meditation';

describe('meditation API', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('saveMeditationSession', () => {
    it('posts session and returns result', async () => {
      const session = { id: 'm1', duration: 600, type: 'breathing' };
      apiMock.post.mockResolvedValueOnce({ data: { data: session } });
      const result = await saveMeditationSession({ duration: 600, type: 'breathing', completedAt: new Date().toISOString() });
      expect(apiMock.post).toHaveBeenCalled();
      expect(result).toMatchObject(session);
    });

    it('throws on error', async () => {
      apiMock.post.mockRejectedValueOnce(new Error('fail'));
      await expect(saveMeditationSession({ duration: 300, type: 'body_scan', completedAt: '' })).rejects.toThrow();
    });
  });

  describe('getMeditationSessions', () => {
    it('returns sessions list with default limit', async () => {
      const sessions = [{ id: 'm1' }, { id: 'm2' }];
      apiMock.get.mockResolvedValueOnce({ data: { data: sessions } });
      const result = await getMeditationSessions();
      expect(Array.isArray(result)).toBe(true);
    });

    it('accepts custom limit', async () => {
      apiMock.get.mockResolvedValueOnce({ data: { data: [] } });
      await getMeditationSessions(5);
      expect(apiMock.get).toHaveBeenCalled();
    });

    it('throws on error', async () => {
      apiMock.get.mockRejectedValueOnce(new Error('fail'));
      await expect(getMeditationSessions()).rejects.toThrow();
    });
  });
});

import { vi, describe, it, expect, beforeEach } from 'vitest';

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../client', () => ({ api: apiMock, default: apiMock, apiClient: apiMock }));

import {
  generateInsights,
  getPendingInsights,
  dismissInsight,
  markInsightActionTaken,
} from '../insights';

describe('insights API', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('generateInsights', () => {
    it('returns generated insights', async () => {
      const insights = [{ id: 'i1', type: 'trend', message: 'Mood improving' }];
      apiMock.post.mockResolvedValueOnce({ data: { data: insights } });
      const result = await generateInsights('u1');
      expect(Array.isArray(result)).toBe(true);
    });

    it('throws on error', async () => {
      apiMock.post.mockRejectedValueOnce(new Error('fail'));
      await expect(generateInsights('u1')).rejects.toThrow();
    });
  });

  describe('getPendingInsights', () => {
    it('returns pending insights array', async () => {
      apiMock.get.mockResolvedValueOnce({ data: { data: [] } });
      const result = await getPendingInsights('u1');
      expect(Array.isArray(result)).toBe(true);
    });

    it('throws on error', async () => {
      apiMock.get.mockRejectedValueOnce(new Error('fail'));
      await expect(getPendingInsights('u1')).rejects.toThrow();
    });
  });

  describe('dismissInsight', () => {
    it('dismisses insight via post', async () => {
      apiMock.post.mockResolvedValueOnce({ data: { success: true } });
      await expect(dismissInsight('i1')).resolves.not.toThrow();
      expect(apiMock.post).toHaveBeenCalled();
    });

    it('throws on error', async () => {
      apiMock.post.mockRejectedValueOnce(new Error('fail'));
      await expect(dismissInsight('i1')).rejects.toThrow();
    });
  });

  describe('markInsightActionTaken', () => {
    it('marks action taken via post', async () => {
      apiMock.post.mockResolvedValueOnce({ data: { success: true } });
      await expect(markInsightActionTaken('i1', 'done')).resolves.not.toThrow();
    });

    it('throws on error', async () => {
      apiMock.post.mockRejectedValueOnce(new Error('fail'));
      await expect(markInsightActionTaken('i1', 'done')).rejects.toThrow();
    });
  });
});

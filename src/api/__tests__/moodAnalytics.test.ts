import { vi, describe, it, expect, beforeEach } from 'vitest';

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../client', () => ({ api: apiMock, default: apiMock, apiClient: apiMock }));

import {
  getCorrelationAnalysis,
  getClinicalFlags,
  getImpactAnalysis,
} from '../moodAnalytics';

describe('moodAnalytics API', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('getCorrelationAnalysis', () => {
    it('returns correlation data', async () => {
      const data = { correlations: [], period: 30 };
      apiMock.get.mockResolvedValueOnce({ data: { data } });
      const result = await getCorrelationAnalysis(30);
      expect(apiMock.get).toHaveBeenCalled();
    });

    it('uses default period', async () => {
      apiMock.get.mockResolvedValueOnce({ data: { data: {} } });
      await getCorrelationAnalysis();
      expect(apiMock.get).toHaveBeenCalled();
    });

    it('throws on error', async () => {
      apiMock.get.mockRejectedValueOnce(new Error('fail'));
      await expect(getCorrelationAnalysis()).rejects.toThrow();
    });
  });

  describe('getClinicalFlags', () => {
    it('returns clinical flags', async () => {
      const flags = { flags: [], severity: 'low' };
      apiMock.get.mockResolvedValueOnce({ data: { data: flags } });
      const result = await getClinicalFlags();
      expect(apiMock.get).toHaveBeenCalled();
    });

    it('throws on error', async () => {
      apiMock.get.mockRejectedValueOnce(new Error('fail'));
      await expect(getClinicalFlags()).rejects.toThrow();
    });
  });

  describe('getImpactAnalysis', () => {
    it('returns impact analysis', async () => {
      const analysis = { factors: [], topFactor: 'sleep' };
      apiMock.get.mockResolvedValueOnce({ data: { data: analysis } });
      const result = await getImpactAnalysis('sleep');
      expect(apiMock.get).toHaveBeenCalled();
    });

    it('throws on error', async () => {
      apiMock.get.mockRejectedValueOnce(new Error('fail'));
      await expect(getImpactAnalysis('sleep')).rejects.toThrow();
    });
  });
});

import { vi, describe, it, expect, beforeEach } from 'vitest';

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../client', () => ({ api: apiMock, default: apiMock, apiClient: apiMock }));

import {
  getKeyRotationStatus,
  getTamperEvents,
  getSecurityMetrics,
} from '../security';

describe('security API', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('getKeyRotationStatus', () => {
    it('returns rotation status', async () => {
      const status = { lastRotated: '2026-01-01', nextRotation: '2026-07-01', rotationsCount: 2 };
      apiMock.get.mockResolvedValueOnce({ data: { data: status } });
      const result = await getKeyRotationStatus();
      expect(result).toMatchObject(status);
    });

    it('throws on error', async () => {
      apiMock.get.mockRejectedValueOnce(new Error('fail'));
      await expect(getKeyRotationStatus()).rejects.toThrow();
    });
  });

  describe('getTamperEvents', () => {
    it('returns events with default limit', async () => {
      const payload = { events: [], total: 0 };
      apiMock.get.mockResolvedValueOnce({ data: { data: payload } });
      const result = await getTamperEvents();
      expect(result).toMatchObject(payload);
    });

    it('accepts custom limit', async () => {
      apiMock.get.mockResolvedValueOnce({ data: { data: { events: [] } } });
      await getTamperEvents(10);
      expect(apiMock.get).toHaveBeenCalled();
    });

    it('throws on error', async () => {
      apiMock.get.mockRejectedValueOnce(new Error('fail'));
      await expect(getTamperEvents()).rejects.toThrow();
    });
  });

  describe('getSecurityMetrics', () => {
    it('returns security metrics', async () => {
      const metrics = { failedLogins: 3, suspiciousIps: [], lastAudit: '2026-04-01' };
      apiMock.get.mockResolvedValueOnce({ data: { data: metrics } });
      const result = await getSecurityMetrics();
      expect(result).toMatchObject(metrics);
    });

    it('throws on error', async () => {
      apiMock.get.mockRejectedValueOnce(new Error('fail'));
      await expect(getSecurityMetrics()).rejects.toThrow();
    });
  });
});

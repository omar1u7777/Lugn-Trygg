import { vi, describe, it, expect, beforeEach } from 'vitest';

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../client', () => ({ api: apiMock, default: apiMock, apiClient: apiMock }));

import { getReferralStats } from '../social';

describe('social API', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('getReferralStats', () => {
    it('returns referral stats', async () => {
      const stats = { referralCode: 'ABC123', referrals: 3, rewards: 15 };
      apiMock.get.mockResolvedValueOnce({ data: { data: stats } });
      const result = await getReferralStats();
      expect(result).toMatchObject(stats);
    });

    it('throws on error', async () => {
      apiMock.get.mockRejectedValueOnce(new Error('fail'));
      await expect(getReferralStats()).rejects.toThrow();
    });
  });
});

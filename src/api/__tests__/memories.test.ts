import { vi, describe, it, expect, beforeEach } from 'vitest';

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../client', () => ({ api: apiMock, default: apiMock, apiClient: apiMock }));

import { getMemories } from '../memories';

describe('memories API', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('getMemories', () => {
    it('returns memories array', async () => {
      const memories = [{ id: 'm1', title: 'Good day', content: 'Had fun' }];
      apiMock.get.mockResolvedValueOnce({ data: { data: memories } });
      const result = await getMemories('u1');
      expect(Array.isArray(result)).toBe(true);
    });

    it('throws on error', async () => {
      apiMock.get.mockRejectedValueOnce(new Error('fail'));
      await expect(getMemories('u1')).rejects.toThrow();
    });
  });
});

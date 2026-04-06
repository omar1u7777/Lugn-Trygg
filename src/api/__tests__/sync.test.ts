import { vi, describe, it, expect, beforeEach } from 'vitest';

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../client', () => ({ api: apiMock, default: apiMock, apiClient: apiMock }));

import {
  getSyncHistory,
  logSyncOperation,
  getSyncStats,
  retrySyncOperation,
} from '../sync';

describe('sync API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getSyncHistory returns history with default params', async () => {
    const history = { operations: [], total: 0 };
    apiMock.get.mockResolvedValueOnce({ data: { data: history } });
    const result = await getSyncHistory('u1');
    expect(apiMock.get).toHaveBeenCalled();
  });

  it('getSyncHistory with custom limit and status', async () => {
    apiMock.get.mockResolvedValueOnce({ data: { data: { operations: [] } } });
    await getSyncHistory('u1', 5, 'failed');
    expect(apiMock.get).toHaveBeenCalled();
  });

  it('getSyncHistory throws on error', async () => {
    apiMock.get.mockRejectedValueOnce(new Error('fail'));
    await expect(getSyncHistory('u1')).rejects.toThrow();
  });

  it('logSyncOperation returns sync id', async () => {
    apiMock.post.mockResolvedValueOnce({ data: { data: { syncId: 's1' } } });
    const result = await logSyncOperation({ operation: 'mood_sync', status: 'success' });
    expect(typeof result).toBe('string');
  });

  it('logSyncOperation throws on error', async () => {
    apiMock.post.mockRejectedValueOnce(new Error('fail'));
    await expect(logSyncOperation({ operation: 'mood_sync' })).rejects.toThrow();
  });

  it('getSyncStats returns stats', async () => {
    const stats = { totalOps: 50, successRate: 0.95 };
    apiMock.get.mockResolvedValueOnce({ data: { data: stats } });
    const result = await getSyncStats();
    expect(result).toMatchObject(stats);
  });

  it('getSyncStats throws on error', async () => {
    apiMock.get.mockRejectedValueOnce(new Error('fail'));
    await expect(getSyncStats()).rejects.toThrow();
  });

  it('retrySyncOperation returns retry id', async () => {
    apiMock.post.mockResolvedValueOnce({ data: { data: { retryId: 'r1', message: 'Queued' } } });
    const result = await retrySyncOperation('s1');
    expect(result).toHaveProperty('retryId');
  });

  it('retrySyncOperation throws on error', async () => {
    apiMock.post.mockRejectedValueOnce(new Error('fail'));
    await expect(retrySyncOperation('s1')).rejects.toThrow();
  });
});

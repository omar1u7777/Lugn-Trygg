import { vi, describe, it, expect, beforeEach } from 'vitest';

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../client', () => ({
  api: apiMock,
  default: apiMock,
  apiClient: apiMock,
  unwrapApiResponse: (payload: unknown) => payload,
}));

import {
  getBreathingPatterns,
  startBreathingSession,
  endBreathingSession,
  getSessionHistory,
} from '../biofeedback';

describe('biofeedback API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getBreathingPatterns returns array', async () => {
    const patterns = [{ id: 'p1', name: 'Box Breathing', inhale_seconds: 4, hold_seconds: 4, exhale_seconds: 4 }];
    apiMock.get.mockResolvedValueOnce({ data: patterns });
    const result = await getBreathingPatterns();
    expect(Array.isArray(result)).toBe(true);
  });

  it('getBreathingPatterns returns patterns property when wrapped', async () => {
    const patterns = [{ id: 'p1', name: 'Box Breathing' }];
    apiMock.get.mockResolvedValueOnce({ data: { patterns } });
    const result = await getBreathingPatterns();
    expect(Array.isArray(result)).toBe(true);
  });

  it('getBreathingPatterns throws on error', async () => {
    apiMock.get.mockRejectedValueOnce(new Error('fail'));
    await expect(getBreathingPatterns()).rejects.toThrow();
  });

  it('startBreathingSession starts session with correct args', async () => {
    const session = { session_id: 's1', pattern: 'coherence', ws_namespace: null };
    apiMock.post.mockResolvedValueOnce({ data: session });
    const result = await startBreathingSession('coherence', 5);
    expect(result).toMatchObject(session);
  });

  it('startBreathingSession uses default duration', async () => {
    apiMock.post.mockResolvedValueOnce({ data: { session_id: 's2', pattern: 'relax', ws_namespace: null } });
    await startBreathingSession('relax');
    expect(apiMock.post).toHaveBeenCalled();
  });

  it('startBreathingSession throws on error', async () => {
    apiMock.post.mockRejectedValueOnce(new Error('fail'));
    await expect(startBreathingSession('relax')).rejects.toThrow();
  });

  it('endBreathingSession ends session', async () => {
    apiMock.post.mockResolvedValueOnce({ data: { success: true, summary: { duration: 300 } } });
    const res = await endBreathingSession('s1');
    expect(res.success).toBe(true);
  });

  it('endBreathingSession throws on error', async () => {
    apiMock.post.mockRejectedValueOnce(new Error('fail'));
    await expect(endBreathingSession('s1')).rejects.toThrow();
  });

  it('getSessionHistory returns sessions', async () => {
    apiMock.get.mockResolvedValueOnce({ data: { sessions: [], total: 0 } });
    const result = await getSessionHistory(5);
    expect(result).toHaveProperty('sessions');
    expect(result).toHaveProperty('total');
  });

  it('getSessionHistory uses default limit', async () => {
    apiMock.get.mockResolvedValueOnce({ data: { sessions: [], total: 0 } });
    await getSessionHistory();
    expect(apiMock.get).toHaveBeenCalled();
  });

  it('getSessionHistory throws on error', async () => {
    apiMock.get.mockRejectedValueOnce(new Error('fail'));
    await expect(getSessionHistory()).rejects.toThrow();
  });
});

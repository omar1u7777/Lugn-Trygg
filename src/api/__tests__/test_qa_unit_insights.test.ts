import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the api client
vi.mock('../client', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

import { api } from '../client';
import {
  generateInsights,
  getPendingInsights,
  dismissInsight,
  markInsightActionTaken,
} from '../insights';
import type { BackendInsight } from '../insights';

// ---------------------------------------------------------------------------
// generateInsights
// ---------------------------------------------------------------------------
describe('generateInsights', () => {
  beforeEach(() => vi.clearAllMocks());

  it('posts to generate endpoint with userId', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: { insights: [{ insight_id: 'i1', user_id: 'u1', insight_type: 'temporal_trend', domain: 'mood', title: 'Trend', message: 'msg', recommendation: 'rec', evidence: {}, urgency: 'low', suggested_action: 'act', related_memories: [], values_alignment: null, behavioral_target: null, created_at: '2024-01-01', status: 'pending' }] } },
    });
    const result = await generateInsights('user123');
    expect(api.post).toHaveBeenCalledWith('/api/v1/insights/generate/user123', {}, expect.objectContaining({ timeout: 60000 }));
    expect(result).toHaveLength(1);
    expect(result[0].insight_id).toBe('i1');
    expect(result[0].urgency).toBe('low');
  });

  it('returns empty array when no insights in response', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    const result = await generateInsights('user123');
    expect(result).toEqual([]);
  });

  it('throws on network error', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockRejectedValue({ message: 'Network Error', isAxiosError: true, response: undefined, config: {} });
    await expect(generateInsights('user123')).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getPendingInsights
// ---------------------------------------------------------------------------
describe('getPendingInsights', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches pending insights for user', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: { insights: [{ insight_id: 'i1', user_id: 'u1', insight_type: 'behavioral_activation', domain: 'activity', title: 'T', message: 'M', recommendation: 'R', evidence: {}, urgency: 'medium', suggested_action: 'A', related_memories: [], values_alignment: 'growth', behavioral_target: 'exercise', created_at: '2024-01-01', status: 'pending' }] } },
    });
    const result = await getPendingInsights('user123');
    expect(api.get).toHaveBeenCalledWith('/api/v1/insights/pending/user123', { signal: undefined });
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('pending');
    expect(result[0].behavioral_target).toBe('exercise');
  });

  it('returns empty array when no pending insights', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    const result = await getPendingInsights('user123');
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// dismissInsight
// ---------------------------------------------------------------------------
describe('dismissInsight', () => {
  beforeEach(() => vi.clearAllMocks());

  it('posts to dismiss endpoint with insightId', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({});
    await dismissInsight('insight123');
    expect(api.post).toHaveBeenCalledWith('/api/v1/insights/dismiss/insight123', {}, { signal: undefined });
  });

  it('throws on error', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockRejectedValue({ message: 'fail', isAxiosError: true, response: undefined, config: {} });
    await expect(dismissInsight('insight123')).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// markInsightActionTaken
// ---------------------------------------------------------------------------
describe('markInsightActionTaken', () => {
  beforeEach(() => vi.clearAllMocks());

  it('posts action to endpoint with insightId', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({});
    await markInsightActionTaken('insight123', 'completed');
    expect(api.post).toHaveBeenCalledWith('/api/v1/insights/action/insight123', { action: 'completed' }, { signal: undefined });
  });

  it('defaults action to completed', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({});
    await markInsightActionTaken('insight123');
    expect(api.post).toHaveBeenCalledWith('/api/v1/insights/action/insight123', { action: 'completed' }, { signal: undefined });
  });

  it('throws on error', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockRejectedValue({ message: 'fail', isAxiosError: true, response: undefined, config: {} });
    await expect(markInsightActionTaken('insight123')).rejects.toThrow();
  });
});

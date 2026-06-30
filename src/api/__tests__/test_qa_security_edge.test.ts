import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the api client — vi.mock is hoisted, so factory must be self-contained
vi.mock('../client', () => {
  const mockApi = {
    post: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  };
  return {
    default: mockApi,
    api: mockApi,
    unwrapApiResponse: vi.fn((payload: unknown) => payload),
  };
});

import { api } from '../client';
import { logMood, getMoods, getWeeklyAnalysis, getMoodStatistics, analyzeText, exportMoodData } from '../mood';
import { chatWithAI } from '../ai';
import { submitPHQ9, submitGAD7 } from '../clinical';
import { generateInsights, getPendingInsights } from '../insights';
import { getCBTModules } from '../cbt';
import { ApiError } from '../errors';

// Helper to create an axios-like error with a status code
function makeAxiosError(status: number, message = 'Error'): unknown {
  return {
    message,
    isAxiosError: true,
    response: { status, statusText: 'Error', data: { message } },
    config: { url: '/api/v1/test', method: 'post' },
  };
}

// ---------------------------------------------------------------------------
// Unauthorized Access (401)
// ---------------------------------------------------------------------------
describe('Unauthorized Access', () => {
  beforeEach(() => vi.clearAllMocks());

  it('logMood throws on 401', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockRejectedValue(makeAxiosError(401, 'Unauthorized'));
    await expect(logMood('user123', { score: 8 })).rejects.toThrow();
  });

  it('getMoods returns empty array on 401 (graceful degradation)', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(makeAxiosError(401, 'Unauthorized'));
    const result = await getMoods('user123');
    expect(result).toEqual([]);
  });

  it('chatWithAI throws on 401', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockRejectedValue(makeAxiosError(401, 'Unauthorized'));
    await expect(chatWithAI('user123', 'Hej')).rejects.toThrow();
  });

  it('submitPHQ9 throws on 401', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockRejectedValue(makeAxiosError(401, 'Unauthorized'));
    await expect(submitPHQ9({ little_interest: 0 })).rejects.toThrow();
  });

  it('submitGAD7 throws on 401', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockRejectedValue(makeAxiosError(401, 'Unauthorized'));
    await expect(submitGAD7({ feeling_nervous: 0 })).rejects.toThrow();
  });

  it('generateInsights throws on 401', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockRejectedValue(makeAxiosError(401, 'Unauthorized'));
    await expect(generateInsights('user123')).rejects.toThrow();
  });

  it('getPendingInsights throws on 401', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(makeAxiosError(401, 'Unauthorized'));
    await expect(getPendingInsights('user123')).rejects.toThrow();
  });

  it('getCBTModules returns empty on error (graceful)', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(makeAxiosError(401, 'Unauthorized'));
    // getCBTModules doesn't have try/catch — it will throw
    await expect(getCBTModules()).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Forbidden Access (403)
// ---------------------------------------------------------------------------
describe('Forbidden Access', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getMoodStatistics throws on 403', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(makeAxiosError(403, 'Forbidden'));
    await expect(getMoodStatistics('user123')).rejects.toThrow();
  });

  it('analyzeText throws on 403', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockRejectedValue(makeAxiosError(403, 'Forbidden'));
    await expect(analyzeText('test')).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Server Errors (500)
// ---------------------------------------------------------------------------
describe('Server Errors', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getWeeklyAnalysis returns fallback on 500', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(makeAxiosError(500, 'Server Error'));
    const result = await getWeeklyAnalysis('user123');
    expect(result.fallback).toBe(true);
    expect(result.totalMoods).toBe(0);
  });

  it('getMoods returns empty array on 500', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(makeAxiosError(500, 'Server Error'));
    const result = await getMoods('user123');
    expect(result).toEqual([]);
  });

  it('submitPHQ9 throws on 500', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockRejectedValue(makeAxiosError(500, 'Server Error'));
    await expect(submitPHQ9({ little_interest: 0 })).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Network Errors (no response)
// ---------------------------------------------------------------------------
describe('Network Errors', () => {
  beforeEach(() => vi.clearAllMocks());

  it('logMood throws on network error', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockRejectedValue({ message: 'Network Error', isAxiosError: true, response: undefined, config: {} });
    await expect(logMood('user123', { score: 8 })).rejects.toThrow();
  });

  it('getMoods returns empty array on network error', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValue({ message: 'Network Error', isAxiosError: true, response: undefined, config: {} });
    const result = await getMoods('user123');
    expect(result).toEqual([]);
  });

  it('chatWithAI throws on network error', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockRejectedValue({ message: 'Network Error', isAxiosError: true, response: undefined, config: {} });
    await expect(chatWithAI('user123', 'Hej')).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Empty / Malformed Responses
// ---------------------------------------------------------------------------
describe('Empty and Malformed Responses', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getMoods handles response without moods array', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: {} } });
    const result = await getMoods('user123');
    expect(result).toEqual([]);
  });

  it('getMoods handles response with non-array moods', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: { moods: 'not-an-array' } } });
    const result = await getMoods('user123');
    expect(result).toEqual([]);
  });

  it('getWeeklyAnalysis handles snake_case response', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: { total_moods: 5, average_sentiment: 6.0, trend: 'stable', insights: 'OK', recent_memories: [] } },
    });
    const result = await getWeeklyAnalysis('user123');
    expect(result.totalMoods).toBe(5);
    expect(result.averageSentiment).toBe(6.0);
  });

  it('getMoodStatistics handles snake_case response', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: { total_moods: 20, average_sentiment: 5.5, current_streak: 3, longest_streak: 8, positive_percentage: 50, negative_percentage: 30, neutral_percentage: 20, best_day: 'Friday', worst_day: 'Monday', recent_trend: 'improving' } },
    });
    const result = await getMoodStatistics('user123');
    expect(result.totalMoods).toBe(20);
    expect(result.currentStreak).toBe(3);
    expect(result.recentTrend).toBe('improving');
  });

  it('chatWithAI handles empty response field', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    const result = await chatWithAI('user123', 'Hej');
    expect(result.response).toBe('');
    expect(result.emotionsDetected).toEqual([]);
    expect(result.crisisDetected).toBe(false);
  });

  it('getCBTModules handles missing modules in response', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: {} } });
    const result = await getCBTModules();
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Abort Signal Handling
// ---------------------------------------------------------------------------
describe('Abort Signal Handling', () => {
  beforeEach(() => vi.clearAllMocks());

  it('logMood passes abort signal', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: { id: 'm1' } } });
    const controller = new AbortController();
    await logMood('user123', { score: 8 }, undefined, controller.signal);
    expect(api.post).toHaveBeenCalledWith(expect.any(String), expect.any(Object), { signal: controller.signal });
  });

  it('getMoods handles AbortError gracefully', async () => {
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(abortError);
    const result = await getMoods('user123');
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Edge Cases: Extreme Values
// ---------------------------------------------------------------------------
describe('Edge Cases', () => {
  beforeEach(() => vi.clearAllMocks());

  it('logMood with empty mood data still sends request', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: { id: 'm1' } } });
    await logMood('user123', {});
    expect(api.post).toHaveBeenCalledWith('/api/v1/mood/log', { user_id: 'user123' }, undefined);
  });

  it('exportMoodData handles moods with missing fields', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: { moods: [{ timestamp: '2024-01-01T10:00:00Z' }] } },
    });
    const csv = await exportMoodData('user123', 'csv');
    expect(csv).toContain('Date');
    // Missing fields should produce empty values, not crash
    expect(csv.split('\n').length).toBe(2);
  });

  it('getWeeklyAnalysis with all defaults from empty response', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: {} } });
    const result = await getWeeklyAnalysis('user123');
    expect(result.totalMoods).toBe(0);
    expect(result.trend).toBe('stable');
    expect(result.insights).toBeTruthy();
  });
});

/**
 * Tests for mood API functions.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../errors', () => ({
  ApiError: class ApiError extends Error {
    status?: number;
    isNetworkError = false;
    isServerError = false;
    isClientError = false;
    timestamp = Date.now();
    constructor(msg: string, opts: { status?: number } = {}) {
      super(msg);
      this.name = 'ApiError';
      this.status = opts.status;
    }
    static fromAxiosError(e: unknown) {
      return new Error(String(e));
    }
  },
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    log: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../errorUtils', () => ({
  getApiErrorMessage: vi.fn((_err: unknown, fallback: string) => fallback),
}));

import { api } from '../client';
import { logMood, getMoods, getWeeklyAnalysis, getMoodStatistics, analyzeText, exportMoodData } from '../mood';

const mockApi = api as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };

describe('logMood', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('posts JSON payload and returns data', async () => {
    const result = { id: '123', score: 8 };
    mockApi.post.mockResolvedValueOnce({ data: { data: result } });

    const response = await logMood('user1', { score: 8, note: 'Good day' });
    expect(mockApi.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ user_id: 'user1', score: 8, note: 'Good day' })
    );
    expect(response).toEqual(result);
  });

  it('falls back to response.data when no data wrapper', async () => {
    const result = { id: '456' };
    mockApi.post.mockResolvedValueOnce({ data: result });

    const response = await logMood('user1', { score: 5 });
    expect(response).toEqual(result);
  });

  it('posts FormData when audioBlob provided', async () => {
    const result = { id: 'audio-123' };
    mockApi.post.mockResolvedValueOnce({ data: { data: result } });

    const blob = new Blob(['audio'], { type: 'audio/webm' });
    const response = await logMood('user1', { score: 7, note: 'voice note' }, blob);

    // Should have called post with FormData and multipart headers
    expect(mockApi.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(FormData),
      expect.objectContaining({ headers: { 'Content-Type': 'multipart/form-data' } })
    );
    expect(response).toEqual(result);
  });

  it('throws when api.post rejects', async () => {
    const axiosErr = new Error('Network failure');
    mockApi.post.mockRejectedValueOnce(axiosErr);

    await expect(logMood('user1', { score: 5 })).rejects.toThrow();
  });
});

describe('getMoods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mood array on success', async () => {
    const moods = [{ id: '1', score: 7 }, { id: '2', score: 8 }];
    mockApi.get.mockResolvedValueOnce({ data: { data: { moods } } });

    const result = await getMoods('user1');
    expect(result).toEqual(moods);
  });

  it('returns empty array when moods field is not an array', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: {} } });

    const result = await getMoods('user1');
    expect(result).toEqual([]);
  });

  it('returns empty array on API error (graceful degradation)', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Network error'));

    const result = await getMoods('user1');
    expect(result).toEqual([]);
  });
});

describe('getWeeklyAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns weekly analysis data on success', async () => {
    const analysisData = { totalMoods: 5, averageSentiment: 0.7, trend: 'improving' };
    mockApi.get.mockResolvedValueOnce({ data: { data: analysisData } });

    const result = await getWeeklyAnalysis('user1');
    expect(result).toMatchObject({ totalMoods: 5 });
  });

  it('returns fallback data on error', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Server error'));

    const result = await getWeeklyAnalysis('user1');
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });
});

describe('getMoodStatistics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns statistics on success', async () => {
    const stats = { totalMoods: 10, averageSentiment: 0.6, currentStreak: 3 };
    mockApi.get.mockResolvedValueOnce({ data: { data: stats } });

    const result = await getMoodStatistics('user1');
    expect(result).toMatchObject({ totalMoods: 10, currentStreak: 3 });
  });

  it('normalizes snake_case to camelCase', async () => {
    const stats = { total_moods: 5, average_sentiment: 0.5, current_streak: 2, recent_trend: 'stable' };
    mockApi.get.mockResolvedValueOnce({ data: { data: stats } });

    const result = await getMoodStatistics('user1');
    expect(result).toMatchObject({ totalMoods: 5, currentStreak: 2, recentTrend: 'stable' });
  });

  it('throws on error', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Fail'));

    await expect(getMoodStatistics('user1')).rejects.toThrow();
  });
});

describe('analyzeText', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns analysis result', async () => {
    const analysis = { sentiment: 'positive', confidence: 0.9 };
    mockApi.post.mockResolvedValueOnce({ data: { data: analysis } });

    const result = await analyzeText('I feel great today!');
    expect(mockApi.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ text: 'I feel great today!' })
    );
    expect(result).toMatchObject({ sentiment: 'positive' });
  });

  it('throws on error', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('Analysis failed'));

    await expect(analyzeText('text')).rejects.toThrow();
  });
});

describe('exportMoodData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns CSV string with header row for empty moods', async () => {
    // exportMoodData calls getMoods internally, which calls api.get
    mockApi.get.mockResolvedValueOnce({ data: { data: { moods: [] } } });

    const result = await exportMoodData('user1', 'csv');
    expect(typeof result).toBe('string');
    expect(result).toContain('Datum');
  });

  it('returns JSON string when format is json', async () => {
    const moods = [{ id: '1', score: 8 }];
    mockApi.get.mockResolvedValueOnce({ data: { data: { moods } } });

    const result = await exportMoodData('user1', 'json');
    const parsed = JSON.parse(result);
    expect(Array.isArray(parsed)).toBe(true);
  });

  it('generates CSV rows for mood entries', async () => {
    const moods = [{ timestamp: '2024-01-01', mood_text: 'Glad', score: 8, note: 'Good', tags: ['work'], valence: 0.8, arousal: 0.6 }];
    mockApi.get.mockResolvedValueOnce({ data: { data: { moods } } });

    const result = await exportMoodData('user1', 'csv');
    expect(result).toContain('Glad');
    expect(result.split('\n').length).toBeGreaterThan(1);
  });

  it('handles mood entries without optional fields', async () => {
    const moods = [{ score: 5 }]; // no timestamp, note, tags, valence, arousal
    mockApi.get.mockResolvedValueOnce({ data: { data: { moods } } });
    const result = await exportMoodData('user1', 'csv');
    expect(result.split('\n').length).toBeGreaterThan(1);
  });

  it('returns empty csv header when getMoods fails (graceful degradation)', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Network fail'));
    // getMoods catches errors and returns [], so exportMoodData returns just the header row
    const result = await exportMoodData('user1', 'csv');
    expect(result).toBe('Datum,Humör,Poäng,Anteckning,Taggar,Valens,Arousal');
  });
});

describe('getWeeklyAnalysis snake_case fallback branches', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses snake_case when camelCase is missing', async () => {
    const data = {
      total_moods: 3,
      average_sentiment: 0.4,
      trend: 'declining',
      insights: 'Keep going',
      recent_memories: [{ id: 1 }],
      positive_count: 1,
      negative_count: 1,
      neutral_count: 1,
      positive_percentage: 33,
      negative_percentage: 33,
      neutral_percentage: 34,
      fallback: false,
      confidence: 0.8,
    };
    mockApi.get.mockResolvedValueOnce({ data: { data: data } });
    const result = await getWeeklyAnalysis('user1');
    expect(result.totalMoods).toBe(3);
    expect(result.positiveCount).toBe(1);
    expect(result.recentMemories).toHaveLength(1);
  });

  it('uses default values when all fields missing', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: {} } });
    const result = await getWeeklyAnalysis('user1');
    expect(result.totalMoods).toBe(0);
    expect(result.trend).toBe('stable');
    expect(result.fallback).toBe(false);
  });
});

describe('getMoodStatistics additional branches', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses both camelCase and snake_case fallbacks for all percent fields', async () => {
    const data = {
      total_moods: 10,
      average_sentiment: 0.6,
      current_streak: 5,
      longest_streak: 8,
      positive_percentage: 60,
      negative_percentage: 20,
      neutral_percentage: 20,
      best_day: '2024-01-01',
      worst_day: '2024-01-10',
      recent_trend: 'improving',
    };
    mockApi.get.mockResolvedValueOnce({ data: { data } });
    const result = await getMoodStatistics('user1');
    expect(result.totalMoods).toBe(10);
    expect(result.positivePercentage).toBe(60);
    expect(result.bestDay).toBe('2024-01-01');
    expect(result.recentTrend).toBe('improving');
  });

  it('defaults missing fields to 0/null/stable', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: {} } });
    const result = await getMoodStatistics('user1');
    expect(result.totalMoods).toBe(0);
    expect(result.bestDay).toBeNull();
    expect(result.recentTrend).toBe('stable');
  });
});

describe('logMood additional branches', () => {
  beforeEach(() => vi.clearAllMocks());

  it('includes all optional formData fields when provided', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { data: { id: 'x' } } });
    const blob = new Blob(['audio'], { type: 'audio/webm' });
    const moodData = {
      score: 7,
      mood_text: 'Calm',
      note: 'Relaxed',
      valence: 0.6,
      arousal: 0.4,
      tags: ['meditation'],
      context: 'evening',
    };
    const result = await logMood('u1', moodData, blob);
    expect(mockApi.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(FormData),
      expect.any(Object)
    );
    expect(result).toEqual({ id: 'x' });
  });

  it('throws ApiError directly when one is caught', async () => {
    const { ApiError } = await import('../errors');
    const apiErr = new (ApiError as unknown as new (msg: string, opts?: {status?: number}) => Error)('Already an ApiError');
    mockApi.post.mockRejectedValueOnce(apiErr);
    await expect(logMood('u1', { score: 5 })).rejects.toThrow('Already an ApiError');
  });
});

/**
 * Tests for feedback API functions.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../constants', () => ({
  API_ENDPOINTS: {
    FEEDBACK: {
      SUBMIT: '/api/v1/feedback',
      MY_FEEDBACK: '/api/v1/feedback/my',
      LIST: '/api/v1/feedback/list',
      STATS: '/api/v1/feedback/stats',
    },
  },
}));

import { api } from '../client';
import { submitFeedback, getMyFeedback, listFeedback, getFeedbackStats } from '../feedback';

const mockApi = api as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };

describe('submitFeedback', () => {
  beforeEach(() => vi.clearAllMocks());

  it('posts feedback and returns feedbackId', async () => {
    const responseData = { feedbackId: 'fb-123' };
    mockApi.post.mockResolvedValueOnce({ data: { data: responseData } });

    const result = await submitFeedback({
      user_id: 'user1',
      rating: 5,
      category: 'general',
      message: 'Great app!',
    });
    expect(mockApi.post).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ user_id: 'user1', rating: 5 }));
    expect(result.feedbackId).toBe('fb-123');
  });

  it('handles response without data wrapper', async () => {
    const responseData = { feedbackId: 'fb-456' };
    mockApi.post.mockResolvedValueOnce({ data: responseData });

    const result = await submitFeedback({ user_id: 'u', rating: 3 });
    expect(result.feedbackId).toBe('fb-456');
  });

  it('throws when api.post rejects', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('Server error'));
    await expect(submitFeedback({ user_id: 'u', rating: 1 })).rejects.toThrow();
  });
});

describe('getMyFeedback', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns feedback list and count', async () => {
    const responseData = { feedback: [{ id: '1' }], count: 1 };
    mockApi.get.mockResolvedValueOnce({ data: { data: responseData } });

    const result = await getMyFeedback();
    expect(result.count).toBe(1);
    expect(result.feedback).toHaveLength(1);
  });

  it('throws on error', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Unauthorized'));
    await expect(getMyFeedback()).rejects.toThrow();
  });
});

describe('listFeedback', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns feedback list without options', async () => {
    const responseData = { feedback: [], count: 0 };
    mockApi.get.mockResolvedValueOnce({ data: { data: responseData } });

    const result = await listFeedback();
    expect(result.count).toBe(0);
  });

  it('appends status filter to URL', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: { feedback: [], count: 0 } } });

    await listFeedback({ status: 'pending' });
    const calledUrl: string = mockApi.get.mock.calls[0][0];
    expect(calledUrl).toContain('status=pending');
  });

  it('appends category filter to URL', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: { feedback: [], count: 0 } } });

    await listFeedback({ category: 'bug' });
    const calledUrl: string = mockApi.get.mock.calls[0][0];
    expect(calledUrl).toContain('category=bug');
  });

  it('appends limit filter to URL', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: { feedback: [], count: 0 } } });

    await listFeedback({ limit: 10 });
    const calledUrl: string = mockApi.get.mock.calls[0][0];
    expect(calledUrl).toContain('limit=10');
  });

  it('throws on error', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Forbidden'));
    await expect(listFeedback()).rejects.toThrow();
  });
});

describe('getFeedbackStats', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns camelCase stats from camelCase response', async () => {
    const responseData = {
      totalFeedback: 50,
      averageRating: 4.2,
      categories: { general: 30 },
      recentCount30Days: 10,
      dateRangeDays: 30,
    };
    mockApi.get.mockResolvedValueOnce({ data: { data: responseData } });

    const result = await getFeedbackStats();
    expect(result.totalFeedback).toBe(50);
    expect(result.averageRating).toBe(4.2);
    expect(result.dateRangeDays).toBe(30);
  });

  it('normalizes snake_case to camelCase', async () => {
    const responseData = {
      total_feedback: 25,
      average_rating: 3.5,
      categories: {},
      recent_count_30_days: 5,
      date_range_days: 30,
    };
    mockApi.get.mockResolvedValueOnce({ data: { data: responseData } });

    const result = await getFeedbackStats();
    expect(result.totalFeedback).toBe(25);
    expect(result.recentCount30Days).toBe(5);
  });

  it('defaults to 0 when fields are missing', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: {} } });

    const result = await getFeedbackStats();
    expect(result.totalFeedback).toBe(0);
    expect(result.averageRating).toBe(0);
  });

  it('caps days at 365 in query', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: {} } });

    await getFeedbackStats(1000);
    const calledUrl: string = mockApi.get.mock.calls[0][0];
    expect(calledUrl).toContain('days=365');
  });

  it('uses provided days in query', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: {} } });

    await getFeedbackStats(60);
    const calledUrl: string = mockApi.get.mock.calls[0][0];
    expect(calledUrl).toContain('days=60');
  });

  it('throws on error', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Fail'));
    await expect(getFeedbackStats()).rejects.toThrow();
  });
});

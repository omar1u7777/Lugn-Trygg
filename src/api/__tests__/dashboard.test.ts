/**
 * Tests for dashboard API functions.
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
    DASHBOARD: {
      CSRF_TOKEN: '/api/v1/dashboard/csrf-token',
      DASHBOARD_SUMMARY: '/api/v1/dashboard',
      DASHBOARD_QUICK_STATS: '/api/v1/dashboard',
    },
    USERS: {
      WELLNESS_GOALS: '/api/v1/users',
    },
  },
}));

vi.mock('../utils/logger', () => ({
  logger: {
    log: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { api } from '../client';
import { getCSRFToken, getDashboardSummary, getDashboardQuickStats, getWellnessGoals, setWellnessGoals } from '../dashboard';

const mockApi = api as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };

describe('getCSRFToken', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns camelCase csrfToken', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: { csrfToken: 'tok-abc' } } });

    const token = await getCSRFToken();
    expect(token).toBe('tok-abc');
  });

  it('returns snake_case csrf_token as fallback', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: { csrf_token: 'tok-xyz' } } });

    const token = await getCSRFToken();
    expect(token).toBe('tok-xyz');
  });

  it('returns empty string on error (graceful)', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Network error'));

    const token = await getCSRFToken();
    expect(token).toBe('');
  });
});

describe('getDashboardSummary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls correct URL with userId', async () => {
    const data = { totalMoods: 5, totalChats: 3 };
    mockApi.get.mockResolvedValueOnce({ data: { data } });

    const result = await getDashboardSummary('user1');
    const calledUrl: string = mockApi.get.mock.calls[0][0];
    expect(calledUrl).toContain('user1');
    expect(calledUrl).toContain('summary');
    expect(result).toMatchObject({ totalMoods: 5 });
  });

  it('passes forceRefresh param when true', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: {} } });

    await getDashboardSummary('user1', true);
    const calledParams = mockApi.get.mock.calls[0][1];
    expect(calledParams).toMatchObject({ params: { forceRefresh: 'true' } });
  });

  it('does not pass forceRefresh param when false', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: {} } });

    await getDashboardSummary('user1', false);
    const calledParams = mockApi.get.mock.calls[0][1];
    expect(calledParams.params).toEqual({});
  });

  it('throws on error', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Server error'));
    await expect(getDashboardSummary('user1')).rejects.toThrow();
  });
});

describe('getDashboardQuickStats', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls correct URL with userId', async () => {
    const data = { totalMoods: 2, totalChats: 1, cached: true };
    mockApi.get.mockResolvedValueOnce({ data: { data } });

    const result = await getDashboardQuickStats('user1');
    const calledUrl: string = mockApi.get.mock.calls[0][0];
    expect(calledUrl).toContain('user1');
    expect(calledUrl).toContain('quick-stats');
    expect(result.totalMoods).toBe(2);
  });

  it('returns fallback on error (graceful degradation)', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Timeout'));

    const result = await getDashboardQuickStats('user1');
    expect(result).toEqual({ totalMoods: 0, totalChats: 0, cached: false });
  });
});

describe('getWellnessGoals', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns wellness goals array', async () => {
    const goals = ['meditation', 'exercise'];
    mockApi.get.mockResolvedValueOnce({ data: { data: { wellnessGoals: goals } } });

    const result = await getWellnessGoals();
    expect(result).toEqual(goals);
  });

  it('returns empty array when wellnessGoals missing', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: {} } });

    const result = await getWellnessGoals();
    expect(result).toEqual([]);
  });

  it('returns empty array on error (graceful)', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Fail'));

    const result = await getWellnessGoals();
    expect(result).toEqual([]);
  });
});

describe('setWellnessGoals', () => {
  beforeEach(() => vi.clearAllMocks());

  it('posts goals and returns saved goals', async () => {
    const goals = ['sleep', 'water'];
    mockApi.post.mockResolvedValueOnce({ data: { data: { wellnessGoals: goals } } });

    const result = await setWellnessGoals(goals);
    expect(mockApi.post).toHaveBeenCalledWith(
      expect.any(String),
      { wellnessGoals: goals }
    );
    expect(result).toEqual(goals);
  });

  it('throws when goals is empty array', async () => {
    await expect(setWellnessGoals([])).rejects.toThrow('wellnessGoals must be a non-empty list');
  });

  it('throws when api.post fails', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('Save failed'));
    await expect(setWellnessGoals(['goal'])).rejects.toThrow();
  });
});

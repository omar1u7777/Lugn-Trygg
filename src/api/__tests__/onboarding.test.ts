/**
 * Tests for onboarding API functions.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

vi.mock('../constants', () => ({
  API_ENDPOINTS: {
    ONBOARDING: {
      GOALS: '/api/v1/onboarding/goals',
      STATUS: '/api/v1/onboarding/status',
      SKIP: '/api/v1/onboarding/skip',
    },
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

import { api } from '../client';
import {
  saveOnboardingGoals,
  getOnboardingGoals,
  updateOnboardingGoals,
  getOnboardingStatus,
  skipOnboarding,
} from '../onboarding';

const mockApi = api as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
};

describe('saveOnboardingGoals', () => {
  beforeEach(() => vi.clearAllMocks());

  it('posts goals to correct URL and returns data', async () => {
    const responseData = { goals: ['meditation', 'sleep'], onboardingCompleted: false };
    mockApi.post.mockResolvedValueOnce({ data: { data: responseData } });

    const result = await saveOnboardingGoals('user1', ['meditation', 'sleep']);
    const calledUrl: string = mockApi.post.mock.calls[0][0];
    expect(calledUrl).toContain('user1');
    expect(mockApi.post).toHaveBeenCalledWith(expect.any(String), { goals: ['meditation', 'sleep'] });
    expect(result.goals).toEqual(['meditation', 'sleep']);
  });

  it('handles response without data wrapper', async () => {
    const responseData = { goals: ['exercise'], onboardingCompleted: true };
    mockApi.post.mockResolvedValueOnce({ data: responseData });

    const result = await saveOnboardingGoals('user1', ['exercise']);
    expect(result.onboardingCompleted).toBe(true);
  });

  it('throws on error', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('Unauthorized'));
    await expect(saveOnboardingGoals('user1', ['goal'])).rejects.toThrow();
  });
});

describe('getOnboardingGoals', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns goals array on success', async () => {
    const goals = ['sleep', 'meditation'];
    mockApi.get.mockResolvedValueOnce({ data: { data: { goals } } });

    const result = await getOnboardingGoals('user1');
    const calledUrl: string = mockApi.get.mock.calls[0][0];
    expect(calledUrl).toContain('user1');
    expect(result).toEqual(goals);
  });

  it('returns empty array when goals field is missing', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: {} } });

    const result = await getOnboardingGoals('user1');
    expect(result).toEqual([]);
  });

  it('throws on error', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Not found'));
    await expect(getOnboardingGoals('user1')).rejects.toThrow();
  });
});

describe('updateOnboardingGoals', () => {
  beforeEach(() => vi.clearAllMocks());

  it('puts updated goals to correct URL', async () => {
    const responseData = { goals: ['water', 'sleep'], onboardingCompleted: false };
    mockApi.put.mockResolvedValueOnce({ data: { data: responseData } });

    const result = await updateOnboardingGoals('user1', ['water', 'sleep']);
    const calledUrl: string = mockApi.put.mock.calls[0][0];
    expect(calledUrl).toContain('user1');
    expect(mockApi.put).toHaveBeenCalledWith(expect.any(String), { goals: ['water', 'sleep'] });
    expect(result.goals).toEqual(['water', 'sleep']);
  });

  it('throws on error', async () => {
    mockApi.put.mockRejectedValueOnce(new Error('Conflict'));
    await expect(updateOnboardingGoals('user1', ['goal'])).rejects.toThrow();
  });
});

describe('getOnboardingStatus', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns onboarding status', async () => {
    const status = {
      onboardingCompleted: true,
      onboardingCompletedAt: '2024-01-01T00:00:00Z',
      wellnessGoals: ['sleep'],
      goalsCount: 1,
    };
    mockApi.get.mockResolvedValueOnce({ data: { data: status } });

    const result = await getOnboardingStatus('user1');
    const calledUrl: string = mockApi.get.mock.calls[0][0];
    expect(calledUrl).toContain('user1');
    expect(result.onboardingCompleted).toBe(true);
    expect(result.goalsCount).toBe(1);
  });

  it('throws on error', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Error'));
    await expect(getOnboardingStatus('user1')).rejects.toThrow();
  });
});

describe('skipOnboarding', () => {
  beforeEach(() => vi.clearAllMocks());

  it('posts skip request and returns result', async () => {
    const responseData = { onboardingCompleted: true, skipped: true };
    mockApi.post.mockResolvedValueOnce({ data: { data: responseData } });

    const result = await skipOnboarding('user1');
    const calledUrl: string = mockApi.post.mock.calls[0][0];
    expect(calledUrl).toContain('user1');
    expect(result.skipped).toBe(true);
    expect(result.onboardingCompleted).toBe(true);
  });

  it('throws on error', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('Fail'));
    await expect(skipOnboarding('user1')).rejects.toThrow();
  });
});

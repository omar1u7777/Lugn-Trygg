/**
 * Tests for challenges API functions.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../errors', () => ({
  ApiError: class ApiError extends Error {
    constructor(message: string, public status?: number) {
      super(message);
      this.name = 'ApiError';
    }
    static fromAxiosError(error: unknown) {
      return new ApiError((error as Error).message || 'API error');
    }
  },
}));

vi.mock('../constants', () => ({
  API_ENDPOINTS: {
    CHALLENGES: {
      CHALLENGES: '/api/v1/challenges',
      CHALLENGE_BY_ID: '/api/v1/challenges',
      CHALLENGE_JOIN: '/api/v1/challenges',
      CHALLENGE_LEAVE: '/api/v1/challenges',
      CHALLENGE_CONTRIBUTE: '/api/v1/challenges',
      USER_CHALLENGES: '/api/v1/users',
    },
  },
}));

import { api } from '../client';
import {
  getChallenges,
  getChallenge,
  joinChallenge,
  leaveChallenge,
  contributeToChallenge,
  getUserChallenges,
} from '../challenges';

const mockApi = api as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };

const backendChallenge = {
  id: 'c1',
  title: '7-Day Mood Track',
  description: 'Track your mood for 7 days',
  goal: 7,
  currentProgress: 3,
  teamSize: 5,
  maxTeamSize: 10,
  startDate: '2024-01-01T00:00:00Z',
  endDate: '2024-01-08T00:00:00Z',
  rewardXp: 100,
  rewardBadge: 'mood-master',
  category: 'mood' as const,
  difficulty: 'easy' as const,
  members: [{ userId: 'u1', username: 'Alice', contribution: 3, joinedAt: '2024-01-01' }],
  createdAt: '2024-01-01T00:00:00Z',
  active: true,
};

describe('getChallenges', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns transformed challenges from nested format', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: { challenges: [backendChallenge] } } });

    const result = await getChallenges();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c1');
  });

  it('returns transformed challenges from direct format', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { challenges: [backendChallenge] } });

    const result = await getChallenges();
    expect(result).toHaveLength(1);
  });

  it('transforms backend fields to snake_case aliases', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: { challenges: [backendChallenge] } } });

    const result = await getChallenges();
    const ch = result[0];
    // Check snake_case aliases
    expect(ch.target_value).toBe(ch.goal);
    expect(ch.current_progress).toBe(ch.currentProgress);
    expect(ch.team_size).toBe(ch.teamSize);
    expect(ch.reward_xp).toBe(ch.rewardXp);
    expect(ch.type).toBe(ch.category);
  });

  it('returns empty array when challenges missing', async () => {
    mockApi.get.mockResolvedValueOnce({ data: {} });

    const result = await getChallenges();
    expect(result).toEqual([]);
  });

  it('computes duration_days from dates', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: { challenges: [backendChallenge] } } });

    const result = await getChallenges();
    expect(result[0].duration_days).toBe(7);
  });

  it('throws on API error', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Error'));

    await expect(getChallenges()).rejects.toThrow();
  });
});

describe('getChallenge', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns single transformed challenge', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: { challenge: backendChallenge } } });

    const result = await getChallenge('c1');
    expect(result.id).toBe('c1');
  });

  it('includes challengeId in URL', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: { challenge: backendChallenge } } });

    await getChallenge('abc-123');
    expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining('abc-123'));
  });

  it('throws when challenge payload missing', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: {} } });

    await expect(getChallenge('c1')).rejects.toThrow();
  });

  it('throws on API error', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Not found'));

    await expect(getChallenge('c1')).rejects.toThrow();
  });
});

describe('joinChallenge', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns join response', async () => {
    const joinResponse = { success: true, message: 'Joined successfully' };
    mockApi.post.mockResolvedValueOnce({ data: joinResponse });

    const result = await joinChallenge('c1');
    expect(result.success).toBe(true);
  });

  it('includes challengeId in URL and posts username when provided', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { success: true, message: 'ok' } });

    await joinChallenge('c1', 'Alice');
    expect(mockApi.post).toHaveBeenCalledWith(
      expect.stringContaining('c1'),
      expect.objectContaining({ username: 'Alice' })
    );
  });

  it('throws on API error', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('Already joined'));

    await expect(joinChallenge('c1')).rejects.toThrow();
  });
});

describe('leaveChallenge', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns leave response', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { success: true, message: 'Left successfully' } });

    const result = await leaveChallenge('c1');
    expect(result.success).toBe(true);
  });

  it('includes challengeId in URL', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { success: true, message: 'ok' } });

    await leaveChallenge('c1');
    expect(mockApi.post).toHaveBeenCalledWith(expect.stringContaining('c1'));
  });

  it('throws on API error', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('Error'));

    await expect(leaveChallenge('c1')).rejects.toThrow();
  });
});

describe('contributeToChallenge', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns contribution response', async () => {
    const contributeResponse = { success: true, message: 'Contributed', data: { newProgress: 4, goal: 7, message: 'ok' } };
    mockApi.post.mockResolvedValueOnce({ data: contributeResponse });

    const result = await contributeToChallenge('c1', 'mood');
    expect(result.success).toBe(true);
  });

  it('posts type and default amount=1', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { success: true, message: 'ok' } });

    await contributeToChallenge('c1', 'meditation');
    expect(mockApi.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ type: 'meditation', amount: 1 })
    );
  });

  it('posts custom amount', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { success: true, message: 'ok' } });

    await contributeToChallenge('c1', 'journal', 5);
    expect(mockApi.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ amount: 5 })
    );
  });

  it('throws on API error', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('Error'));

    await expect(contributeToChallenge('c1', 'mood')).rejects.toThrow();
  });
});

describe('getUserChallenges', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns user challenges with empty progress', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: { challenges: [backendChallenge] } } });

    const result = await getUserChallenges('u1');
    expect(result.challenges).toHaveLength(1);
    expect(result.progress).toEqual({});
  });

  it('includes userId in URL', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: { challenges: [] } } });

    await getUserChallenges('user-xyz');
    expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining('user-xyz'));
  });

  it('returns empty challenges for direct format missing data', async () => {
    mockApi.get.mockResolvedValueOnce({ data: {} });

    const result = await getUserChallenges('u1');
    expect(result.challenges).toEqual([]);
  });

  it('throws on API error', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Error'));

    await expect(getUserChallenges('u1')).rejects.toThrow();
  });
});

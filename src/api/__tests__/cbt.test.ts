/**
 * Tests for CBT API functions.
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
    CBT: {
      MODULES: '/api/v1/cbt/modules',
      MODULE_DETAIL: '/api/v1/cbt/modules',
      SESSION: '/api/v1/cbt/session',
      PROGRESS: '/api/v1/cbt/progress',
      INSIGHTS: '/api/v1/cbt/insights',
      EXERCISES: '/api/v1/cbt/exercises',
    },
  },
}));

vi.mock('../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { api } from '../client';
import {
  getCBTModules,
  getCBTModuleDetail,
  getPersonalizedSession,
  updateCBTProgress,
  getCBTInsights,
  getCBTExercises,
} from '../cbt';

const mockApi = api as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };

const sampleModule = {
  moduleId: 'm1',
  title: 'Anxiety Management',
  description: 'Learn to manage anxiety',
  category: 'anxiety' as const,
  difficultyLevel: 'beginner' as const,
  estimatedDuration: 30,
  prerequisites: [],
  learningObjectives: ['Identify triggers'],
  completionCriteria: {},
};

const sampleExercise = {
  exerciseId: 'e1',
  moduleId: 'm1',
  title: 'Thought Record',
  type: 'thought_record' as const,
  difficulty: 'beginner',
  duration: 15,
  instructions: 'Write down your thoughts',
  prompts: ['What triggered this?'],
  successMetrics: ['completed'],
};

describe('getCBTModules', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns modules array on success', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: { modules: [sampleModule] } } });

    const result = await getCBTModules();
    expect(result).toHaveLength(1);
    expect(result[0].moduleId).toBe('m1');
  });

  it('returns empty array when modules missing', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: {} } });

    const result = await getCBTModules();
    expect(result).toEqual([]);
  });

  it('throws on API error', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Server error'));

    await expect(getCBTModules()).rejects.toThrow();
  });
});

describe('getCBTModuleDetail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns module detail with exercises', async () => {
    const moduleWithExercises = { ...sampleModule, exercises: [sampleExercise] };
    mockApi.get.mockResolvedValueOnce({ data: { data: { module: moduleWithExercises } } });

    const result = await getCBTModuleDetail('m1');
    expect(result.moduleId).toBe('m1');
  });

  it('includes moduleId in URL', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: { module: sampleModule } } });

    await getCBTModuleDetail('module-xyz');
    expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining('module-xyz'));
  });

  it('throws when module payload is missing', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: {} } });

    await expect(getCBTModuleDetail('m1')).rejects.toThrow();
  });

  it('throws on API error', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Not found'));

    await expect(getCBTModuleDetail('m1')).rejects.toThrow();
  });
});

describe('getPersonalizedSession', () => {
  beforeEach(() => vi.clearAllMocks());

  const sampleSession = {
    exercises: [sampleExercise],
    sessionTheme: 'Anxiety reduction',
    estimatedDuration: 20,
    difficultyProgression: 'easy to medium',
    motivationalElements: ['You can do this!'],
    guidance: 'Take your time',
  };

  it('returns session data on success', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: { session: sampleSession } } });

    const result = await getPersonalizedSession('calm');
    expect(result.sessionTheme).toBe('Anxiety reduction');
  });

  it('passes mood as param when provided', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: { session: sampleSession } } });

    await getPersonalizedSession('stressed');
    expect(mockApi.get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ params: { mood: 'stressed' } })
    );
  });

  it('passes empty params when mood not provided', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: { session: sampleSession } } });

    await getPersonalizedSession();
    expect(mockApi.get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ params: {} })
    );
  });

  it('throws when session payload is missing', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: {} } });

    await expect(getPersonalizedSession()).rejects.toThrow();
  });
});

describe('updateCBTProgress', () => {
  beforeEach(() => vi.clearAllMocks());

  const progressData = {
    exerciseId: 'e1',
    successRate: 0.8,
    timeSpent: 900,
    difficultyRating: 3,
    notes: 'Felt good',
  };

  it('returns default progress on success', async () => {
    const progressResult = { skillMastery: { 'thought_record': 0.8 }, streakCount: 5, completedModules: ['m1'], achievements: [] };
    mockApi.post.mockResolvedValueOnce({ data: { data: progressResult } });

    const result = await updateCBTProgress(progressData);
    expect(result.streakCount).toBe(5);
  });

  it('returns default progress when endpoint is 404', async () => {
    mockApi.post.mockRejectedValueOnce({ response: { status: 404 } });

    const result = await updateCBTProgress(progressData);
    expect(result).toEqual({
      skillMastery: {},
      streakCount: 0,
      completedModules: [],
      achievements: [],
    });
  });
});

describe('getCBTInsights', () => {
  beforeEach(() => vi.clearAllMocks());

  const sampleInsights = {
    overallProgress: 65,
    strengthAreas: ['mindfulness'],
    improvementAreas: ['sleep'],
    recommendedNextSteps: ['Try module 3'],
    streak: { current: 7, longest: 14, consistencyRating: 'good' },
    exercisesCompleted: 12,
    modulesCompleted: 2,
  };

  it('returns insights data on success', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: { insights: sampleInsights } } });

    const result = await getCBTInsights();
    expect(result.overallProgress).toBe(65);
    expect(result.streak.current).toBe(7);
  });

  it('throws when insights payload is missing', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: {} } });

    await expect(getCBTInsights()).rejects.toThrow();
  });

  it('throws on API error', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Error'));

    await expect(getCBTInsights()).rejects.toThrow();
  });
});

describe('getCBTExercises', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns exercises array on success', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: { exercises: [sampleExercise] } } });

    const result = await getCBTExercises();
    expect(result).toHaveLength(1);
    expect(result[0].exerciseId).toBe('e1');
  });

  it('filters by module when provided', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: { exercises: [] } } });

    await getCBTExercises({ module: 'm1' });
    expect(mockApi.get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ params: { module: 'm1' } })
    );
  });

  it('filters by type when provided', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: { exercises: [] } } });

    await getCBTExercises({ type: 'thought_record' });
    expect(mockApi.get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ params: { type: 'thought_record' } })
    );
  });

  it('returns empty array when exercises missing', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: {} } });

    const result = await getCBTExercises();
    expect(result).toEqual([]);
  });

  it('throws on API error', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Error'));

    await expect(getCBTExercises()).rejects.toThrow();
  });
});

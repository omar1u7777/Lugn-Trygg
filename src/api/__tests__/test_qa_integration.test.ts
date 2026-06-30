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
import { logMood, getMoods, deleteMood, getWeeklyAnalysis, getMoodStatistics, analyzeText, exportMoodData } from '../mood';
import { chatWithAI, getChatHistory } from '../ai';
import { submitPHQ9, submitGAD7, getAssessmentHistory } from '../clinical';
import { generateInsights, getPendingInsights } from '../insights';
import { getCBTModules, getCBTModuleDetail, getPersonalizedSession, getCBTInsights } from '../cbt';

// ---------------------------------------------------------------------------
// Mood API Integration
// ---------------------------------------------------------------------------
describe('Mood API Integration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('logMood posts to /api/v1/mood/log with user_id and mood data', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: { id: 'm1', score: 8 } } });
    const result = await logMood('user123', { score: 8, mood_text: 'Glad' });
    expect(api.post).toHaveBeenCalledWith('/api/v1/mood/log', { user_id: 'user123', score: 8, mood_text: 'Glad' }, undefined);
    expect(result.id).toBe('m1');
  });

  it('logMood with audio sends FormData', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: { id: 'm2' } } });
    const blob = new Blob(['audio'], { type: 'audio/webm' });
    await logMood('user123', { score: 7 }, blob);
    expect(api.post).toHaveBeenCalledWith('/api/v1/mood/log', expect.any(FormData), undefined);
  });

  it('getMoods fetches from /api/v1/mood and returns moods array', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: { moods: [{ id: 'm1', score: 8 }] } } });
    const result = await getMoods('user123');
    expect(api.get).toHaveBeenCalledWith('/api/v1/mood', undefined);
    expect(result).toHaveLength(1);
    expect(result[0].score).toBe(8);
  });

  it('getMoods returns empty array on error (graceful degradation)', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network'));
    const result = await getMoods('user123');
    expect(result).toEqual([]);
  });

  it('deleteMood calls DELETE /api/v1/mood/{moodId}', async () => {
    (api.delete as ReturnType<typeof vi.fn>).mockResolvedValue({});
    await deleteMood('mood123');
    expect(api.delete).toHaveBeenCalledWith('/api/v1/mood/mood123');
  });

  it('getWeeklyAnalysis returns normalized data with fallbacks', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: { totalMoods: 10, averageSentiment: 7.5, trend: 'improving', insights: 'Great!', recentMemories: [], positiveCount: 7, negativeCount: 2, neutralCount: 1 } },
    });
    const result = await getWeeklyAnalysis('user123');
    expect(result.totalMoods).toBe(10);
    expect(result.trend).toBe('improving');
    expect(result.positiveCount).toBe(7);
  });

  it('getWeeklyAnalysis returns fallback on error', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
    const result = await getWeeklyAnalysis('user123');
    expect(result.totalMoods).toBe(0);
    expect(result.fallback).toBe(true);
  });

  it('getMoodStatistics returns normalized stats', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: { totalMoods: 30, averageSentiment: 6.5, currentStreak: 5, longestStreak: 10, positivePercentage: 60, negativePercentage: 20, neutralPercentage: 20, bestDay: 'Monday', worstDay: 'Sunday', recentTrend: 'stable' } },
    });
    const result = await getMoodStatistics('user123');
    expect(result.totalMoods).toBe(30);
    expect(result.currentStreak).toBe(5);
    expect(result.recentTrend).toBe('stable');
  });

  it('analyzeText posts to /api/v1/mood/analyze-text', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: { sentiment: 'positive', score: 0.8 } } });
    const result = await analyzeText('I feel great today');
    expect(api.post).toHaveBeenCalledWith('/api/v1/mood/analyze-text', { text: 'I feel great today' });
    expect(result.sentiment).toBe('positive');
  });

  it('exportMoodData returns CSV string', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: { moods: [{ timestamp: '2024-01-01T10:00:00Z', mood_text: 'Glad', score: 8, note: 'Bra dag', tags: ['work'], valence: 0.8, arousal: 0.6 }] } },
    });
    const csv = await exportMoodData('user123', 'csv');
    expect(csv).toContain('Date');
    expect(csv).toContain('Glad');
    expect(csv).toContain('8');
  });

  it('exportMoodData returns JSON when format=json', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: { moods: [{ id: 'm1', score: 8 }] } },
    });
    const json = await exportMoodData('user123', 'json');
    expect(JSON.parse(json)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// AI Support API Integration
// ---------------------------------------------------------------------------
describe('AI Support API Integration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('chatWithAI posts to /api/v1/chatbot/chat', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: { response: 'Hej!', emotionsDetected: ['happy'], crisisDetected: false } },
    });
    const result = await chatWithAI('user123', 'Hej');
    expect(result.response).toBe('Hej!');
    expect(result.emotionsDetected).toEqual(['happy']);
  });

  it('getChatHistory fetches from /api/v1/chatbot/history', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: { conversation: [{ role: 'user', content: 'Hej', timestamp: '2024-01-01' }] } },
    });
    const result = await getChatHistory();
    expect(result.conversation).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Clinical Assessment API Integration
// ---------------------------------------------------------------------------
describe('Clinical Assessment API Integration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('submitPHQ9 posts to /api/v1/advanced-mood/assess/phq9', async () => {
    const responses = { little_interest: 1, feeling_down: 1, sleep_problems: 1, feeling_tired: 1, appetite: 1, feeling_bad: 1, concentration: 1, moving_slowly: 1, self_harm: 0 };
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { success: true, data: { total_score: 8, severity: 'mild', risk_level: 'low', suicidal_ideation: false, self_harm_score: 0, item_scores: responses, interpretation: 'Mild', recommendations: [], follow_up_timeframe: 'routine' } },
    });
    const result = await submitPHQ9(responses);
    expect(result.total_score).toBe(8);
    expect(result.severity).toBe('mild');
  });

  it('submitGAD7 posts to /api/v1/advanced-mood/assess/gad7', async () => {
    const responses = { feeling_nervous: 2, cant_control_worry: 2, worrying_too_much: 2, trouble_relaxing: 2, restless: 2, easily_annoyed: 2, afraid: 2 };
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { success: true, data: { total_score: 14, severity: 'moderate', risk_level: 'moderate', item_scores: responses, interpretation: 'Moderate', recommendations: [], follow_up_timeframe: '1_week' } },
    });
    const result = await submitGAD7(responses);
    expect(result.total_score).toBe(14);
  });

  it('getAssessmentHistory fetches from /api/v1/advanced-mood/assess/history', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { success: true, data: { history: [], total: 0 } },
    });
    const result = await getAssessmentHistory({ type: 'phq9', limit: 5 });
    expect(result.total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Daily Insights API Integration
// ---------------------------------------------------------------------------
describe('Daily Insights API Integration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('generateInsights posts to /api/v1/insights/generate/{userId}', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: { insights: [{ insight_id: 'i1', user_id: 'u1', insight_type: 'temporal_trend', domain: 'mood', title: 'T', message: 'M', recommendation: 'R', evidence: {}, urgency: 'low', suggested_action: 'A', related_memories: [], values_alignment: null, behavioral_target: null, created_at: '2024-01-01', status: 'pending' }] } },
    });
    const result = await generateInsights('user123');
    expect(result).toHaveLength(1);
  });

  it('getPendingInsights fetches from /api/v1/insights/pending/{userId}', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: { insights: [] } },
    });
    const result = await getPendingInsights('user123');
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// CBT Modules API Integration
// ---------------------------------------------------------------------------
describe('CBT Modules API Integration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getCBTModules fetches from /api/v1/cbt/modules', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: { modules: [{ moduleId: 'm1', title: 'Anxiety 101', description: 'Intro', category: 'anxiety', difficultyLevel: 'beginner', estimatedDuration: 30, prerequisites: [], learningObjectives: [] }] } },
    });
    const result = await getCBTModules();
    expect(result).toHaveLength(1);
    expect(result[0].moduleId).toBe('m1');
  });

  it('getCBTModuleDetail fetches specific module', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: { module: { moduleId: 'm1', title: 'Anxiety 101', description: 'Intro', category: 'anxiety', difficultyLevel: 'beginner', estimatedDuration: 30, prerequisites: [], learningObjectives: [] } } },
    });
    const result = await getCBTModuleDetail('m1');
    expect(result.title).toBe('Anxiety 101');
  });

  it('getPersonalizedSession fetches session with mood param', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: { session: { exercises: [], sessionTheme: 'calm', estimatedDuration: 15, difficultyProgression: 'easy', motivationalElements: [], guidance: 'Breathe' } } },
    });
    const result = await getPersonalizedSession('anxious');
    expect(result.sessionTheme).toBe('calm');
  });

  it('getCBTInsights fetches insights', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: { insights: { overallProgress: 50, strengthAreas: ['breathing'], improvementAreas: ['sleep'], recommendedNextSteps: ['meditation'], streak: { current: 3, longest: 7, consistencyRating: 'good' }, exercisesCompleted: 10, modulesCompleted: 2 } } },
    });
    const result = await getCBTInsights();
    expect(result.overallProgress).toBe(50);
    expect(result.streak.current).toBe(3);
  });
});

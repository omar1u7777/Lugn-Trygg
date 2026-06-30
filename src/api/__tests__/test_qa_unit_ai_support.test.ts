import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the api client
vi.mock('../client', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
  },
  unwrapApiResponse: vi.fn((payload: unknown) => payload),
}));

import { api } from '../client';
import {
  chatWithAI,
  getChatHistory,
  closeChatSession,
  analyzeMoodPatterns,
  startExercise,
  completeExercise,
  transcribeAudio,
  analyzeVoiceEmotion,
  getStories,
  generateStory,
} from '../ai';
import { ApiError } from '../errors';

// ---------------------------------------------------------------------------
// chatWithAI
// ---------------------------------------------------------------------------
describe('chatWithAI', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends user_id and message to chat endpoint', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { response: 'Hej! Hur mår du?', emotions_detected: ['glad'], crisis_detected: false },
    });
    const result = await chatWithAI('user123', 'Hej');
    expect(api.post).toHaveBeenCalledWith(
      '/api/v1/chatbot/chat',
      { user_id: 'user123', message: 'Hej' },
      expect.objectContaining({ timeout: 60000 }),
    );
    expect(result.response).toBe('Hej! Hur mår du?');
    expect(result.emotionsDetected).toEqual(['glad']);
    expect(result.crisisDetected).toBe(false);
  });

  it('handles camelCase response format', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: { response: 'Hej', emotionsDetected: ['calm'], crisisDetected: true } },
    });
    const result = await chatWithAI('user123', 'Hej');
    expect(result.response).toBe('Hej');
    expect(result.emotionsDetected).toEqual(['calm']);
    expect(result.crisisDetected).toBe(true);
  });

  it('defaults aiGenerated to true when not specified', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { response: 'Hej' },
    });
    const result = await chatWithAI('user123', 'Hej');
    expect(result.aiGenerated).toBe(true);
  });

  it('throws ApiError on network failure', async () => {
    const axiosError = { message: 'Network Error', isAxiosError: true, response: undefined, config: {} };
    (api.post as ReturnType<typeof vi.fn>).mockRejectedValue(axiosError);
    await expect(chatWithAI('user123', 'Hej')).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getChatHistory
// ---------------------------------------------------------------------------
describe('getChatHistory', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns conversation array from data wrapper', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: { conversation: [{ role: 'user', content: 'Hej', timestamp: '2024-01-01' }] } },
    });
    const result = await getChatHistory();
    expect(result.conversation).toHaveLength(1);
    expect(result.conversation[0].role).toBe('user');
  });

  it('returns conversation from direct format', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { conversation: [{ role: 'assistant', content: 'Hej', timestamp: '2024-01-01' }] },
    });
    const result = await getChatHistory();
    expect(result.conversation).toHaveLength(1);
  });

  it('returns empty conversation when no data', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    const result = await getChatHistory();
    expect(result.conversation).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// closeChatSession
// ---------------------------------------------------------------------------
describe('closeChatSession', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls session close endpoint without throwing', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({});
    await expect(closeChatSession()).resolves.toBeUndefined();
  });

  it('swallows errors silently', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
    await expect(closeChatSession()).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// analyzeMoodPatterns
// ---------------------------------------------------------------------------
describe('analyzeMoodPatterns', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns pattern analysis from data wrapper', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: { patternAnalysis: { pattern_analysis: 'improving', predictions: 'stable', confidence: 0.8 }, dataPointsAnalyzed: 30, analysisTimestamp: '2024-01-01' } },
    });
    const result = await analyzeMoodPatterns();
    expect(result.patternAnalysis).toEqual({ pattern_analysis: 'improving', predictions: 'stable', confidence: 0.8 });
    expect(result.dataPointsAnalyzed).toBe(30);
  });

  it('handles snake_case format', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { pattern_analysis: { pattern_analysis: 'declining', predictions: 'worse', confidence: 0.5 }, data_points_analyzed: 10, analysis_timestamp: '2024-01-01' },
    });
    const result = await analyzeMoodPatterns();
    expect(result.dataPointsAnalyzed).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// startExercise
// ---------------------------------------------------------------------------
describe('startExercise', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends exerciseType and duration', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: { exercise: { title: 'Breathing', description: 'Breathe', steps: [], tips: '', benefits: '', instructions: '' }, exerciseType: 'breathing', startedAt: '2024-01-01', duration: 5 } },
    });
    const result = await startExercise('breathing', 5);
    expect(api.post).toHaveBeenCalledWith('/api/v1/chatbot/exercise', { exerciseType: 'breathing', duration: 5 });
    expect(result.exerciseType).toBe('breathing');
    expect(result.duration).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// completeExercise
// ---------------------------------------------------------------------------
describe('completeExercise', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends completion request with userId and exerciseId', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { message: 'completed' } });
    const result = await completeExercise('user123', 'ex1');
    expect(api.post).toHaveBeenCalledWith('/api/v1/chatbot/exercise/user123/ex1/complete');
    expect(result.message).toBe('completed');
  });
});

// ---------------------------------------------------------------------------
// transcribeAudio
// ---------------------------------------------------------------------------
describe('transcribeAudio', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns transcription text and confidence', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { text: 'Hej', confidence: 0.9 } });
    const blob = new Blob(['audio'], { type: 'audio/webm' });
    const result = await transcribeAudio(blob);
    expect(result.text).toBe('Hej');
    expect(result.confidence).toBe(0.9);
  });

  it('returns fallback on error', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
    const blob = new Blob(['audio'], { type: 'audio/webm' });
    const result = await transcribeAudio(blob);
    expect(result.text).toBe('');
    expect(result.confidence).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// analyzeVoiceEmotion
// ---------------------------------------------------------------------------
describe('analyzeVoiceEmotion', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns emotion and confidence', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { emotion: 'happy', confidence: 0.8 } });
    const blob = new Blob(['audio'], { type: 'audio/webm' });
    const result = await analyzeVoiceEmotion(blob);
    expect(result.emotion).toBe('happy');
    expect(result.confidence).toBe(0.8);
  });

  it('returns neutral fallback on error', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
    const blob = new Blob(['audio'], { type: 'audio/webm' });
    const result = await analyzeVoiceEmotion(blob);
    expect(result.emotion).toBe('neutral');
    expect(result.confidence).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// getStories
// ---------------------------------------------------------------------------
describe('getStories', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns mapped AIStory array', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { stories: [{ id: '1', storyPreview: 'En dag...', generatedAt: '2024-01-01' }] },
    });
    const result = await getStories();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
    expect(result[0].content).toBe('En dag...');
    expect(result[0].title).toBeTruthy();
    expect(result[0].duration).toBeGreaterThan(0);
  });

  it('returns empty array when no stories', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    const result = await getStories();
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// generateStory
// ---------------------------------------------------------------------------
describe('generateStory', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns mapped AIStory from generated response', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { story: 'Det var en gång...', moodSummary: { dominantMood: 'happy' }, generatedAt: '2024-01-01' },
    });
    const result = await generateStory('sv');
    expect(result.content).toBe('Det var en gång...');
    expect(result.mood).toBe('happy');
    expect(result.id).toMatch(/^generated-/);
    expect(result.duration).toBeGreaterThan(0);
  });

  it('derives title from first sentence', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { story: 'En vacker morgon. Resten av dagen.', generatedAt: '2024-01-01' },
    });
    const result = await generateStory('sv');
    expect(result.title).toBe('En vacker morgon');
  });

  it('uses Untitled Story for empty content', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { story: '', generatedAt: '2024-01-01' },
    });
    const result = await generateStory('sv');
    expect(result.title).toBe('Untitled Story');
    expect(result.mood).toBe('neutral');
  });
});

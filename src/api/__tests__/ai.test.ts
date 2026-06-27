import { vi, describe, it, expect, beforeEach } from 'vitest';

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../client', () => ({
  api: apiMock,
  default: apiMock,
  apiClient: apiMock,
  unwrapApiResponse: (payload: unknown) => {
    if (
      payload &&
      typeof payload === 'object' &&
      'data' in payload &&
      ('success' in payload || 'status' in payload || 'timestamp' in payload)
    ) {
      return (payload as { data: unknown }).data;
    }
    return payload;
  },
}));
vi.mock('../errors', () => ({
  ApiError: class ApiError extends Error {
    constructor(msg: string, opts: Record<string, unknown> = {}) { super(msg); Object.assign(this, opts); }
    static fromAxiosError(e: unknown) { return new Error(String(e)); }
  },
}));
vi.mock('../../utils/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import { chatWithAI, getChatHistory, analyzeMoodPatterns, startExercise, completeExercise, transcribeAudio, analyzeVoiceEmotion, getStories, generateStory } from '../ai';

describe('ai API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('chatWithAI', () => {
    it('returns chat response on success', async () => {
      const mockData = { response: 'Hello!', crisisDetected: false };
      apiMock.post.mockResolvedValueOnce({ data: mockData });
      const result = await chatWithAI('u1', 'Hi');
      expect(apiMock.post).toHaveBeenCalled();
      expect(result.response).toBe('Hello!');
    });

    it('throws on error', async () => {
      apiMock.post.mockRejectedValueOnce(new Error('Network error'));
      await expect(chatWithAI('u1', 'Hi')).rejects.toThrow();
    });
  });

  describe('getChatHistory', () => {
    it('returns conversation history on success', async () => {
      const msgs = [{ role: 'user', content: 'Hi', timestamp: '2026-01-01' }];
      apiMock.get.mockResolvedValueOnce({ data: { conversation: msgs } });
      const result = await getChatHistory('u1');
      expect(result).toHaveProperty('conversation');
    });

    it('throws on error', async () => {
      apiMock.get.mockRejectedValueOnce(new Error('fail'));
      await expect(getChatHistory('u1')).rejects.toThrow();
    });
  });

  describe('analyzeMoodPatterns', () => {
    it('returns patterns on success', async () => {
      const mockData = { patternAnalysis: 'some pattern', dataPointsAnalyzed: 5, analysisTimestamp: '2026-01-01' };
      apiMock.post.mockResolvedValueOnce({ data: mockData });
      const result = await analyzeMoodPatterns();
      expect(result).toHaveProperty('patternAnalysis');
    });

    it('throws on error', async () => {
      apiMock.post.mockRejectedValueOnce(new Error('fail'));
      await expect(analyzeMoodPatterns()).rejects.toThrow();
    });
  });

  describe('startExercise', () => {
    it('returns exercise session on success', async () => {
      const mockExercise = { exercise: { title: 'Box Breathing', steps: [], tips: '', benefits: '', instructions: '', description: '' }, exerciseType: 'breathing', duration: 5 };
      apiMock.post.mockResolvedValueOnce({ data: mockExercise });
      const result = await startExercise('breathing', 5);
      expect(result.exerciseType).toBe('breathing');
    });

    it('throws on error', async () => {
      apiMock.post.mockRejectedValueOnce(new Error('fail'));
      await expect(startExercise('breathing', 5)).rejects.toThrow();
    });
  });

  describe('completeExercise', () => {
    it('returns result message on success', async () => {
      const mockResult = { message: 'Exercise completed!' };
      apiMock.post.mockResolvedValueOnce({ data: mockResult });
      const result = await completeExercise('u1', 'ex1');
      expect(result).toMatchObject(mockResult);
    });

    it('throws on error', async () => {
      apiMock.post.mockRejectedValueOnce(new Error('fail'));
      await expect(completeExercise('u1', 'ex1')).rejects.toThrow();
    });
  });

  describe('transcribeAudio', () => {
    it('returns transcript on success', async () => {
      const mockTranscript = { text: 'Hello world', confidence: 0.95 };
      apiMock.post.mockResolvedValueOnce({ data: mockTranscript });
      const blob = new Blob(['audio'], { type: 'audio/webm' });
      const result = await transcribeAudio(blob);
      expect(result).toMatchObject(mockTranscript);
    });

    it('returns fallback object on error', async () => {
      apiMock.post.mockRejectedValueOnce(new Error('fail'));
      const blob = new Blob(['audio']);
      const result = await transcribeAudio(blob);
      // Function catches and returns { text: '', confidence: 0 } instead of throwing
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('confidence');
    });
  });

  describe('analyzeVoiceEmotion', () => {
    it('returns emotion on success', async () => {
      const mockEmotion = { emotion: 'happy', confidence: 0.9 };
      apiMock.post.mockResolvedValueOnce({ data: mockEmotion });
      const blob = new Blob(['audio']);
      const result = await analyzeVoiceEmotion(blob);
      expect(result).toMatchObject(mockEmotion);
    });

    it('returns fallback emotion on error', async () => {
      apiMock.post.mockRejectedValueOnce(new Error('fail'));
      const blob = new Blob(['audio']);
      const result = await analyzeVoiceEmotion(blob);
      // Function catches and returns { emotion: 'neutral', confidence: 0.5 } fallback
      expect(result).toHaveProperty('emotion');
      expect(result).toHaveProperty('confidence');
    });
  });

  describe('getStories', () => {
    it('returns normalized stories on success', async () => {
      const rawStories = [
        {
          id: 'story-1',
          storyPreview: 'Once upon a time there was a calm forest. The end.',
          generatedAt: '2026-01-01T00:00:00Z',
        },
      ];
      apiMock.get.mockResolvedValueOnce({ data: { stories: rawStories } });
      const result = await getStories();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'story-1',
        content: rawStories[0].storyPreview,
        isFavorite: false,
      });
      expect(result[0].duration).toBeGreaterThan(0);
      expect(result[0].title).toBeTruthy();
    });

    it('throws on error', async () => {
      apiMock.get.mockRejectedValueOnce(new Error('fail'));
      await expect(getStories()).rejects.toThrow();
    });
  });

  describe('generateStory', () => {
    it('returns normalized story on success', async () => {
      const mockStory = {
        story: 'A long, long time ago in a peaceful valley...',
        moodSummary: { dominantMood: 'calm' },
        generatedAt: '2026-01-02T00:00:00Z',
      };
      apiMock.post.mockResolvedValueOnce({ data: mockStory });
      const result = await generateStory('sv');
      expect(result.content).toBe(mockStory.story);
      expect(result.mood).toBe('calm');
      expect(result.duration).toBeGreaterThan(0);
      expect(apiMock.post).toHaveBeenCalledWith(
        '/api/v1/ai/story',
        { locale: 'sv' },
        expect.objectContaining({ timeout: 120000 })
      );
    });

    it('throws on error', async () => {
      apiMock.post.mockRejectedValueOnce(new Error('fail'));
      await expect(generateStory('sv')).rejects.toThrow();
    });
  });
});

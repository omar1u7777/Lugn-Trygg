import { vi, describe, it, expect, beforeEach } from 'vitest';

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../client', () => ({ api: apiMock, default: apiMock, apiClient: apiMock }));
vi.mock('../errors', () => ({
  ApiError: class ApiError extends Error {
    constructor(msg: string, opts: Record<string, unknown> = {}) { super(msg); Object.assign(this, opts); }
    static fromAxiosError(e: unknown) { return new Error(String(e)); }
  },
}));
vi.mock('../../utils/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import { chatWithAI, getChatHistory, analyzeMoodPatterns, startExercise, completeExercise, transcribeAudio, analyzeVoiceEmotion } from '../ai';

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
});

import { vi, describe, it, expect, beforeEach } from 'vitest';

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../client', () => ({ api: apiMock, default: apiMock, apiClient: apiMock }));

import {
  transcribeVoiceAudio,
  analyzeVoiceEmotionDetailed,
  getVoiceServiceStatus,
  blobToBase64,
} from '../voice';

describe('voice API', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('transcribeVoiceAudio', () => {
    it('returns transcript with default language', async () => {
      const data = { text: 'Hello world', confidence: 0.95 };
      apiMock.post.mockResolvedValueOnce({ data: { data } });
      const result = await transcribeVoiceAudio('base64audio==');
      expect(apiMock.post).toHaveBeenCalled();
      expect(result).toMatchObject(data);
    });

    it('uses custom language', async () => {
      apiMock.post.mockResolvedValueOnce({ data: { data: { text: 'Hi' } } });
      await transcribeVoiceAudio('base64audio==', 'en-US');
      expect(apiMock.post).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ language: 'en-US' })
      );
    });

    it('throws on error', async () => {
      apiMock.post.mockRejectedValueOnce(new Error('fail'));
      await expect(transcribeVoiceAudio('audio')).rejects.toThrow();
    });
  });

  describe('analyzeVoiceEmotionDetailed', () => {
    it('returns emotion analysis', async () => {
      const data = { primaryEmotion: 'happy', confidence: 0.88, energyLevel: 0.7 };
      apiMock.post.mockResolvedValueOnce({ data: { data } });
      const result = await analyzeVoiceEmotionDetailed('base64audio==');
      expect(result).toMatchObject(data);
    });

    it('includes transcript when provided', async () => {
      apiMock.post.mockResolvedValueOnce({ data: { data: {} } });
      await analyzeVoiceEmotionDetailed('audio', 'Jag är glad');
      expect(apiMock.post).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ transcript: 'Jag är glad' })
      );
    });

    it('throws on error', async () => {
      apiMock.post.mockRejectedValueOnce(new Error('fail'));
      await expect(analyzeVoiceEmotionDetailed('audio')).rejects.toThrow();
    });
  });

  describe('getVoiceServiceStatus', () => {
    it('returns service status', async () => {
      const status = { googleSpeech: true, webSpeechFallback: true, languages: ['sv-SE'] };
      apiMock.get.mockResolvedValueOnce({ data: { data: status } });
      const result = await getVoiceServiceStatus();
      expect(result).toMatchObject(status);
    });

    it('throws on error', async () => {
      apiMock.get.mockRejectedValueOnce(new Error('fail'));
      await expect(getVoiceServiceStatus()).rejects.toThrow();
    });
  });

  describe('blobToBase64', () => {
    it('converts blob to base64 string', async () => {
      // jsdom has FileReader support
      const blob = new Blob(['hello'], { type: 'text/plain' });
      const result = await blobToBase64(blob);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });
});

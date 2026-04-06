/**
 * Tests for audio API functions.
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
    AUDIO: {
      AUDIO_LIBRARY: '/api/v1/audio/library',
      AUDIO_CATEGORIES: '/api/v1/audio/categories',
      AUDIO_CATEGORY: '/api/v1/audio/category',
      AUDIO_SEARCH: '/api/v1/audio/search',
    },
  },
}));

import { api } from '../client';
import {
  getAudioLibrary,
  getAudioCategories,
  getAudioCategoryTracks,
  searchAudioTracks,
  getAISoundscapes,
  generateAISoundscape,
  getAdaptiveRecommendation,
  getBrainwaveInfo,
} from '../audio';

const mockApi = api as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };

describe('getAudioLibrary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns library object on success', async () => {
    const library = { nature: { id: 'nature', name: 'Nature', icon: '🌿', description: 'calm', tracks: [] } };
    mockApi.get.mockResolvedValueOnce({ data: { library } });

    const result = await getAudioLibrary();
    expect(result).toEqual(library);
  });

  it('returns empty object when library is missing', async () => {
    mockApi.get.mockResolvedValueOnce({ data: {} });

    const result = await getAudioLibrary();
    expect(result).toEqual({});
  });

  it('throws on API error', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Fetch failed'));

    await expect(getAudioLibrary()).rejects.toThrow();
  });
});

describe('getAudioCategories', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns categories array on success', async () => {
    const categories = [{ id: 'nature', name: 'Nature', icon: '🌿', description: 'calm' }];
    mockApi.get.mockResolvedValueOnce({ data: { categories } });

    const result = await getAudioCategories();
    expect(result).toEqual(categories);
  });

  it('returns empty array when categories missing', async () => {
    mockApi.get.mockResolvedValueOnce({ data: {} });

    const result = await getAudioCategories();
    expect(result).toEqual([]);
  });

  it('throws on API error', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Error'));

    await expect(getAudioCategories()).rejects.toThrow();
  });
});

describe('getAudioCategoryTracks', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns category and tracks', async () => {
    const categoryInfo = { id: 'nature', name: 'Nature', icon: '🌿', description: 'calm' };
    const tracks = [{ id: 't1', title: 'Rain', artist: 'Nature', duration: '3:00', url: '/rain.mp3' }];
    mockApi.get.mockResolvedValueOnce({ data: { category: categoryInfo, tracks } });

    const result = await getAudioCategoryTracks('nature');
    expect(result.category).toEqual(categoryInfo);
    expect(result.tracks).toEqual(tracks);
  });

  it('returns empty tracks when missing', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { category: { id: 'nature' } } });

    const result = await getAudioCategoryTracks('nature');
    expect(result.tracks).toEqual([]);
  });

  it('encodes categoryId in URL', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { category: {}, tracks: [] } });

    await getAudioCategoryTracks('special category');
    expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining('special%20category'));
  });

  it('throws on API error', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Error'));

    await expect(getAudioCategoryTracks('nature')).rejects.toThrow();
  });
});

describe('searchAudioTracks', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns search results', async () => {
    const results = [{ id: 't1', title: 'Rain', artist: 'Nature', duration: '3:00', url: '/rain.mp3' }];
    mockApi.get.mockResolvedValueOnce({ data: { results } });

    const result = await searchAudioTracks('rain');
    expect(result).toEqual(results);
  });

  it('passes query as q param', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { results: [] } });

    await searchAudioTracks('forest');
    expect(mockApi.get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ params: { q: 'forest' } })
    );
  });

  it('returns empty array when results missing', async () => {
    mockApi.get.mockResolvedValueOnce({ data: {} });

    const result = await searchAudioTracks('rain');
    expect(result).toEqual([]);
  });

  it('throws on API error', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Error'));

    await expect(searchAudioTracks('rain')).rejects.toThrow();
  });
});

describe('getAISoundscapes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns soundscapes array', async () => {
    const soundscapes = [{ id: 'meditation', name: 'Meditation', name_en: 'Meditation', description: 'calm', description_en: 'calm', brainwave: 'alpha', best_for: ['focus'] }];
    mockApi.get.mockResolvedValueOnce({ data: { data: { soundscapes } } });

    const result = await getAISoundscapes();
    expect(result).toEqual(soundscapes);
  });

  it('returns empty array when missing', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: {} } });

    const result = await getAISoundscapes();
    expect(result).toEqual([]);
  });

  it('throws on API error', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Error'));

    await expect(getAISoundscapes()).rejects.toThrow();
  });
});

describe('generateAISoundscape', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns generated track data', async () => {
    const track = { track_id: 'trk-1', type: 'meditation', duration_seconds: 300, audio_url: '/audio/1.mp3', download_url: '/dl/1.mp3', parameters: { binaural_frequency: 10, carrier_frequency: 200, brainwave_state: 'alpha' }, created_at: '2024-01-01' };
    mockApi.post.mockResolvedValueOnce({ data: { data: track } });

    const result = await generateAISoundscape('meditation', 300);
    expect(result.track_id).toBe('trk-1');
  });

  it('uses default duration of 300 when not specified', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { data: { track_id: 't1' } } });

    await generateAISoundscape('meditation');
    expect(mockApi.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ duration: 300 })
    );
  });

  it('includes mood when provided', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { data: { track_id: 't1' } } });

    await generateAISoundscape('focus', 600, 'stressed');
    expect(mockApi.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ mood: 'stressed' })
    );
  });

  it('throws on API error', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('Generation failed'));

    await expect(generateAISoundscape('meditation')).rejects.toThrow();
  });
});

describe('getAdaptiveRecommendation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns recommendation data', async () => {
    const recommendation = {
      recommended_soundscape: 'meditation',
      reasoning: 'Matches your mood',
      alternatives: ['focus', 'sleep'],
      parameters: { suggested_duration: 300, volume: 0.7, use_headphones: true },
    };
    mockApi.post.mockResolvedValueOnce({ data: { data: recommendation } });

    const result = await getAdaptiveRecommendation('calm');
    expect(result.recommended_soundscape).toBe('meditation');
  });

  it('uses default timeOfDay and activity', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { data: {} } });

    await getAdaptiveRecommendation('neutral');
    expect(mockApi.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ time_of_day: 'afternoon', activity: 'relaxing' })
    );
  });

  it('posts current_mood', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { data: {} } });

    await getAdaptiveRecommendation('anxious', 'morning', 'working');
    expect(mockApi.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ current_mood: 'anxious', time_of_day: 'morning', activity: 'working' })
    );
  });

  it('throws on API error', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('Error'));

    await expect(getAdaptiveRecommendation('calm')).rejects.toThrow();
  });
});

describe('getBrainwaveInfo', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns brainwave data', async () => {
    const brainwaveData = {
      alpha: { frequency: '8-13 Hz', state: 'relaxed', description: 'Calm focus', benefits: ['relaxation'], research: 'Well documented' },
    };
    mockApi.get.mockResolvedValueOnce({ data: { data: brainwaveData } });

    const result = await getBrainwaveInfo();
    expect(result.alpha).toBeDefined();
  });

  it('throws on API error', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Error'));

    await expect(getBrainwaveInfo()).rejects.toThrow();
  });
});

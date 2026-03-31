import { api } from "./client";
import { ApiError } from "./errors";
import { API_ENDPOINTS } from "./constants";

/**
 * Audio track with relaxing sounds
 */
export interface AudioTrack {
  id: string;
  title: string;
  titleEn?: string;
  artist: string;
  duration: string;
  url: string;
  description?: string;
  license?: string;
  // Search results include category info
  categoryId?: string;
  categoryName?: string;
  categoryIcon?: string;
}

/**
 * Audio category containing multiple tracks
 */
export interface AudioCategory {
  id: string;
  name: string;
  nameEn?: string;
  icon: string;
  description: string;
  tracks?: AudioTrack[];
  trackCount?: number;
}

/**
 * Complete audio library structure
 */
export interface AudioLibrary {
  [categoryId: string]: AudioCategory;
}

/**
 * Get complete audio library with all categories and tracks
 * @returns Promise resolving to audio library object
 */
export const getAudioLibrary = async (): Promise<AudioLibrary> => {
  try {
    const response = await api.get(API_ENDPOINTS.AUDIO.AUDIO_LIBRARY);
    // Backend returns { success: true, library: {...} }
    return response.data.library || {};
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Get audio categories (without full tracks)
 * @returns Promise resolving to array of category info
 */
export const getAudioCategories = async (): Promise<Omit<AudioCategory, 'tracks'>[]> => {
  try {
    const response = await api.get(API_ENDPOINTS.AUDIO.AUDIO_CATEGORIES);
    return response.data.categories || [];
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Get tracks for a specific category
 * @param categoryId - The category ID
 * @returns Promise resolving to category with tracks
 */
export const getAudioCategoryTracks = async (categoryId: string): Promise<{ category: Omit<AudioCategory, 'tracks'>, tracks: AudioTrack[] }> => {
  try {
    const response = await api.get(`${API_ENDPOINTS.AUDIO.AUDIO_CATEGORY}/${encodeURIComponent(categoryId)}`);
    return {
      category: response.data.category,
      tracks: response.data.tracks || []
    };
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Search audio tracks
 * @param query - Search query (min 2 characters)
 * @returns Promise resolving to matching tracks
 */
export const searchAudioTracks = async (query: string): Promise<AudioTrack[]> => {
  try {
    const response = await api.get(API_ENDPOINTS.AUDIO.AUDIO_SEARCH, {
      params: { q: query }
    });
    return response.data.results || [];
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

// ============================================================================
// AI Music Generation API
// Neural ambient soundscapes with brainwave entrainment
// ============================================================================

export interface SoundscapeType {
  id: string;
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  brainwave: string;
  best_for: string[];
  icon?: string;
  color?: string;
}

export interface GeneratedTrack {
  track_id: string;
  type: string;
  duration_seconds: number;
  audio_url: string;
  download_url: string;
  parameters: {
    binaural_frequency: number;
    carrier_frequency: number;
    brainwave_state: string;
  };
  created_at: string;
}

/**
 * Get available AI soundscape types
 * @returns Promise resolving to array of soundscape types
 */
export const getAISoundscapes = async (): Promise<SoundscapeType[]> => {
  try {
    const response = await api.get('/api/v1/ai-music/soundscapes');
    return response.data.data?.soundscapes || [];
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Generate AI soundscape
 * @param type - Soundscape type (meditation, deep_sleep, focus, etc.)
 * @param duration - Duration in seconds (60-1200)
 * @param mood - Optional mood for adaptive generation
 * @returns Promise resolving to generated track metadata
 */
export const generateAISoundscape = async (
  type: string,
  duration: number = 300,
  mood?: string
): Promise<GeneratedTrack> => {
  try {
    const response = await api.post('/api/v1/ai-music/generate', {
      type,
      duration,
      mood
    });
    return response.data.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Get adaptive soundscape recommendation based on mood
 * @param currentMood - Current mood state
 * @param timeOfDay - Current time period
 * @param activity - Current activity
 * @returns Promise resolving to recommendation
 */
export const getAdaptiveRecommendation = async (
  currentMood: string,
  timeOfDay: string = 'afternoon',
  activity: string = 'relaxing'
): Promise<{
  recommended_soundscape: string;
  reasoning: string;
  alternatives: string[];
  parameters: {
    suggested_duration: number;
    volume: number;
    use_headphones: boolean;
  };
}> => {
  try {
    const response = await api.post('/api/v1/ai-music/adaptive-recommendation', {
      current_mood: currentMood,
      time_of_day: timeOfDay,
      activity
    });
    return response.data.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Get brainwave frequency information
 * @returns Promise resolving to educational info about brainwaves
 */
export const getBrainwaveInfo = async (): Promise<{
  [key: string]: {
    frequency: string;
    state: string;
    description: string;
    benefits: string[];
    research: string;
  };
}> => {
  try {
    const response = await api.get('/api/v1/ai-music/brainwave-info');
    return response.data.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};
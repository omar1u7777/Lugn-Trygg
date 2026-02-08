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
/**
 * Advanced Mood API - Detailed mood tracking and analysis
 */

import { api } from './client';
import { ApiError } from './errors';
import { API_ENDPOINTS } from './constants';

export interface AdvancedMoodEntry {
  id: string;
  mood_score: number;
  energy_level: number;
  anxiety_level: number;
  stress_level: number;
  sleep_quality?: number;
  physical_activity?: number;
  social_interaction?: number;
  notes?: string;
  triggers?: string[];
  created_at: string;
}

export interface MoodPattern {
  pattern_type: string;
  description: string;
  frequency: number;
  triggers: string[];
  recommendations: string[];
}

export interface MoodCorrelation {
  factor1: string;
  factor2: string;
  correlation_coefficient: number;
  significance: number;
  description: string;
}

export interface MoodForecast {
  date: string;
  predicted_mood: number;
  confidence: number;
  influencing_factors: string[];
}

/**
 * Log an advanced mood entry
 */
export const logAdvancedMood = async (entry: Partial<AdvancedMoodEntry>): Promise<AdvancedMoodEntry> => {
  try {
    const response = await api.post(API_ENDPOINTS.ADVANCED_MOOD.LOG, entry);
    return response.data.data?.entry;
  } catch (error: unknown) {
    if (error instanceof ApiError) throw error;
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Get mood entries
 * @param limit - Number of entries to retrieve
 * @param offset - Pagination offset
 */
export const getMoodEntries = async (limit: number = 30, offset: number = 0): Promise<AdvancedMoodEntry[]> => {
  try {
    const response = await api.get(API_ENDPOINTS.ADVANCED_MOOD.ENTRIES, {
      params: { limit, offset }
    });
    return response.data.data?.entries || [];
  } catch (error: unknown) {
    if (error instanceof ApiError) throw error;
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Get mood patterns analysis
 */
export const getMoodPatterns = async (): Promise<MoodPattern[]> => {
  try {
    const response = await api.get(API_ENDPOINTS.ADVANCED_MOOD.PATTERNS);
    return response.data.data?.patterns || [];
  } catch (error: unknown) {
    if (error instanceof ApiError) throw error;
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Get mood correlations
 */
export const getMoodCorrelations = async (): Promise<MoodCorrelation[]> => {
  try {
    const response = await api.get(API_ENDPOINTS.ADVANCED_MOOD.CORRELATIONS);
    return response.data.data?.correlations || [];
  } catch (error: unknown) {
    if (error instanceof ApiError) throw error;
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Get mood forecast
 * @param days - Number of days to forecast
 */
export const getMoodForecast = async (days: number = 7): Promise<MoodForecast[]> => {
  try {
    const response = await api.get(API_ENDPOINTS.ADVANCED_MOOD.FORECAST, {
      params: { days }
    });
    return response.data.data?.forecast || [];
  } catch (error: unknown) {
    if (error instanceof ApiError) throw error;
    throw ApiError.fromAxiosError(error);
  }
};

import { api } from "./client";
import type { MoodData } from "./client";
import { ApiError } from "./errors";
import { API_ENDPOINTS } from "./constants";

/**
 * Logs a mood entry for the user
 * @param userId - User ID (though backend gets it from JWT)
 * @param moodData - Mood data including score, note, emotions, activities
 * @returns Promise resolving to mood log response
 * @throws Error if mood logging fails
 */
export const logMood = async (userId: string, moodData: MoodData): Promise<any> => {
  try {
    // Token added automatically by interceptor
    const response = await api.post(API_ENDPOINTS.MOOD.LOG_MOOD, {
      user_id: userId,
      ...moodData
    });
    return response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Retrieves user's mood entries
 * @param _userId - User ID (backend gets it from JWT, parameter kept for compatibility)
 * @returns Promise resolving to array of mood entries
 */
export const getMoods = async (_userId: string) => {
  try {
    // Token added automatically by interceptor
    // Backend route is /api/mood (GET) - user_id comes from JWT token, not query param
    const response = await api.get(API_ENDPOINTS.MOOD.GET_MOODS);
    return response.data.moods || [];
  } catch (error: unknown) {
    const apiError = error as any;
    console.error("❌ API Mood Fetch error:", apiError);
    // Return empty array for graceful degradation
    return [];
  }
};

/**
 * Gets weekly mood analysis for the user
 * @param _userId - User ID (backend gets it from JWT)
 * @returns Promise resolving to weekly analysis data or fallback data
 */
export const getWeeklyAnalysis = async (_userId: string) => {
  try {
    // Token added automatically by interceptor
    // Backend route is /api/mood/weekly-analysis - user_id comes from JWT token
    const response = await api.get(API_ENDPOINTS.MOOD.MOOD_WEEKLY_ANALYSIS);
    return response.data;
  } catch (error: unknown) {
    const apiError = error as any;
    console.error("❌ API Weekly Analysis error:", apiError);
    // Return fallback data instead of throwing error
    return {
      total_moods: 0,
      average_sentiment: 0,
      trend: 'stable',
      insights: 'Logga ditt humör för att få personliga insikter!',
      recent_memories: [],
      fallback: true
    };
  }
};

/**
 * Gets mood statistics for the user
 * @param _userId - User ID (backend gets it from JWT)
 * @returns Promise resolving to mood statistics
 * @throws Error if statistics retrieval fails
 */
export const getMoodStatistics = async (_userId: string) => {
  try {
    // Token added automatically by interceptor
    // Backend route is /api/mood-stats/statistics - user_id comes from JWT token
    const response = await api.get(API_ENDPOINTS.MOOD.MOOD_STATS);
    return response.data;
  } catch (error: unknown) {
    const apiError = error as any;
    throw new Error((apiError.response?.data as any)?.error || "Ett fel uppstod vid hämtning av statistik.");
  }
};

/**
 * Analyzes text for sentiment and mood indicators
 * @param text - Text to analyze
 * @returns Promise resolving to text analysis results
 * @throws Error if text analysis fails
 */
export const analyzeText = async (text: string) => {
  try {
    const response = await api.post(API_ENDPOINTS.MOOD.ANALYZE_TEXT, { text });
    return response.data;
  } catch (error: unknown) {
    const apiError = error as any;
    throw new Error((apiError.response?.data as any)?.error || "Ett fel uppstod vid textanalys.");
  }
};
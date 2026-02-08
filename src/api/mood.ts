import { api } from "./client";
import type { MoodData } from "./client";
import { ApiError } from "./errors";
import { API_ENDPOINTS } from "./constants";

/**
 * Weekly analysis response interface
 */
export interface WeeklyAnalysisResponse {
  totalMoods: number;
  averageSentiment: number;
  trend: 'improving' | 'declining' | 'stable';
  insights: string;
  recentMemories: any[];
  positiveCount?: number;
  negativeCount?: number;
  neutralCount?: number;
  positivePercentage?: number;
  negativePercentage?: number;
  neutralPercentage?: number;
  fallback?: boolean;
  confidence?: number;
  // snake_case aliases for backwards compatibility
  total_moods?: number;
  average_sentiment?: number;
  recent_memories?: any[];
  positive_count?: number;
  negative_count?: number;
  neutral_count?: number;
  positive_percentage?: number;
  negative_percentage?: number;
  neutral_percentage?: number;
}

/**
 * Mood statistics response interface
 */
export interface MoodStatisticsResponse {
  totalMoods: number;
  averageSentiment: number;
  currentStreak: number;
  longestStreak: number;
  positivePercentage: number;
  negativePercentage: number;
  neutralPercentage: number;
  bestDay: string | null;
  worstDay: string | null;
  recentTrend: 'improving' | 'declining' | 'stable';
  // snake_case aliases for backwards compatibility
  total_moods?: number;
  average_sentiment?: number;
  current_streak?: number;
  longest_streak?: number;
  positive_percentage?: number;
  negative_percentage?: number;
  neutral_percentage?: number;
  best_day?: string | null;
  worst_day?: string | null;
  recent_trend?: string;
}

/**
 * Mood streaks response interface
 */
export interface MoodStreaksResponse {
  currentStreak: number;
  longestStreak: number;
  totalLoggedDays: number;
  consistencyPercentage: number;
  lastLogDate: string | null;
  // snake_case aliases for backwards compatibility
  current_streak?: number;
  longest_streak?: number;
  total_logged_days?: number;
  consistency_percentage?: number;
  last_log_date?: string | null;
}

/**
 * Today mood response interface
 */
export interface TodayMoodResponse {
  hasMoodToday: boolean;
  mood?: any;
  message?: string;
  // snake_case aliases for backwards compatibility
  has_mood_today?: boolean;
}

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
    return response.data?.data || response.data;
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
    const data = response.data?.data || response.data;
    return data.moods || [];
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
    const data = response.data?.data || response.data;
    // Handle both camelCase (new) and snake_case (legacy) response formats
    return {
      totalMoods: data.totalMoods ?? data.total_moods ?? 0,
      averageSentiment: data.averageSentiment ?? data.average_sentiment ?? 0,
      trend: data.trend ?? 'stable',
      insights: data.insights ?? 'Log your mood to get personal insights!',
      recentMemories: data.recentMemories ?? data.recent_memories ?? [],
      positiveCount: data.positiveCount ?? data.positive_count ?? 0,
      negativeCount: data.negativeCount ?? data.negative_count ?? 0,
      neutralCount: data.neutralCount ?? data.neutral_count ?? 0,
      positivePercentage: data.positivePercentage ?? data.positive_percentage ?? 0,
      negativePercentage: data.negativePercentage ?? data.negative_percentage ?? 0,
      neutralPercentage: data.neutralPercentage ?? data.neutral_percentage ?? 0,
      fallback: data.fallback ?? false,
      confidence: data.confidence ?? 0
    };
  } catch (error: unknown) {
    const apiError = error as any;
    console.error("❌ API Weekly Analysis error:", apiError);
    // Return fallback data instead of throwing error
    return {
      totalMoods: 0,
      averageSentiment: 0,
      trend: 'stable',
      insights: 'Log your mood to get personal insights!',
      recentMemories: [],
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
    const data = response.data?.data || response.data;
    // Handle both camelCase (new) and snake_case (legacy) response formats
    return {
      totalMoods: data.totalMoods ?? data.total_moods ?? 0,
      averageSentiment: data.averageSentiment ?? data.average_sentiment ?? 0,
      currentStreak: data.currentStreak ?? data.current_streak ?? 0,
      longestStreak: data.longestStreak ?? data.longest_streak ?? 0,
      positivePercentage: data.positivePercentage ?? data.positive_percentage ?? 0,
      negativePercentage: data.negativePercentage ?? data.negative_percentage ?? 0,
      neutralPercentage: data.neutralPercentage ?? data.neutral_percentage ?? 0,
      bestDay: data.bestDay ?? data.best_day ?? null,
      worstDay: data.worstDay ?? data.worst_day ?? null,
      recentTrend: data.recentTrend ?? data.recent_trend ?? 'stable'
    };
  } catch (error: unknown) {
    const apiError = error as any;
    throw new Error((apiError.response?.data as any)?.error || "An error occurred while fetching statistics.");
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
    return response.data?.data || response.data;
  } catch (error: unknown) {
    const apiError = error as any;
    throw new Error((apiError.response?.data as any)?.error || "An error occurred during text analysis.");
  }
};
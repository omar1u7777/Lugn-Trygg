import { api } from "./client";
import { ApiError } from "./errors";
import { API_ENDPOINTS } from "./constants";
import { logger } from "../utils/logger";
import { getApiErrorMessage } from "./errorUtils";

type GenericObject = Record<string, unknown>;

/**
 * Mood entry data for logging
 */
export interface MoodData {
  score?: number;
  note?: string;
  emotions?: string[];
  activities?: string[];
  [key: string]: unknown;
}

/**
 * Weekly analysis response interface
 */
export interface WeeklyAnalysisResponse {
  totalMoods: number;
  averageSentiment: number;
  trend: 'improving' | 'declining' | 'stable';
  insights: string;
  recentMemories: GenericObject[];
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
  recent_memories?: GenericObject[];
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
  mood?: GenericObject;
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
export const logMood = async (userId: string, moodData: MoodData, audioBlob?: Blob): Promise<GenericObject> => {
  try {
    if (audioBlob) {
      const formData = new FormData();
      formData.append('score', String(moodData.score ?? ''));
      if (moodData.mood_text) formData.append('mood_text', moodData.mood_text);
      if (moodData.note) formData.append('note', moodData.note);
      if (moodData.valence !== undefined) formData.append('valence', String(moodData.valence));
      if (moodData.arousal !== undefined) formData.append('arousal', String(moodData.arousal));
      if (moodData.tags && moodData.tags.length > 0) formData.append('tags', JSON.stringify(moodData.tags));
      if (moodData.context) formData.append('context', moodData.context);
      formData.append('audio', audioBlob, 'recording.webm');

      const response = await api.post(API_ENDPOINTS.MOOD.LOG_MOOD, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return (response.data?.data || response.data) as GenericObject;
    }

    const response = await api.post(API_ENDPOINTS.MOOD.LOG_MOOD, {
      user_id: userId,
      ...moodData
    });
    return (response.data?.data || response.data) as GenericObject;
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
    return Array.isArray(data.moods) ? (data.moods as GenericObject[]) : [];
  } catch (error: unknown) {
    logger.error("API Mood Fetch error:", error);
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
    logger.error("API Weekly Analysis error:", error);
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
    throw new Error(getApiErrorMessage(error, "An error occurred while fetching statistics."));
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
    throw new Error(getApiErrorMessage(error, "An error occurred during text analysis."));
  }
};


/**
 * Export mood entries as CSV for data portability
 * @param userId - User ID
 * @returns Promise resolving to CSV string
 */
export const exportMoodData = async (userId: string, format: 'csv' | 'json' = 'csv'): Promise<string> => {
  try {
    const moods = await getMoods(userId);
    
    if (format === 'json') {
      return JSON.stringify(moods, null, 2);
    }
    
    // CSV export
    const headers = ['Datum', 'Humör', 'Poäng', 'Anteckning', 'Taggar', 'Valens', 'Arousal'];
    const rows = moods.map((m: { timestamp?: string | Date; mood_text?: string; score?: number; note?: string; tags?: string[]; valence?: number; arousal?: number }) => {
      const date = m.timestamp ? new Date(m.timestamp).toLocaleDateString('sv-SE') : '';
      const mood = m.mood_text || '';
      const score = m.score ?? '';
      const note = (m.note || '').replace(/"/g, '""');
      const tags = (m.tags || []).join(', ');
      const valence = m.valence ?? '';
      const arousal = m.arousal ?? '';
      return `"${date}","${mood}",${score},"${note}","${tags}",${valence},${arousal}`;
    });
    
    return [headers.join(','), ...rows].join('\n');
  } catch (error: unknown) {
    throw new Error(getApiErrorMessage(error, "An error occurred while exporting mood data."));
  }
};
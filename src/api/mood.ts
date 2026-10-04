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
export const logMood = async (userId: string, moodData: MoodData, audioBlob?: Blob, signal?: AbortSignal): Promise<GenericObject> => {
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

      const response = await api.post(API_ENDPOINTS.MOOD.LOG_MOOD, formData, signal ? { signal } : undefined);
      return (response.data?.data || response.data) as GenericObject;
    }

    const response = await api.post(API_ENDPOINTS.MOOD.LOG_MOOD, {
      user_id: userId,
      ...moodData
    }, signal ? { signal } : undefined);
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
export const getMoods = async (_userId: string, signal?: AbortSignal) => {
  try {
    // Token added automatically by interceptor
    // Backend route is /api/mood (GET) - user_id comes from JWT token, not query param
    const response = await api.get(API_ENDPOINTS.MOOD.GET_MOODS, signal ? { signal } : undefined);
    const data = response.data?.data || response.data;
    return Array.isArray(data.moods) ? (data.moods as GenericObject[]) : [];
  } catch (error: unknown) {
    // Ignore abort errors
    if (error instanceof Error && error.name === 'AbortError') return [];
    logger.error("API Mood Fetch error:", error);
    // Return empty array for graceful degradation
    return [];
  }
};

/**
 * How many mood entries the user has, from the server's count.
 *
 * Counters read `getMoods(...).length`, which is the first page — 50 — so
 * /journal and /social said "50 Humörloggar" to someone with 122, while
 * /profile, reading an aggregate, said 122 (UI audit D-1). One entry is
 * requested; only the envelope's `total` is used.
 *
 * Returns null when the server could not count (it omits `total` rather than
 * guess); callers show that as unavailable rather than as a number.
 */
export const getMoodTotal = async (signal?: AbortSignal): Promise<number | null> => {
  const response = await api.get(`${API_ENDPOINTS.MOOD.GET_MOODS}?limit=1`, signal ? { signal } : undefined);
  const data = response.data?.data || response.data;
  return typeof data?.total === 'number' ? data.total : null;
};

/** The backend caps `limit` at 100; asking for more silently gets 100. */
const MOOD_PAGE_SIZE = 100;

/**
 * Hard stop on how many entries one call will assemble.
 *
 * Consumers of this function filter and aggregate the whole set in the browser,
 * so it has to be bounded by something. 5,000 daily entries is roughly thirteen
 * years of use — far past the point where the client should be doing the
 * aggregating at all. Reaching it is a signal to move those sums server-side,
 * so it warns rather than truncating quietly.
 */
const MAX_MOODS_FETCHED = 5000;

/**
 * Retrieve every mood entry, paging until the server says there are no more.
 *
 * `getMoods` above issues one request with no `limit`, so the backend applies
 * its default of 50 — and the response envelope, including `total` and
 * `has_more`, was discarded. Callers received an array of 50 and treated it as
 * the user's entire history: /mood-list showed "Totalt 50" for someone with
 * 121 entries, and every average, sentiment split and streak was computed over
 * that slice. Fixing the server's `total` (it used to report the page size)
 * makes the number honest; this makes the DATA complete.
 */
export const getAllMoods = async (
  _userId: string,
  signal?: AbortSignal
): Promise<GenericObject[]> => {
  const collected: GenericObject[] = [];
  let offset = 0;

  try {
    for (;;) {
      const response = await api.get(
        `${API_ENDPOINTS.MOOD.GET_MOODS}?limit=${MOOD_PAGE_SIZE}&offset=${offset}`,
        signal ? { signal } : undefined
      );
      const data = response.data?.data || response.data;
      const page: GenericObject[] = Array.isArray(data?.moods) ? data.moods : [];
      collected.push(...page);

      // Stop on an empty or short page even if has_more disagrees: trusting a
      // flag alone turns one server-side mistake into an infinite loop.
      if (page.length === 0 || page.length < MOOD_PAGE_SIZE) break;
      if (data?.has_more === false) break;

      offset += page.length;
      if (collected.length >= MAX_MOODS_FETCHED) {
        logger.warn(
          `Mood history hit the ${MAX_MOODS_FETCHED}-entry client cap; ` +
          'aggregates below this point are incomplete and should move server-side.'
        );
        break;
      }
    }
    return collected;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') return collected;
    logger.error('API Mood Fetch error:', error);
    // Whatever was already read beats nothing — the caller degrades to a
    // partial history rather than an empty one.
    return collected;
  }
};

/**
 * Deletes a single mood entry by ID
 * @param moodId - The mood entry ID to delete
 * @returns Promise resolving when deletion is complete
 */
export const deleteMood = async (moodId: string): Promise<void> => {
  try {
    await api.delete(`${API_ENDPOINTS.MOOD.GET_MOODS}/${moodId}`);
  } catch (error: unknown) {
    if (error instanceof ApiError) throw error;
    throw ApiError.fromAxiosError(error);
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
    
    // CSV export - use English headers for data portability
    const headers = ['Date', 'Mood', 'Score', 'Note', 'Tags', 'Valence', 'Arousal'];
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
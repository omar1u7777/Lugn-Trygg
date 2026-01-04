import { api } from "./client";
import { ApiError } from "./errors";
import { API_ENDPOINTS } from "./constants";

// ============================================================================
// Types (camelCase primary, snake_case for backwards compatibility)
// ============================================================================

export interface LeaderboardUser {
  rank: number;
  // Primary camelCase format (from APIResponse)
  userId?: string;
  displayName?: string;
  // Legacy snake_case format (backwards compatibility)
  user_id?: string;
  display_name?: string;
  avatar: string;
}

export interface XPLeaderboardUser extends LeaderboardUser {
  xp: number;
  level: number;
  // Primary camelCase
  badgeCount?: number;
  // Legacy snake_case
  badge_count?: number;
}

export interface StreakLeaderboardUser extends LeaderboardUser {
  // Primary camelCase
  currentStreak?: number;
  longestStreak?: number;
  // Legacy snake_case
  current_streak?: number;
  longest_streak?: number;
}

export interface MoodLeaderboardUser extends LeaderboardUser {
  // Primary camelCase
  moodCount?: number;
  averageMood?: number;
  // Legacy snake_case
  mood_count?: number;
  average_mood?: number;
}

export interface LeaderboardResponse<T> {
  success: boolean;
  data: {
    leaderboard: T[];
    timeframe?: string;
    // Primary camelCase
    updatedAt?: string;
    // Legacy snake_case
    updated_at?: string;
  };
  message: string;
}

export interface UserRanking {
  rank: number;
  value: number;
  percentile: number;
}

export interface UserRankingsResponse {
  success: boolean;
  data: {
    // Primary camelCase
    userId?: string;
    totalUsers?: number;
    // Legacy snake_case
    user_id?: string;
    total_users?: number;
    rankings: {
      xp: UserRanking;
      streak: UserRanking;
      moods: UserRanking;
    };
  };
  message: string;
}

export interface WeeklyWinner {
  // Primary camelCase
  displayName?: string;
  // Legacy snake_case
  display_name?: string;
  xp: number;
  avatar: string;
}

export interface WeeklyWinnersResponse {
  success: boolean;
  data: {
    // Primary camelCase
    weekStart?: string;
    weekEnd?: string;
    // Legacy snake_case
    week_start?: string;
    week_end?: string;
    winners: {
      xp: WeeklyWinner[];
    };
  };
  message: string;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get XP leaderboard
 * @param limit - Maximum number of users to retrieve (default: 20, max: 100)
 * @param timeframe - Filter by timeframe: 'all', 'weekly', 'monthly'
 * @returns Promise resolving to XP leaderboard data
 * @throws Error if leaderboard retrieval fails
 */
export const getXPLeaderboard = async (
  limit: number = 20,
  timeframe: 'all' | 'weekly' | 'monthly' = 'all'
): Promise<LeaderboardResponse<XPLeaderboardUser>> => {
  try {
    const response = await api.get<LeaderboardResponse<XPLeaderboardUser>>(
      `${API_ENDPOINTS.LEADERBOARD.XP_LEADERBOARD}?limit=${limit}&timeframe=${timeframe}`
    );
    return response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Get streak leaderboard
 * @param limit - Maximum number of users to retrieve (default: 20, max: 100)
 * @returns Promise resolving to streak leaderboard data
 * @throws Error if leaderboard retrieval fails
 */
export const getStreakLeaderboard = async (
  limit: number = 20
): Promise<LeaderboardResponse<StreakLeaderboardUser>> => {
  try {
    const response = await api.get<LeaderboardResponse<StreakLeaderboardUser>>(
      `${API_ENDPOINTS.LEADERBOARD.STREAK_LEADERBOARD}?limit=${limit}`
    );
    return response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Get mood leaderboard
 * @param limit - Maximum number of users to retrieve (default: 20, max: 100)
 * @returns Promise resolving to mood leaderboard data
 * @throws Error if leaderboard retrieval fails
 */
export const getMoodLeaderboard = async (
  limit: number = 20
): Promise<LeaderboardResponse<MoodLeaderboardUser>> => {
  try {
    const response = await api.get<LeaderboardResponse<MoodLeaderboardUser>>(
      `${API_ENDPOINTS.LEADERBOARD.MOOD_LEADERBOARD}?limit=${limit}`
    );
    return response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Get user ranking
 * @param userId - User ID
 * @returns Promise resolving to user ranking data
 * @throws Error if ranking retrieval fails
 */
export const getUserRanking = async (userId: string): Promise<UserRankingsResponse> => {
  try {
    const response = await api.get<UserRankingsResponse>(
      `${API_ENDPOINTS.LEADERBOARD.USER_RANKING}/${userId}`
    );
    return response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Get weekly winners
 * @returns Promise resolving to weekly winners data
 * @throws Error if winners retrieval fails
 */
export const getWeeklyWinners = async (): Promise<WeeklyWinnersResponse> => {
  try {
    const response = await api.get<WeeklyWinnersResponse>(
      API_ENDPOINTS.LEADERBOARD.WEEKLY_WINNERS
    );
    return response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

// ============================================================================
// Exported API Object
// ============================================================================

/**
 * Leaderboard API object with all operations
 */
export const leaderboardApi = {
  getXPLeaderboard,
  getStreakLeaderboard,
  getMoodLeaderboard,
  getUserRanking,
  getWeeklyWinners,
};

export default leaderboardApi;
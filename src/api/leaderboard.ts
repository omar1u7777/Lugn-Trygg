import { api } from "./client";
import { ApiError } from "./errors";
import { API_ENDPOINTS } from "./constants";

/**
 * Get XP leaderboard
 * @returns Promise resolving to XP leaderboard data
 * @throws Error if leaderboard retrieval fails
 */
export const getXPLeaderboard = async () => {
  try {
    const response = await api.get(API_ENDPOINTS.LEADERBOARD.XP_LEADERBOARD);
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
 * @returns Promise resolving to streak leaderboard data
 * @throws Error if leaderboard retrieval fails
 */
export const getStreakLeaderboard = async () => {
  try {
    const response = await api.get(API_ENDPOINTS.LEADERBOARD.STREAK_LEADERBOARD);
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
 * @returns Promise resolving to mood leaderboard data
 * @throws Error if leaderboard retrieval fails
 */
export const getMoodLeaderboard = async () => {
  try {
    const response = await api.get(API_ENDPOINTS.LEADERBOARD.MOOD_LEADERBOARD);
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
export const getUserRanking = async (userId: string) => {
  try {
    const response = await api.get(`${API_ENDPOINTS.LEADERBOARD.USER_RANKING}/${userId}`);
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
export const getWeeklyWinners = async () => {
  try {
    const response = await api.get(API_ENDPOINTS.LEADERBOARD.WEEKLY_WINNERS);
    return response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};
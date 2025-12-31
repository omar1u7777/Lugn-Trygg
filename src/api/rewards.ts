import { api } from "./client";
import { ApiError } from "./errors";

export interface UserReward {
  id: string;
  title: string;
  description: string;
  points: number;
  claimedAt: Date;
}

export interface RewardItem {
  id: string;
  title: string;
  description: string;
  pointsRequired: number;
  category: string;
}

/**
 * Get user's rewards
 * @param userId - User ID
 * @returns Promise resolving to user rewards
 */
export const getUserRewards = async (userId: string): Promise<UserReward[]> => {
  try {
    const response = await api.get(`/api/rewards/user/${userId}`);
    return response.data.rewards || [];
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Get reward catalog
 * @returns Promise resolving to reward catalog
 */
export const getRewardCatalog = async (): Promise<RewardItem[]> => {
  try {
    const response = await api.get('/api/rewards/catalog');
    return response.data.catalog || [];
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Claim a reward
 * @param rewardId - Reward ID to claim
 * @returns Promise resolving to claim result
 */
export const claimReward = async (rewardId: string) => {
  try {
    const response = await api.post(`/api/rewards/claim/${rewardId}`);
    return response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Check user achievements
 * @param userId - User ID
 * @returns Promise resolving to achievements
 */
export const checkAchievements = async (userId: string) => {
  try {
    const response = await api.get(`/api/achievements/check/${userId}`);
    return response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};
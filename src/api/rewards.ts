import { api } from "./client";
import { ApiError } from "./errors";
import { API_ENDPOINTS } from "./constants";

export interface UserReward {
  userId: string;
  xp: number;
  level: number;
  nextLevelXp: number;
  progressXp: number;
  neededXp: number;
  progressPercent: number;
  badges: string[];
  achievements: string[];
  claimedRewards: string[];
  premiumUntil: string | null;
}

export interface RewardItem {
  id: string;
  title: string;
  description: string;
  cost: number;
  type: string;
  value: number | string;
  icon: string;
  available: boolean;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  xp_reward: number;
  badge: string;
  condition: {
    type: string;
    value: number;
  };
}

export interface ClaimRewardResult {
  message: string;
  reward: RewardItem;
  newXp: number;
  premiumUntil?: string;
}

export interface CheckAchievementsResult {
  newAchievements: Achievement[];
  totalXpEarned: number;
  allAchievements: string[];
  badges: string[];
}

/**
 * Get user's rewards profile
 * @returns Promise resolving to user rewards profile
 */
export const getUserRewards = async (): Promise<UserReward> => {
  try {
    const response = await api.get(API_ENDPOINTS.REWARDS.PROFILE);
    // Backend returns { success: true, data: { rewards: {...} }, message: "..." }
    return response.data.data?.rewards || response.data.rewards || {};
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
    const response = await api.get(API_ENDPOINTS.REWARDS.REWARD_CATALOG);
    // Backend returns { success: true, data: { rewards: [...] }, message: "..." }
    return response.data.data?.rewards || response.data.rewards || [];
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Get all achievements
 * @returns Promise resolving to achievements list
 */
export const getAchievements = async (): Promise<Achievement[]> => {
  try {
    const response = await api.get(API_ENDPOINTS.REWARDS.ACHIEVEMENTS);
    // Backend returns { success: true, data: { achievements: [...] }, message: "..." }
    return response.data.data?.achievements || response.data.achievements || [];
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
export const claimReward = async (rewardId: string): Promise<ClaimRewardResult> => {
  try {
    const response = await api.post(API_ENDPOINTS.REWARDS.CLAIM, {
      reward_id: rewardId
    });
    return response.data.data || response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Add XP to user
 * @param amount - XP amount to add
 * @param reason - Reason for XP addition
 * @returns Promise resolving to XP result
 */
export const addXp = async (amount: number, reason: string = 'general') => {
  try {
    const response = await api.post(API_ENDPOINTS.REWARDS.ADD_XP, {
      amount,
      reason
    });
    return response.data.data || response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Check and award user achievements
 * @param stats - User stats to check against
 * @returns Promise resolving to achievements result
 */
export const checkAchievements = async (
  stats: {
    mood_count?: number;
    streak?: number;
    journal_count?: number;
    referral_count?: number;
    meditation_count?: number;
  } = {}
): Promise<CheckAchievementsResult> => {
  try {
    const response = await api.post(API_ENDPOINTS.REWARDS.CHECK_ACHIEVEMENTS, stats);
    return response.data.data || response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Get user badges
 * @returns Promise resolving to badges list
 */
export const getUserBadges = async () => {
  try {
    const response = await api.get(API_ENDPOINTS.REWARDS.BADGES);
    return response.data.data?.badges || response.data.badges || [];
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};
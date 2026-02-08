import { api } from "./client";
import { ApiError } from "./errors";
import { API_ENDPOINTS } from "./constants";

export interface LeaderboardEntry {
  userId: string;
  username: string;
  score: number;
  rank: number;
}

export interface ReferralStats {
  totalReferrals: number;
  successfulReferrals: number;
  referralCode: string;
  earnings: number;
}

/**
 * Get leaderboard
 * @param type - Leaderboard type
 * @returns Promise resolving to leaderboard
 */
export const getLeaderboard = async (type: string = 'xp'): Promise<LeaderboardEntry[]> => {
  try {
    const response = await api.get(`${API_ENDPOINTS.LEADERBOARD.BASE}/${type}`);
    const data = response.data?.data || response.data;
    return data.leaderboard || [];
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Get referral stats
 * @param userId - User ID
 * @returns Promise resolving to referral stats
 */
export const getReferralStats = async (userId: string): Promise<ReferralStats> => {
  try {
    const response = await api.get(`${API_ENDPOINTS.REFERRAL.STATS}?user_id=${userId}`);
    // Handle APIResponse wrapper: { success: true, data: {...} }
    const data = response.data?.data || response.data;
    return data || {
      totalReferrals: 0,
      successfulReferrals: 0,
      referralCode: '',
      earnings: 0
    };
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};
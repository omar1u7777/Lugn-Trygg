import { api } from "./client";
import { ApiError } from "./errors";
import { API_ENDPOINTS } from "./constants";

export interface ReferralStats {
  totalReferrals: number;
  successfulReferrals: number;
  referralCode: string;
  earnings: number;
}

/**
 * Get referral stats
 * @returns Promise resolving to referral stats
 */
export const getReferralStats = async (): Promise<ReferralStats> => {
  try {
    const response = await api.get(API_ENDPOINTS.REFERRAL.STATS);
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
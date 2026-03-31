import { api } from "./client";
import { API_ENDPOINTS } from "./constants";
import { logger } from "../utils/logger";
import { getApiErrorMessage } from "./errorUtils";

// ============================================================================
// Types
// ============================================================================

/**
 * User profile interface
 */
export interface UserProfile {
  userId: string;
  displayName: string;
  email: string;
  language: string;
  timezone: string;
  preferences: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * User preferences interface
 */
export interface UserPreferences {
  [key: string]: unknown;
}

/**
 * User statistics interface
 */
export interface UserStats {
  totalMoods: number;
  totalConversations: number;
  totalMemories: number;
  accountAge: number;
  lastActiveAt?: string;
  streakDays?: number;
}

/**
 * Notification settings interface
 */
export interface NotificationSettings {
  morningReminder?: string;
  eveningReminder?: string;
  moodCheckInTime?: string;
  enableMoodReminders?: boolean;
  enableMeditationReminders?: boolean;
}

/**
 * Notification preferences interface
 */
export interface NotificationPreferences {
  enablePushNotifications?: boolean;
  enableEmailNotifications?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

/**
 * Notification schedule interface
 */
export interface NotificationSchedule {
  type: 'mood' | 'meditation' | 'journal' | 'custom';
  time: string;
  enabled: boolean;
  message?: string;
}

/**
 * API response wrapper
 */
export interface UserApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

// ============================================================================
// User Profile & Preferences
// ============================================================================

/**
 * Get user profile
 * @returns Promise resolving to user profile data
 * @throws Error if profile retrieval fails
 */
export const getUserProfile = async (): Promise<UserProfile> => {
  logger.debug('getUserProfile called');
  try {
    const response = await api.get<UserApiResponse<{ profile: UserProfile }>>(
      `${API_ENDPOINTS.USERS.WELLNESS_GOALS}/profile`
    );
    logger.debug('User profile retrieved successfully');
    const data = response.data?.data || response.data;
    return data.profile || data;
  } catch (error: unknown) {
    logger.error("Get user profile error:", error);
    throw new Error(getApiErrorMessage(error, "Failed to get user profile"));
  }
};

/**
 * Get user statistics (aggregated)
 * @returns Promise resolving to user statistics
 * @throws Error if stats retrieval fails
 */
export const getUserStats = async (): Promise<UserStats> => {
  logger.debug('getUserStats called');
  try {
    const response = await api.get<UserApiResponse<UserStats>>(
      `${API_ENDPOINTS.USERS.WELLNESS_GOALS}/stats`
    );
    logger.debug('User stats retrieved successfully');
    const data = response.data?.data || response.data;
    return data;
  } catch (error: unknown) {
    logger.error("Get user stats error:", error);
    throw new Error(getApiErrorMessage(error, "Failed to get user statistics"));
  }
};

/**
 * Update user preferences
 * @param preferences - Preferences to update
 * @returns Promise resolving to updated preferences
 * @throws Error if preferences update fails
 */
export const updateUserPreferences = async (preferences: UserPreferences): Promise<UserPreferences> => {
  logger.debug('updateUserPreferences called');
  try {
    const response = await api.put<UserApiResponse<{ preferences: UserPreferences }>>(
      `${API_ENDPOINTS.USERS.WELLNESS_GOALS}/preferences`,
      preferences
    );
    logger.debug('User preferences updated successfully');
    const data = response.data?.data || response.data;
    return data.preferences || data;
  } catch (error: unknown) {
    logger.error("Update user preferences error:", error);
    throw new Error(getApiErrorMessage(error, "Failed to update user preferences"));
  }
};

// ============================================================================
// Notification Preferences
// ============================================================================

/**
 * Update notification preferences
 * @param preferences - Notification preferences to update
 * @returns Promise resolving to success message
 * @throws Error if notification preferences update fails
 */
export const updateNotificationPreferences = async (preferences: NotificationPreferences): Promise<void> => {
  logger.debug('updateNotificationPreferences called');
  try {
    await api.put(
      `${API_ENDPOINTS.USERS.WELLNESS_GOALS}/notification-preferences`,
      preferences
    );
    logger.debug('Notification preferences updated successfully');
  } catch (error: unknown) {
    logger.error("Update notification preferences error:", error);
    throw new Error(getApiErrorMessage(error, "Failed to update notification preferences"));
  }
};

/**
 * Set notification schedule
 * @param schedule - Notification schedule to set
 * @returns Promise resolving to success message
 * @throws Error if notification schedule setting fails
 */
export const setNotificationSchedule = async (schedule: NotificationSchedule): Promise<void> => {
  logger.debug('setNotificationSchedule called');
  try {
    await api.post(
      `${API_ENDPOINTS.USERS.WELLNESS_GOALS}/notification-schedule`,
      schedule
    );
    logger.debug('Notification schedule set successfully');
  } catch (error: unknown) {
    logger.error("Set notification schedule error:", error);
    throw new Error(getApiErrorMessage(error, "Failed to set notification schedule"));
  }
};

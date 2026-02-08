import { api } from "./client";
import { API_ENDPOINTS } from "./constants";

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
  preferences: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * User preferences interface
 */
export interface UserPreferences {
  [key: string]: any;
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
  console.log('👤 API - getUserProfile called');
  try {
    const response = await api.get<UserApiResponse<{ profile: UserProfile }>>(
      `${API_ENDPOINTS.USERS.WELLNESS_GOALS}/profile`
    );
    console.log('✅ User profile retrieved successfully');
    const data = response.data?.data || response.data;
    return data.profile || data;
  } catch (error: unknown) {
    const apiError = error as { response?: { data?: { error?: string } } };
    console.error("❌ Get user profile error:", apiError);
    throw new Error(apiError.response?.data?.error || "Failed to get user profile");
  }
};

/**
 * Update user preferences
 * @param preferences - Preferences to update
 * @returns Promise resolving to updated preferences
 * @throws Error if preferences update fails
 */
export const updateUserPreferences = async (preferences: UserPreferences): Promise<UserPreferences> => {
  console.log('👤 API - updateUserPreferences called', { preferences });
  try {
    const response = await api.put<UserApiResponse<{ preferences: UserPreferences }>>(
      `${API_ENDPOINTS.USERS.WELLNESS_GOALS}/preferences`,
      preferences
    );
    console.log('✅ User preferences updated successfully');
    const data = response.data?.data || response.data;
    return data.preferences || data;
  } catch (error: unknown) {
    const apiError = error as { response?: { data?: { error?: string } } };
    console.error("❌ Update user preferences error:", apiError);
    throw new Error(apiError.response?.data?.error || "Failed to update user preferences");
  }
};

// ============================================================================
// Notification Settings
// ============================================================================

/**
 * Get notification settings
 * @returns Promise resolving to notification settings
 * @throws Error if notification settings retrieval fails
 */
export const getNotificationSettings = async (): Promise<NotificationSettings> => {
  console.log('🔔 API - getNotificationSettings called');
  try {
    const response = await api.get<UserApiResponse<NotificationSettings>>(
      `${API_ENDPOINTS.USERS.WELLNESS_GOALS}/notification-settings`
    );
    console.log('✅ Notification settings retrieved successfully');
    return response.data?.data || response.data;
  } catch (error: unknown) {
    const apiError = error as { response?: { data?: { error?: string } } };
    console.error("❌ Get notification settings error:", apiError);
    throw new Error(apiError.response?.data?.error || "Failed to get notification settings");
  }
};

/**
 * Update notification preferences
 * @param preferences - Notification preferences to update
 * @returns Promise resolving to success message
 * @throws Error if notification preferences update fails
 */
export const updateNotificationPreferences = async (preferences: NotificationPreferences): Promise<void> => {
  console.log('🔔 API - updateNotificationPreferences called', { preferences });
  try {
    await api.put(
      `${API_ENDPOINTS.USERS.WELLNESS_GOALS}/notification-preferences`,
      preferences
    );
    console.log('✅ Notification preferences updated successfully');
  } catch (error: unknown) {
    const apiError = error as { response?: { data?: { error?: string } } };
    console.error("❌ Update notification preferences error:", apiError);
    throw new Error(apiError.response?.data?.error || "Failed to update notification preferences");
  }
};

/**
 * Set notification schedule
 * @param schedule - Notification schedule to set
 * @returns Promise resolving to success message
 * @throws Error if notification schedule setting fails
 */
export const setNotificationSchedule = async (schedule: NotificationSchedule): Promise<void> => {
  console.log('🔔 API - setNotificationSchedule called', { schedule });
  try {
    await api.post(
      `${API_ENDPOINTS.USERS.WELLNESS_GOALS}/notification-schedule`,
      schedule
    );
    console.log('✅ Notification schedule set successfully');
  } catch (error: unknown) {
    const apiError = error as { response?: { data?: { error?: string } } };
    console.error("❌ Set notification schedule error:", apiError);
    throw new Error(apiError.response?.data?.error || "Failed to set notification schedule");
  }
};

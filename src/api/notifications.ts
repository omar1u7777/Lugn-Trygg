import { api } from "./client";
import { API_ENDPOINTS } from "./constants";

/**
 * Save FCM token for push notifications
 * @param fcmToken - Firebase Cloud Messaging token
 * @returns Promise resolving to response data
 * @throws Error if FCM token save fails
 */
export const saveFCMToken = async (fcmToken: string) => {
  console.log('🔔 API - saveFCMToken called');
  try {
    const response = await api.post(API_ENDPOINTS.NOTIFICATIONS.FCM_TOKEN, {
      fcmToken
    });
    console.log('✅ FCM token saved successfully');
    return response.data;
  } catch (error: unknown) {
    const apiError = error as any;
    console.error("❌ Save FCM token error:", apiError);
    throw new Error((apiError.response?.data as any)?.error || "Failed to save notification token");
  }
};

/**
 * Send a reminder notification
 * @param userId - User ID
 * @param message - Reminder message
 * @param type - Reminder type (default: 'daily')
 * @returns Promise resolving to response data
 * @throws Error if reminder send fails
 */
export const sendReminder = async (userId: string, message: string, type: string = 'daily') => {
  console.log('🔔 API - sendReminder called', { userId, type });
  try {
    const response = await api.post(API_ENDPOINTS.NOTIFICATIONS.SEND_REMINDER, {
      userId,
      message,
      type
    });
    console.log('✅ Reminder sent successfully');
    return response.data;
  } catch (error: unknown) {
    const apiError = error as any;
    console.error("❌ Send reminder error:", apiError);
    throw new Error((apiError.response?.data as any)?.error || "Failed to send reminder");
  }
};

/**
 * Schedule daily notifications
 * @param userId - User ID
 * @param enabled - Whether to enable daily notifications
 * @param time - Time for notifications (default: '09:00')
 * @returns Promise resolving to response data
 * @throws Error if scheduling fails
 */
export const scheduleDailyNotifications = async (userId: string, enabled: boolean, time: string = '09:00') => {
  console.log('🔔 API - scheduleDailyNotifications called', { userId, enabled, time });
  try {
    const response = await api.post(API_ENDPOINTS.NOTIFICATIONS.SCHEDULE_DAILY, {
      userId,
      enabled,
      time
    });
    console.log('✅ Daily notifications scheduled successfully');
    return response.data;
  } catch (error: unknown) {
    const apiError = error as any;
    console.error("❌ Schedule daily notifications error:", apiError);
    throw new Error((apiError.response?.data as any)?.error || "Failed to schedule daily notifications");
  }
};

/**
 * Disable all notifications
 * @param userId - User ID
 * @returns Promise resolving to response data
 * @throws Error if disabling fails
 */
export const disableAllNotifications = async (userId: string) => {
  console.log('🔔 API - disableAllNotifications called', { userId });
  try {
    const response = await api.post(API_ENDPOINTS.NOTIFICATIONS.DISABLE_ALL, {
      userId
    });
    console.log('✅ All notifications disabled successfully');
    return response.data;
  } catch (error: unknown) {
    const apiError = error as any;
    console.error("❌ Disable notifications error:", apiError);
    throw new Error((apiError.response?.data as any)?.error || "Failed to disable notifications");
  }
};

/**
 * Get notification settings
 * @param userId - User ID
 * @returns Promise resolving to notification settings
 * @throws Error if settings retrieval fails
 */
export const getNotificationSettings = async (userId: string) => {
  console.log('🔔 API - getNotificationSettings called', { userId });
  try {
    const response = await api.get(`${API_ENDPOINTS.NOTIFICATIONS.NOTIFICATION_SETTINGS}?userId=${userId}`);
    console.log('✅ Notification settings retrieved:', response.data);
    return response.data;
  } catch (error: unknown) {
    const apiError = error as any;
    console.error("❌ Get notification settings error:", apiError);
    // Return default settings if endpoint doesn't exist yet
    return {
      dailyRemindersEnabled: false,
      reminderTime: '09:00',
      lastReminderSent: null
    };
  }
};

/**
 * Update notification settings
 * @param userId - User ID
 * @param settings - Notification settings to update
 * @returns Promise resolving to response data
 * @throws Error if settings update fails
 */
export const updateNotificationSettings = async (userId: string, settings: {
  dailyRemindersEnabled: boolean;
  reminderTime: string;
}) => {
  console.log('🔔 API - updateNotificationSettings called', { userId, settings });
  try {
    const response = await api.post(API_ENDPOINTS.NOTIFICATIONS.NOTIFICATION_SETTINGS, {
      userId,
      ...settings
    });
    console.log('✅ Notification settings updated successfully');
    return response.data;
  } catch (error: unknown) {
    const apiError = error as any;
    console.error("❌ Update notification settings error:", apiError);
    throw new Error((apiError.response?.data as any)?.error || "Failed to update notification settings");
  }
};
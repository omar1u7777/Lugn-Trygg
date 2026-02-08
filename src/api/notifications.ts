import { api } from "./client";
import { API_ENDPOINTS } from "./constants";
import { logger } from "../utils/logger";

/**
 * Notification settings response interface
 */
export interface NotificationSettingsResponse {
  dailyRemindersEnabled: boolean;
  reminderTime: string;
  hasFcmToken: boolean;
  lastReminderSent: string | null;
}

/**
 * Send reminder response interface
 */
export interface SendReminderResponse {
  sent: boolean;
  notificationId?: string;
  reason?: string;
}

/**
 * Schedule daily response interface
 */
export interface ScheduleDailyResponse {
  enabled: boolean;
  time: string;
}

/**
 * Save FCM token for push notifications
 * @param fcmToken - Firebase Cloud Messaging token
 * @returns Promise resolving to response data
 * @throws Error if FCM token save fails
 */
export const saveFCMToken = async (fcmToken: string) => {
  logger.debug('saveFCMToken called');
  try {
    const response = await api.post(API_ENDPOINTS.NOTIFICATIONS.FCM_TOKEN, {
      fcmToken
    });
    const data = response.data?.data || response.data;
    logger.debug('FCM token saved successfully');
    return data;
  } catch (error: unknown) {
    const apiError = error as any;
    logger.error("Save FCM token error:", apiError);
    throw new Error((apiError.response?.data as any)?.error || "Failed to save notification token");
  }
};

/**
 * Send a reminder notification
 * @param message - Reminder message
 * @param type - Reminder type (default: 'daily')
 * @returns Promise resolving to response data
 * @throws Error if reminder send fails
 */
export const sendReminder = async (message: string, type: string = 'daily'): Promise<SendReminderResponse> => {
  logger.debug('sendReminder called', { type });
  try {
    const response = await api.post(API_ENDPOINTS.NOTIFICATIONS.SEND_REMINDER, {
      message,
      type
    });
    const data = response.data?.data || response.data;
    logger.debug('Reminder sent successfully');
    return data;
  } catch (error: unknown) {
    const apiError = error as any;
    logger.error("Send reminder error:", apiError);
    throw new Error((apiError.response?.data as any)?.error || "Failed to send reminder");
  }
};

/**
 * Schedule daily notifications
 * @param enabled - Whether to enable daily notifications
 * @param time - Time for notifications (default: '09:00')
 * @returns Promise resolving to response data
 * @throws Error if scheduling fails
 */
export const scheduleDailyNotifications = async (enabled: boolean, time: string = '09:00'): Promise<ScheduleDailyResponse> => {
  logger.debug('scheduleDailyNotifications called', { enabled, time });
  try {
    const response = await api.post(API_ENDPOINTS.NOTIFICATIONS.SCHEDULE_DAILY, {
      enabled,
      time
    });
    const data = response.data?.data || response.data;
    logger.debug('Daily notifications scheduled successfully');
    return data;
  } catch (error: unknown) {
    const apiError = error as any;
    logger.error("Schedule daily notifications error:", apiError);
    throw new Error((apiError.response?.data as any)?.error || "Failed to schedule daily notifications");
  }
};

/**
 * Disable all notifications
 * @returns Promise resolving to response data
 * @throws Error if disabling fails
 */
export const disableAllNotifications = async (): Promise<{ allDisabled: boolean }> => {
  logger.debug('disableAllNotifications called');
  try {
    const response = await api.post(API_ENDPOINTS.NOTIFICATIONS.DISABLE_ALL, {});
    const data = response.data?.data || response.data;
    logger.debug('All notifications disabled successfully');
    return data;
  } catch (error: unknown) {
    const apiError = error as any;
    logger.error("Disable notifications error:", apiError);
    throw new Error((apiError.response?.data as any)?.error || "Failed to disable notifications");
  }
};

/**
 * Get notification settings
 * @returns Promise resolving to notification settings
 * @throws Error if settings retrieval fails
 */
export const getNotificationSettings = async (): Promise<NotificationSettingsResponse> => {
  logger.debug('getNotificationSettings called');
  try {
    const response = await api.get(API_ENDPOINTS.NOTIFICATIONS.NOTIFICATION_SETTINGS);
    const data = response.data?.data || response.data;
    logger.debug('Notification settings retrieved');
    return data.settings || data;
  } catch (error: unknown) {
    const apiError = error as any;
    logger.error("Get notification settings error:", apiError);
    // Return default settings if endpoint doesn't exist yet
    return {
      dailyRemindersEnabled: false,
      reminderTime: '09:00',
      hasFcmToken: false,
      lastReminderSent: null
    };
  }
};

/**
 * Update notification settings
 * @param settings - Notification settings to update
 * @returns Promise resolving to response data
 * @throws Error if settings update fails
 */
export const updateNotificationSettings = async (settings: {
  dailyRemindersEnabled: boolean;
  reminderTime: string;
}): Promise<{ updated: boolean }> => {
  logger.debug('updateNotificationSettings called');
  try {
    const response = await api.post(API_ENDPOINTS.NOTIFICATIONS.NOTIFICATION_SETTINGS, settings);
    const data = response.data?.data || response.data;
    logger.debug('Notification settings updated successfully');
    return data;
  } catch (error: unknown) {
    const apiError = error as any;
    logger.error("Update notification settings error:", apiError);
    throw new Error((apiError.response?.data as any)?.error || "Failed to update notification settings");
  }
};
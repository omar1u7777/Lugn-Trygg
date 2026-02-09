/**
 * Push Notifications Service
 * Handles Firebase Cloud Messaging for meditation reminders and mood check-ins
 */

import type { Messaging } from 'firebase/messaging';
import { api } from '../api/api';
import { trackEvent } from './analytics';
import { getFirebaseVapidKey } from '../config/env';
import { loadFirebaseMessagingBundle } from './lazyFirebase';
import { logger } from '../utils/logger';


interface NotificationSchedule {
  morningReminder?: string; // HH:MM
  eveningReminder?: string; // HH:MM
  moodCheckInTime?: string; // HH:MM
  enableMoodReminders: boolean;
  enableMeditationReminders: boolean;
}

let messaging: Messaging | null = null;
let messagingModuleRef: typeof import('firebase/messaging') | null = null;

const ensureMessagingBundle = async () => {
  if (!messaging || !messagingModuleRef) {
    const bundle = await loadFirebaseMessagingBundle();
    messaging = bundle.firebaseMessaging;
    messagingModuleRef = bundle.messagingModule;
  }

  return {
    messagingInstance: messaging as Messaging,
    messagingModule: messagingModuleRef!,
  };
};

// Heuristic validation for a base64url-encoded VAPID public key
function isLikelyVapidKey(key?: string | null): boolean {
  if (!key) return false;
  // Typical VAPID keys are long base64url strings (~80+ chars) comprised of A-Z, a-z, 0-9, - and _
  return /^[A-Za-z0-9_-]{80,}$/.test(key);
}

/**
 * Initialize Firebase Cloud Messaging
 */
export async function initializeMessaging() {
  try {
    // Skip Firebase Messaging initialization in development if there are permission issues
    if (import.meta.env.DEV) {
      logger.debug('📱 Firebase Messaging initialization skipped in development mode');
      return;
    }

    const { messagingInstance, messagingModule } = await ensureMessagingBundle();
    messaging = messagingInstance;
    logger.debug('📱 Firebase Messaging initialized');

    // Do not request permission here; UI handles permission flow.
    if (Notification.permission !== 'granted') {
      logger.debug('ℹ️ Notification permission not granted yet; skipping token fetch');
      return;
    }

    const vapidKey = getFirebaseVapidKey();
    if (!isLikelyVapidKey(vapidKey)) {
      logger.warn('⚠️ Missing or invalid VAPID key; skipping FCM token initialization');
      return;
    }

    const fcmToken = await messagingModule.getToken(messagingInstance, { vapidKey: vapidKey as string });
    if (fcmToken) {
      logger.debug('📱 FCM Token:', fcmToken);
      // Save token to backend
      await saveFCMToken(fcmToken);
    }
  } catch (error) {
    logger.error('Failed to initialize messaging:', error);
  }
}

/**
 * Save FCM token to backend
 */
async function saveFCMToken(token: string) {
  try {
    await api.post('/api/v1/notifications/fcm-token', { fcmToken: token });
    logger.debug('💾 FCM token saved to backend');
  } catch (error) {
    logger.error('Failed to save FCM token:', error);
  }
}

/**
 * Listen for incoming messages
 */
export async function listenForMessages() {
  const { messagingInstance, messagingModule } = await ensureMessagingBundle();

  messagingModule.onMessage(messagingInstance, (payload) => {
    logger.debug('📬 Message received:', payload);

    const notificationTitle = payload.notification?.title || 'Lugn & Trygg';
    const notificationOptions: NotificationOptions = {
      body: payload.notification?.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: payload.data?.type || 'notification',
      data: payload.data,
    };

    if (Notification.permission === 'granted') {
      new Notification(notificationTitle, notificationOptions);
      
      // Vibrate if supported
      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200]);
      }
    }

    // Track notification
    trackEvent('notification_received', {
      type: payload.data?.type,
      title: notificationTitle,
    });
  });
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (error) {
    logger.error('Failed to request notification permission:', error);
    return false;
  }
}

/**
 * Set notification schedule
 */
export async function setNotificationSchedule(userId: string, schedule: NotificationSchedule) {
  try {
    await api.post('/api/v1/users/notification-schedule', schedule);
    logger.debug('⏰ Notification schedule saved');
    trackEvent('notification_schedule_updated', schedule);
  } catch (error) {
    logger.error('Failed to save notification schedule:', error);
  }
}

/**
 * Send meditation reminder
 */
export async function sendMeditationReminder(userId: string, meditationTitle: string) {
  try {
    await api.post(`/api/v1/notifications/send-reminder`, {
      type: 'meditation_reminder',
      message: `Dags att meditera: ${meditationTitle}`,
    });
    logger.debug('🧘 Meditation reminder sent');
  } catch (error) {
    logger.error('Failed to send meditation reminder:', error);
  }
}

/**
 * Send mood check-in reminder
 */
export async function sendMoodCheckInReminder(_userId: string) {
  try {
    await api.post(`/api/v1/notifications/send-reminder`, {
      type: 'mood_check_in',
      message: 'Hur mår du idag? Ta en stund för en snabb humör-check.',
    });
    logger.debug('😊 Mood check-in reminder sent');
  } catch (error) {
    logger.error('Failed to send mood check-in reminder:', error);
  }
}

/**
 * Schedule daily notifications
 */
export async function scheduleDailyNotifications(
  _userId: string,
  reminderTime: string = '09:00',
  enabled: boolean = true
) {
  try {
    await api.post(`/api/v1/notifications/schedule-daily`, {
      enabled,
      time: reminderTime,
    });
    logger.debug('📅 Daily notifications scheduled');
    trackEvent('daily_notifications_scheduled', {
      reminderTime,
      enabled,
    });
  } catch (error) {
    logger.error('Failed to schedule daily notifications:', error);
  }
}

/**
 * Get notification settings
 */
export async function getNotificationSettings(_userId: string): Promise<NotificationSchedule | null> {
  try {
    const response = await api.get(`/api/v1/notifications/settings`);
    const data = response.data?.data?.settings || response.data?.settings;
    if (!data) return null;
    
    return {
      enableMoodReminders: data.dailyRemindersEnabled || false,
      enableMeditationReminders: data.dailyRemindersEnabled || false,
      morningReminder: data.reminderTime || '09:00',
      eveningReminder: undefined,
      moodCheckInTime: data.reminderTime || '09:00',
    };
  } catch (error) {
    logger.error('Failed to fetch notification settings:', error);
    return null;
  }
}

/**
 * Update notification preferences
 */
export async function updateNotificationPreferences(
  _userId: string,
  preferences: Partial<NotificationSchedule>
) {
  try {
    await api.post(`/api/v1/notifications/settings`, {
      dailyRemindersEnabled: preferences.enableMoodReminders || preferences.enableMeditationReminders,
      reminderTime: preferences.morningReminder || preferences.moodCheckInTime,
    });
    logger.debug('📲 Notification preferences updated');
    trackEvent('notification_preferences_updated', preferences);
  } catch (error) {
    logger.error('Failed to update notification preferences:', error);
  }
}

/**
 * Disable all notifications
 */
export async function disableAllNotifications(_userId: string) {
  try {
    await api.post(`/api/v1/notifications/disable-all`, {});
    logger.debug('🔕 All notifications disabled');
    trackEvent('all_notifications_disabled');
  } catch (error) {
    logger.error('Failed to disable notifications:', error);
  }
}

export default {
  initializeMessaging,
  listenForMessages,
  requestNotificationPermission,
  setNotificationSchedule,
  sendMeditationReminder,
  sendMoodCheckInReminder,
  scheduleDailyNotifications,
  getNotificationSettings,
  updateNotificationPreferences,
  disableAllNotifications,
};

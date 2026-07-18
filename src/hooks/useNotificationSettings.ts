import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getNotificationSettings, updateNotificationSettings } from '../api/notifications';
import { initializeMessaging } from '../services/notifications';
import { logger } from '../utils/logger';

interface NotificationSettingsState {
  dailyRemindersEnabled: boolean;
  reminderTime: string;
  fcmToken: boolean;
}

interface UseNotificationSettingsParams {
  userId?: string;
  announce: (message: string, politeness?: 'polite' | 'assertive') => void;
}

export function useNotificationSettings({ userId, announce }: UseNotificationSettingsParams) {
  const { t } = useTranslation();
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettingsState>({
    dailyRemindersEnabled: false,
    reminderTime: '09:00',
    fcmToken: false,
  });
  const [isEnablingNotifications, setIsEnablingNotifications] = useState(false);

  const loadNotificationSettings = useCallback(async () => {
    if (!userId) return;

    try {
      const settings = await getNotificationSettings();
      setNotificationSettings({
        dailyRemindersEnabled: settings.dailyRemindersEnabled || false,
        reminderTime: settings.reminderTime || '09:00',
        fcmToken: settings.hasFcmToken || false,
      });
    } catch (error) {
      logger.error('Failed to load notification settings:', error);
    }
  }, [userId]);

  useEffect(() => {
    loadNotificationSettings();
  }, [loadNotificationSettings]);

  const requestNotificationPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      alert(t('recommendations.notifications.browserNotSupported', 'Denna webbläsare stödjer inte push-notiser'));
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      alert(t('recommendations.notifications.blocked', 'Du har blockerat notiser. Aktivera dem i webbläsarens inställningar för att använda denna funktion.'));
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }, [t]);

  const enableDailyReminders = useCallback(async () => {
    if (!userId) return;

    setIsEnablingNotifications(true);
    try {
      const hasPermission = await requestNotificationPermission();
      if (!hasPermission) {
        setIsEnablingNotifications(false);
        return;
      }

      initializeMessaging().then(() => {
        setNotificationSettings(prev => ({ ...prev, fcmToken: true }));
      }).catch(err => {
        logger.warn('FCM token registration failed (non-fatal):', err);
      });

      await updateNotificationSettings({
        dailyRemindersEnabled: true,
        reminderTime: notificationSettings.reminderTime,
      });

      setNotificationSettings(prev => ({ ...prev, dailyRemindersEnabled: true }));

      alert(t('recommendations.notifications.enabled', '✅ Dagliga påminnelser aktiverade!\n\nDu kommer få en vänlig påminnelse varje dag kl. {{time}} att ta hand om din mentala hälsa.', { time: notificationSettings.reminderTime }));
      announce(t('recommendations.announce.remindersEnabled', 'Dagliga påminnelser har aktiverats'), 'polite');
    } catch (error) {
      logger.error('Failed to enable daily reminders:', error);
      alert(t('recommendations.notifications.enableFailed', 'Kunde inte aktivera dagliga påminnelser. Försök igen.'));
    } finally {
      setIsEnablingNotifications(false);
    }
  }, [userId, requestNotificationPermission, notificationSettings.reminderTime, announce, t]);

  const disableDailyReminders = useCallback(async () => {
    if (!userId) return;

    try {
      await updateNotificationSettings({
        dailyRemindersEnabled: false,
        reminderTime: notificationSettings.reminderTime,
      });

      setNotificationSettings(prev => ({ ...prev, dailyRemindersEnabled: false }));
      alert(t('recommendations.notifications.disabled', 'Dagliga påminnelser har inaktiverats.'));
      announce(t('recommendations.announce.remindersDisabled', 'Dagliga påminnelser har inaktiverats'), 'polite');
    } catch (error) {
      logger.error('Failed to disable daily reminders:', error);
      alert(t('recommendations.notifications.disableFailed', 'Kunde inte inaktivera dagliga påminnelser. Försök igen.'));
    }
  }, [userId, notificationSettings.reminderTime, announce, t]);

  const updateReminderTime = useCallback(async (newTime: string) => {
    if (!userId) return;

    try {
      await updateNotificationSettings({
        dailyRemindersEnabled: notificationSettings.dailyRemindersEnabled,
        reminderTime: newTime,
      });

      setNotificationSettings(prev => ({ ...prev, reminderTime: newTime }));
      announce(t('recommendations.announce.reminderTimeUpdated', 'Påminnelsetid uppdaterad till {{time}}', { time: newTime }), 'polite');
    } catch (error) {
      logger.error('Failed to update reminder time:', error);
      alert(t('recommendations.notifications.updateTimeFailed', 'Kunde inte uppdatera påminnelsetiden. Försök igen.'));
    }
  }, [userId, notificationSettings.dailyRemindersEnabled, announce, t]);

  return {
    showNotificationSettings,
    setShowNotificationSettings,
    notificationSettings,
    isEnablingNotifications,
    enableDailyReminders,
    disableDailyReminders,
    updateReminderTime,
  };
}

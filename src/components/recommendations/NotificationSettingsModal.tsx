import React from 'react';
import { useTranslation } from 'react-i18next';

interface NotificationSettingsModalProps {
  notificationSettings: {
    dailyRemindersEnabled: boolean;
    reminderTime: string;
    fcmToken: boolean;
  };
  isEnablingNotifications: boolean;
  onEnable: () => void;
  onDisable: () => void;
  onUpdateReminderTime: (time: string) => void;
  onTimeChange: (time: string) => void;
  onClose: () => void;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  notificationSettings,
  isEnablingNotifications,
  onEnable,
  onDisable,
  onUpdateReminderTime,
  onTimeChange,
  onClose,
}) => {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
        <div className="text-center mb-6">
          <div className="text-4xl mb-4">🔔</div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {t('recommendations.notifications.title', 'Dagliga Påminnelser')}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            {t('recommendations.notifications.subtitle', 'Få vänliga dagliga påminnelser att ta hand om din mentala hälsa')}
          </p>
        </div>

        <div className="space-y-4 mb-6">
          {/* Current Status */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {t('recommendations.notifications.status', 'Status:')}
              </span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${notificationSettings.dailyRemindersEnabled
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                : 'bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                } `}>
                {notificationSettings.dailyRemindersEnabled ? t('recommendations.notifications.enabled', 'Aktiverad') : t('recommendations.notifications.disabled', 'Inaktiverad')}
              </span>
            </div>

            {notificationSettings.dailyRemindersEnabled && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {t('recommendations.notifications.time', '📅 Tid: {{time}}', { time: notificationSettings.reminderTime })}
                {notificationSettings.fcmToken && t('recommendations.notifications.ready', ' • ✅ Notiser redo')}
              </div>
            )}
          </div>

          {/* Time Setting */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('recommendations.notifications.reminderTime', '🕐 Påminnelsetid')}
            </label>
            <input
              type="time"
              value={notificationSettings.reminderTime}
              onChange={(e) => onTimeChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Information */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">
              {t('recommendations.notifications.whatHappens', 'ℹ️ Vad händer när du aktiverar?')}
            </h4>
            <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
              <li>{t('recommendations.notifications.bullet1', '• Du får en vänlig påminnelse varje dag')}</li>
              <li>{t('recommendations.notifications.bullet2', '• Påminnelsen innehåller motivation och tips')}</li>
              <li>{t('recommendations.notifications.bullet3', '• Du kan ändra tiden eller stänga av när som helst')}</li>
              <li>{t('recommendations.notifications.bullet4', '• All data hanteras säkert och konfidentiellt')}</li>
            </ul>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          {!notificationSettings.dailyRemindersEnabled ? (
            <button
              onClick={onEnable}
              disabled={isEnablingNotifications}
              className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              {isEnablingNotifications ? t('recommendations.notifications.enabling', '⏳ Aktiverar...') : t('recommendations.notifications.enableBtn', '✅ Aktivera Dagliga Påminnelser')}
            </button>
          ) : (
            <button
              onClick={onDisable}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              {t('recommendations.notifications.disableBtn', '❌ Inaktivera Påminnelser')}
            </button>
          )}

          <button
            onClick={onClose}
            className="px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {t('recommendations.notifications.close', 'Stäng')}
          </button>
        </div>

        {/* Save Time Button (only show if time changed and enabled) */}
        {notificationSettings.dailyRemindersEnabled && (
          <button
            onClick={() => onUpdateReminderTime(notificationSettings.reminderTime)}
            className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
          >
            {t('recommendations.notifications.saveNewTime', '💾 Spara Ny Tid')}
          </button>
        )}
      </div>
    </div>
  );
};

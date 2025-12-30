import React, { useState, useEffect } from 'react'
import { BellAlertIcon, CheckCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import notificationsService from '../services/notifications';
import { trackEvent, trackError } from '../services/analytics';

interface NotificationPermissionProps {
  open: boolean;
  onClose: (granted: boolean) => void;
  userId?: string;
}

/**
 * Notification Permission Request Component
 * Handles user permission for push notifications
 *
 * Display logic:
 *   - Only shown once per user/browser (see Dashboard logic)
 *   - Success state ('Notifications Enabled! 🎉') shown only after permission is granted
 *   - Dismissal or grant is tracked in localStorage (notifications_prompt_v1)
 *
 * Implementation notes:
 *   - The Dashboard component checks localStorage for 'notifications_prompt_v1' before showing this dialog.
 *   - Permission request is only triggered if browser permission is 'default'.
 *   - onClose is guarded to prevent duplicate triggers.
 *   - For local/dev, Firebase Messaging will not request permission if VAPID key is missing or invalid.
 */
export const NotificationPermission: React.FC<NotificationPermissionProps> = ({
  open,
  onClose,
  userId,
}) => {
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check notification permission on mount
    if ('Notification' in window) {
      setPermissionState(Notification.permission as any);
    }
  }, []);

  const handleRequestPermission = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!('Notification' in window)) {
        setError('Your browser does not support notifications');
        trackError(new Error('Notifications not supported'));
        return;
      }

      // For browsers that support the newer Notification API
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        const result = await notificationsService.requestNotificationPermission();
        
        if (result) {
          setPermissionState('granted');
          trackEvent('notification_permission_granted', {
            userId,
            source: 'notification_dialog',
          });
          
          // Auto-close after success
          setTimeout(() => {
            onClose(true);
          }, 1500);
        } else {
          setPermissionState('denied');
          trackEvent('notification_permission_denied', {
            userId,
            source: 'notification_dialog',
          });
        }
      } else {
        // Fallback for older browsers
        const permission = await Notification.requestPermission();
        setPermissionState(permission as any);
        
        if (permission === 'granted') {
          trackEvent('notification_permission_granted', {
            userId,
            source: 'notification_dialog',
            method: 'legacy',
          });
          setTimeout(() => {
            onClose(true);
          }, 1500);
        } else {
          trackEvent('notification_permission_denied', {
            userId,
            source: 'notification_dialog',
            method: 'legacy',
          });
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      trackError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    trackEvent('notification_permission_skipped', { userId });
    onClose(false);
  };

  const handleDeny = () => {
    trackEvent('notification_permission_denied_manually', { userId });
    onClose(false);
  };

  const benefits = [
    { icon: '🔔', text: 'Meditation reminders' },
    { icon: '📅', text: 'Mood check-in prompts' },
    { icon: '✨', text: 'Daily motivation' },
    { icon: '🎯', text: 'Goal progress updates' },
  ];

  if (!open) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={() => !isLoading && handleSkip()}
    >
      <div 
        className="bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-800 dark:to-gray-900 rounded-lg p-6 max-w-md w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="notification-dialog-title"
        aria-describedby="notification-dialog-description"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <BellAlertIcon className="w-8 h-8 text-primary-600 dark:text-primary-500" aria-hidden="true" />
            <h2 id="notification-dialog-title" className="text-xl font-semibold text-gray-900 dark:text-white">
              {permissionState === 'granted'
                ? 'Notifications Enabled! 🎉'
                : 'Stay Connected with Lugn & Trygg'}
            </h2>
          </div>
          {!isLoading && (
            <button
              onClick={handleSkip}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Close"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="space-y-4">
          <p 
            id="notification-dialog-description"
            className="text-gray-600 dark:text-gray-400"
          >
            Get meditation reminders, mood check-ins, and personalized motivation.
          </p>

          {permissionState === 'granted' ? (
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start gap-3">
              <CheckCircleIcon className="w-6 h-6 text-green-600 dark:text-green-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-green-800 dark:text-green-300">
                You'll now receive personalized notifications to support your wellness journey.
              </p>
            </div>
          ) : (
            <>
              <p className="text-gray-700 dark:text-gray-300">
                Get timely reminders to help you stay on track with your meditation and wellness goals.
              </p>

              {error && (
                <div className="bg-error-50 dark:bg-error-900/30 border border-error-200 dark:border-error-800 rounded-lg p-4">
                  <p className="text-error-800 dark:text-error-300">{error}</p>
                </div>
              )}

              <div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-3">
                  You'll receive:
                </h3>

                <ul className="space-y-2">
                  {benefits.map((benefit, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <span className="text-2xl" aria-hidden="true">{benefit.icon}</span>
                      <span className="text-sm text-gray-700 dark:text-gray-300">{benefit.text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {permissionState === 'denied' && (
                <div className="bg-warning-50 dark:bg-warning-900/30 border border-warning-200 dark:border-warning-800 rounded-lg p-4">
                  <p className="text-warning-800 dark:text-warning-300">
                    Notifications are disabled. You can enable them in your browser settings.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          {permissionState === 'granted' ? (
            <button
              onClick={() => onClose(true)}
              className="w-full px-4 py-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-800 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              Get Started
            </button>
          ) : permissionState === 'denied' ? (
            <>
              <button
                onClick={handleSkip}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                Back
              </button>
              <button
                onClick={handleDeny}
                className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-800 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                Close
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleSkip}
                disabled={isLoading}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                Maybe Later
              </button>
              <button
                onClick={handleRequestPermission}
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-800 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                {isLoading ? 'Requesting...' : 'Enable Notifications'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationPermission;


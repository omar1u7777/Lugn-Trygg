import { useState, useCallback, useEffect } from 'react';
import { trackEvent, trackError } from '../services/analytics';

interface UseNotificationPermissionReturn {
  permissionState: NotificationPermission;
  requestPermission: () => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook for managing notification permissions
 * Handles browser permission states and tracking
 */
export const useNotificationPermission = (
  userId?: string
): UseNotificationPermissionReturn => {
  const [permissionState, setPermissionState] = useState<NotificationPermission>('default');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize permission state
  useEffect(() => {
    if ('Notification' in window) {
      setPermissionState(Notification.permission as NotificationPermission);
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      // Check browser support
      if (!('Notification' in window)) {
        const msg = 'Your browser does not support notifications';
        setError(msg);
        trackError(
          new Error(msg),
          {
            component: 'useNotificationPermission',
            supported: false,
          }
        );
        return false;
      }

      // Use Notification API directly (simpler approach)
      const permission = await Notification.requestPermission();
      setPermissionState(permission as NotificationPermission);

      if (permission === 'granted') {
        trackEvent('notification_permission_granted', {
          userId,
          method: 'notification_api',
        });
        return true;
      } else if (permission === 'denied') {
        trackEvent('notification_permission_denied', {
          userId,
          method: 'notification_api',
        });
        return false;
      }

      return false;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to request permission';
      setError(errorMsg);
      trackError(err as Error, {
        component: 'useNotificationPermission',
        action: 'requestPermission',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  return {
    permissionState,
    requestPermission,
    isLoading,
    error,
  };
};

export default useNotificationPermission;

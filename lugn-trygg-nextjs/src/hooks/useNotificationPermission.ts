import { useState, useCallback, useEffect } from 'react';
import { trackEvent, trackError } from '../services/analytics';

export const useNotificationPermission = (userId?: string) => {
  const [permissionState, setPermissionState] = useState<NotificationPermission>('default');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermissionState(Notification.permission as NotificationPermission);
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      if (typeof window === 'undefined' || !('Notification' in window)) {
        const msg = 'Your browser does not support notifications';
        setError(msg);
        trackError(new Error(msg));
        return false;
      }

      const permission = await Notification.requestPermission();
      setPermissionState(permission as NotificationPermission);

      if (permission === 'granted') {
        trackEvent('notification_permission_granted', { userId, method: 'notification_api' });
        return true;
      } else if (permission === 'denied') {
        trackEvent('notification_permission_denied', { userId, method: 'notification_api' });
        return false;
      }

      return false;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to request permission';
      setError(errorMsg);
      trackError(err as Error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  return { permissionState, requestPermission, isLoading, error };
};

export default useNotificationPermission;

import { useState, useEffect, useCallback } from 'react';
import offlineStorage from '../services/offlineStorage';
import { trackEvent } from '../services/analytics';

export const useOfflineSync = (userId?: string) => {
  const [isOnline, setIsOnline] = useState(!offlineStorage.isOffline());
  const [isSyncing, setIsSyncing] = useState(false);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  // Use explicit type for unsyncedData
  interface UnsyncedData {
    moods: Array<{ id: string } & Record<string, any>>;
    memories: Array<{ id: string } & Record<string, any>>;
    queuedRequests: Array<{ id: string; retries?: number } & Record<string, any>>;
  }
  const [unsyncedData, setUnsyncedData] = useState<UnsyncedData>({ moods: [], memories: [], queuedRequests: [] });
  const [error, setError] = useState<string | null>(null);

  const updateUnsyncedData = useCallback(() => {
    const data = offlineStorage.getUnsyncedData();
    setUnsyncedData({
      moods: data.moods || [],
      memories: data.memories || [],
      queuedRequests: data.requests || [],
    });
    const count = (data.moods?.length || 0) + (data.memories?.length || 0) + (data.requests?.length || 0);
    setUnsyncedCount(count);
  }, []);

  useEffect(() => {
    updateUnsyncedData();
  }, [updateUnsyncedData]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      trackEvent('app_went_online', { userId });
      setTimeout(() => {
        manualSync();
      }, 500);
    };

    const handleOffline = () => {
      setIsOnline(false);
      trackEvent('app_went_offline', { userId });
      updateUnsyncedData();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [userId, updateUnsyncedData]);

  const manualSync = useCallback(async () => {
    if (isSyncing) return;

    try {
      setIsSyncing(true);
      setError(null);
      const data = offlineStorage.getUnsyncedData();

      let successCount = 0;
      let failureCount = 0;

      if (data.moods && data.moods.length > 0) {
        for (const mood of data.moods) {
          try {
            offlineStorage.markMoodAsSynced(mood.id);
            successCount++;
          } catch (err) {
            failureCount++;
          }
        }
      }

      if (data.memories && data.memories.length > 0) {
        for (const memory of data.memories) {
          try {
            offlineStorage.markMemoryAsSynced(memory.id);
            successCount++;
          } catch (err) {
            failureCount++;
          }
        }
      }

      if (data.requests && data.requests.length > 0) {
        for (const request of data.requests) {
          try {
            offlineStorage.removeQueuedRequest(request.id);
            successCount++;
          } catch (err) {
            failureCount++;
            const retries = request.retries || 0;
            if (retries < 3) {
              offlineStorage.retryQueuedRequest(request.id);
            } else {
              offlineStorage.removeQueuedRequest(request.id);
            }
          }
        }
      }

      updateUnsyncedData();

      if (successCount > 0) {
        trackEvent('offline_sync_completed', { userId, successCount, failureCount, totalCount: successCount + failureCount });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Sync failed';
      setError(errorMsg);
      console.error('Manual sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, userId, updateUnsyncedData]);

  return { isOnline, isSyncing, unsyncedCount, unsyncedData, manualSync, error };
};

export default useOfflineSync;
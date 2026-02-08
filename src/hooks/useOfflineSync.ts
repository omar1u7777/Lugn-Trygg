import { useState, useEffect, useCallback } from 'react';
import offlineStorage from '../services/offlineStorage';
import { trackEvent } from '../services/analytics';

interface OfflineData {
  moods: Array<any>;
  memories: Array<any>;
  queuedRequests: Array<any>;
}

interface UseOfflineSyncReturn {
  isOnline: boolean;
  isSyncing: boolean;
  unsyncedCount: number;
  unsyncedData: OfflineData;
  manualSync: () => Promise<void>;
  error: string | null;
}

/**
 * Hook for managing offline data sync
 * Handles auto-sync when online and manual sync trigger
 */
export const useOfflineSync = (userId?: string): UseOfflineSyncReturn => {
  const [isOnline, setIsOnline] = useState(!offlineStorage.isOffline());
  const [isSyncing, setIsSyncing] = useState(false);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [unsyncedData, setUnsyncedData] = useState<OfflineData>({
    moods: [],
    memories: [],
    queuedRequests: [],
  });
  const [error, setError] = useState<string | null>(null);

  // Update unsynced count
  const updateUnsyncedData = useCallback(() => {
    const data = offlineStorage.getUnsyncedData();
    setUnsyncedData({
      moods: data.moods || [],
      memories: data.memories || [],
      queuedRequests: data.requests || [],
    });
    const count =
      (data.moods?.length || 0) +
      (data.memories?.length || 0) +
      (data.requests?.length || 0);
    setUnsyncedCount(count);
  }, []);

  // Initial check
  useEffect(() => {
    updateUnsyncedData();
  }, [updateUnsyncedData]);

  // Setup offline listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      trackEvent('app_went_online', { userId });
      // Trigger automatic sync when coming online
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

      // Sync moods
      if (data.moods && data.moods.length > 0) {
        for (const mood of data.moods) {
          try {
            // This would call actual API endpoint
            // await api.post('/moods', mood);
            offlineStorage.markMoodAsSynced(mood.id);
            successCount++;
          } catch (err) {
            failureCount++;
          }
        }
      }

      // Sync memories
      if (data.memories && data.memories.length > 0) {
        for (const memory of data.memories) {
          try {
            // This would call actual API endpoint
            // await api.post('/memories', memory);
            offlineStorage.markMemoryAsSynced(memory.id);
            successCount++;
          } catch (err) {
            failureCount++;
          }
        }
      }

      // Sync queued requests
      if (data.requests && data.requests.length > 0) {
        for (const request of data.requests) {
          try {
            // This would call actual API endpoint based on method/endpoint
            // const response = await api[request.method.toLowerCase()](
            //   request.endpoint,
            //   request.data
            // );
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
        trackEvent('offline_sync_completed', {
          userId,
          successCount,
          failureCount,
          totalCount: successCount + failureCount,
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Sync failed';
      setError(errorMsg);
      console.error('Manual sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, userId, updateUnsyncedData]);

  return {
    isOnline,
    isSyncing,
    unsyncedCount,
    unsyncedData,
    manualSync,
    error,
  };
};

export default useOfflineSync;

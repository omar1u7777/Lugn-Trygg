import React, { useState, useEffect } from 'react'
import { CloudIcon, CloudArrowUpIcon, ArrowPathIcon, XMarkIcon } from '@heroicons/react/24/outline';
import offlineStorage from '../services/offlineStorage';

interface OfflineIndicatorProps {
  position?: 'top' | 'bottom';
  variant?: 'snackbar' | 'badge';
}

/**
 * Offline Indicator Component
 * Shows when user is offline and syncing status
 */
export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  position = 'bottom',
  variant = 'snackbar',
}) => {
  const [isOffline, setIsOffline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    // Check initial offline status
    setIsOffline(!navigator.onLine);

    // Setup offline listeners
    const unsubscribe = offlineStorage.listenForOnlineStatus(
      () => {
        setIsOffline(false);
        setShowAlert(false);
        // Trigger sync when coming online
        syncOfflineData();
      },
      () => {
        setIsOffline(true);
        setShowAlert(true);
        updateUnsyncedCount();
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  const updateUnsyncedCount = () => {
    const data = offlineStorage.getUnsyncedData();
    const count = 
      (data.moods?.length || 0) +
      (data.memories?.length || 0) +
      (data.requests?.length || 0);
    setUnsyncedCount(count);
  };

  const syncOfflineData = async () => {
    try {
      setIsSyncing(true);
      const data = offlineStorage.getUnsyncedData();
      
      // Attempt to sync moods
      if (data.moods && data.moods.length > 0) {
        for (const mood of data.moods) {
          try {
            // Sync mood with API
            offlineStorage.markMoodAsSynced(mood.id);
          } catch (error) {
            console.error('Failed to sync mood:', error);
          }
        }
      }

      // Attempt to sync memories
      if (data.memories && data.memories.length > 0) {
        for (const memory of data.memories) {
          try {
            offlineStorage.markMemoryAsSynced(memory.id);
          } catch (error) {
            console.error('Failed to sync memory:', error);
          }
        }
      }

      updateUnsyncedCount();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  if (variant === 'snackbar') {
    if (!showAlert || (!isOffline && !isSyncing)) return null;
    
    const bgClass = isSyncing 
      ? 'bg-info-50 dark:bg-info-900/20 border-info-200 dark:border-info-800' 
      : 'bg-warning-50 dark:bg-warning-900/20 border-warning-200 dark:border-warning-800';
    
    const iconClass = isSyncing 
      ? 'text-info-600 dark:text-info-400' 
      : 'text-warning-600 dark:text-warning-400';

    return (
      <div
        className={`fixed ${position === 'top' ? 'top-4' : 'bottom-4'} left-1/2 -translate-x-1/2 z-50 min-w-[300px] max-w-md`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className={`${bgClass} border rounded-lg shadow-lg p-4 flex items-start gap-3`}>
          {isSyncing ? (
            <CloudArrowUpIcon className={`h-6 w-6 ${iconClass} flex-shrink-0`} aria-hidden="true" />
          ) : (
            <CloudIcon className={`h-6 w-6 ${iconClass} flex-shrink-0`} aria-hidden="true" />
          )}
          
          <div className="flex-1 text-sm text-gray-900 dark:text-white">
            {isSyncing ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-info-300 border-t-info-600 rounded-full animate-spin" aria-hidden="true" />
                <span>
                  Syncing {unsyncedCount} unsaved item{unsyncedCount !== 1 ? 's' : ''}...
                </span>
              </div>
            ) : (
              <div>
                <span className="font-medium">You're offline</span>
                {unsyncedCount > 0 && (
                  <span> • {unsyncedCount} item{unsyncedCount !== 1 ? 's' : ''} waiting to sync</span>
                )}
              </div>
            )}
          </div>

          {!isOffline && (
            <button
              onClick={() => setShowAlert(false)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 flex-shrink-0"
              aria-label="Close notification"
            >
              <XMarkIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Badge variant for header
  return (
    <div className="flex items-center gap-2">
      {isSyncing ? (
        <>
          <ArrowPathIcon className="w-4 h-4 animate-spin" aria-hidden="true" />
          <span className="text-sm">Syncing...</span>
        </>
      ) : isOffline ? (
        <>
          <CloudIcon className="w-5 h-5 text-yellow-500" aria-hidden="true" />
          <span className="text-sm text-yellow-500">Offline</span>
        </>
      ) : (
        <>
          <CloudIcon className="w-5 h-5 text-green-500" aria-hidden="true" />
          <span className="text-sm text-green-500">Synced</span>
        </>
      )}
    </div>
  );
};

export default OfflineIndicator;


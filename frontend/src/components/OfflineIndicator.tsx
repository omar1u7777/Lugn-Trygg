import React, { useState, useEffect } from 'react';
import { Alert, Snackbar, Box, CircularProgress, Button } from '@mui/material';
import CloudOffOutlinedIcon from '@mui/icons-material/CloudOffOutlined';
import CloudDoneOutlinedIcon from '@mui/icons-material/CloudDoneOutlined';
import SyncIcon from '@mui/icons-material/Sync';
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
            // This would be replaced with actual API call
            console.log('Syncing mood:', mood);
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
            console.log('Syncing memory:', memory);
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
    return (
      <Snackbar
        open={showAlert && (isOffline || isSyncing)}
        autoHideDuration={isOffline ? null : 3000}
        onClose={() => !isOffline && setShowAlert(false)}
        anchorOrigin={{
          vertical: position === 'top' ? 'top' : 'bottom',
          horizontal: 'center',
        }}
        action={
          <Button 
            color="inherit" 
            size="small" 
            onClick={() => setShowAlert(false)}
            aria-label="Dismiss offline status notification"
          >
            Close
          </Button>
        }
      >
        <Alert
          severity={isSyncing ? 'info' : 'warning'}
          icon={isSyncing ? <SyncIcon aria-hidden="true" /> : <CloudOffOutlinedIcon aria-hidden="true" />}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          sx={{
            borderRadius: 1,
            boxShadow: 2,
            minWidth: '300px',
            animation: isSyncing ? 'spin 1s linear infinite' : 'none',
            '@keyframes spin': {
              '0%': { transform: 'rotate(0deg)' },
              '100%': { transform: 'rotate(360deg)' },
            },
          }}
        >
          {isSyncing ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={16} sx={{ color: 'inherit' }} aria-hidden="true" />
              <span>
                Syncing {unsyncedCount} unsaved item{unsyncedCount !== 1 ? 's' : ''}...
              </span>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <span>You're offline</span>
              {unsyncedCount > 0 && (
                <span>• {unsyncedCount} item{unsyncedCount !== 1 ? 's' : ''} waiting to sync</span>
              )}
            </Box>
          )}
        </Alert>
      </Snackbar>
    );
  }

  // Badge variant for header
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        padding: '8px 12px',
        borderRadius: 1,
        backgroundColor: isOffline ? '#fff3cd' : '#d4edda',
        color: isOffline ? '#856404' : '#155724',
        fontSize: '12px',
        fontWeight: 500,
      }}
    >
      {isSyncing ? (
        <>
          <SyncIcon
            sx={{
              fontSize: '16px',
              animation: 'spin 1s linear infinite',
              '@keyframes spin': {
                '0%': { transform: 'rotate(0deg)' },
                '100%': { transform: 'rotate(360deg)' },
              },
            }}
          />
          <span>Syncing...</span>
        </>
      ) : isOffline ? (
        <>
          <CloudOffOutlinedIcon sx={{ fontSize: '16px' }} />
          <span>Offline</span>
        </>
      ) : (
        <>
          <CloudDoneOutlinedIcon sx={{ fontSize: '16px' }} />
          <span>Synced</span>
        </>
      )}
    </Box>
  );
};

export default OfflineIndicator;

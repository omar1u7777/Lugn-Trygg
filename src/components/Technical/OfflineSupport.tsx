import React, { useState, useEffect } from 'react'
import { Card, CardContent, Typography, Button, Alert, Progress } from '../ui/tailwind';
// TODO: Replace icons with Heroicons
import api from '../../api/api';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowPathIcon, CloudIcon, WifiIcon, CheckCircleIcon, ArrowPathIcon as Sync, ExclamationCircleIcon as ErrorIcon } from '@heroicons/react/24/outline';

interface SyncStatus {
  pending_count: number;
  synced_count: number;
  failed_count: number;
  last_sync?: string;
}

const OfflineSupport: React.FC<{ userId: string }> = ({ userId }) => {
  const { token } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    fetchSyncStatus();
  }, [userId]);

  const fetchSyncStatus = async () => {
    try {
      const resp = await api.get(`/api/sync/status`, {
        params: { user_id: userId },
        headers: { Authorization: `Bearer ${token}` }
      });
      setSyncStatus(resp.data);
    } catch (e) {
      console.error('Failed to fetch sync status:', e);
    }
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      const resp = await api.post('/api/sync/now', { user_id: userId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSyncStatus(resp.data);
    } catch (e) {
      console.error('Sync failed:', e);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          {isOnline ? <WifiIcon className="text-green-500" /> : <WifiIcon className="text-red-500" />}
          Offline Support
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Your data is automatically synced when you're online. You can still use the app offline.
        </Typography>

        {/* Connection Status */}
        <Alert
          severity={isOnline ? 'success' : 'warning'}
          icon={isOnline ? <CloudIcon className="w-5 h-5" /> : <CloudIcon className="w-5 h-5" />}
        >
          {isOnline ? 'You are online. All changes will sync automatically.' : 'You are offline. Changes will sync when you reconnect.'}
        </Alert>

        {/* Offline Mode Toggle */}
        <div className="flex items-center justify-between mt-4">
          <Typography variant="body1">Enable Offline Mode</Typography>
          <input
            type="checkbox"
            checked={offlineMode}
            onChange={(e) => setOfflineMode(e.target.checked)}
            className="toggle-switch"
          />
        </div>

        {/* Sync Status */}
        {syncStatus && (
          <div className="mt-4">
            <Typography variant="h6" gutterBottom>
              Sync Status
            </Typography>
            <div className="space-y-2">
              <div className="flex items-center">
                <CheckCircleIcon className="w-5 h-5 text-green-500 mr-2" />
                <Typography variant="body2">Synced: {syncStatus.synced_count} items</Typography>
              </div>
              <div className="flex items-center">
                <Sync className="w-5 h-5 text-yellow-500 mr-2" />
                <Typography variant="body2">Pending Sync: {syncStatus.pending_count} items</Typography>
              </div>
              {syncStatus.failed_count > 0 && (
                <div className="flex items-center">
                  <ErrorIcon className="w-5 h-5 text-red-500 mr-2" />
                  <Typography variant="body2">Failed: {syncStatus.failed_count} items</Typography>
                </div>
              )}
              {syncStatus.last_sync && (
                <Typography variant="caption" className="text-gray-500">
                  Last sync: {new Date(syncStatus.last_sync).toLocaleString()}
                </Typography>
              )}
            </div>
          </div>
        )}

        {/* Sync Button */}
        <div>
          {syncing && <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-primary animate-pulse"></div></div>}
          <Button
            variant="primary"
            fullWidth
            startIcon={<ArrowPathIcon className="w-5 h-5" />}
            onClick={syncNow}
            disabled={!isOnline || syncing}
          >
            {syncing ? 'Syncing...' : 'Sync Now'}
          </Button>
        </div>

        {/* Offline Features Info */}
        <Alert severity="info">
          <Typography variant="body1" gutterBottom>
            Available Offline
          </Typography>
          <Typography variant="body2">
            • View mood history<br />
            • Log moods (syncs when online)<br />
            • Access saved memories<br />
            • Use relaxation exercises<br />
            • Chat with assistant (limited)
          </Typography>
        </Alert>
      </CardContent>
    </Card>
  );
};

export default OfflineSupport;

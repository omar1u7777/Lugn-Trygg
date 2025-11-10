import React, { useState, useEffect } from 'react'
import { colors, spacing, shadows, borderRadius } from '@/theme/tokens';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  LinearProgress,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  CloudDone,
  CloudOff,
  Sync,
  CheckCircle,
  Error as ErrorIcon,
  Wifi,
  WifiOff
} from '@mui/icons-material';
import api from '../../api/api';
import { useAuth } from '../../contexts/AuthContext';

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
    <Card sx={{ maxWidth: 700, margin: '16px auto' }}>
      <CardContent>
        <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          {isOnline ? <Wifi color="success" /> : <WifiOff color="error" />}
          Offline Support
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: spacing.lg }}>
          Your data is automatically synced when you're online. You can still use the app offline.
        </Typography>

        {/* Connection Status */}
        <Alert
          severity={isOnline ? 'success' : 'warning'}
          icon={isOnline ? <CloudDone /> : <CloudOff />}
          sx={{ mb: spacing.lg }}
        >
          {isOnline ? 'You are online. All changes will sync automatically.' : 'You are offline. Changes will sync when you reconnect.'}
        </Alert>

        {/* Offline Mode Toggle */}
        <FormControlLabel
          control={
            <Switch
              checked={offlineMode}
              onChange={(e) => setOfflineMode(e.target.checked)}
            />
          }
          label="Enable Offline Mode (saves data for offline use)"
          sx={{ mb: spacing.lg }}
        />

        {/* Sync Status */}
        {syncStatus && (
          <>
            <Typography variant="h6" gutterBottom>
              Sync Status
            </Typography>
            <List>
              <ListItem>
                <ListItemIcon>
                  <CheckCircle color="success" />
                </ListItemIcon>
                <ListItemText
                  primary="Synced"
                  secondary={`${syncStatus.synced_count} items`}
                />
              </ListItem>

              <ListItem>
                <ListItemIcon>
                  <Sync color="warning" />
                </ListItemIcon>
                <ListItemText
                  primary="Pending Sync"
                  secondary={`${syncStatus.pending_count} items`}
                />
              </ListItem>

              {syncStatus.failed_count > 0 && (
                <ListItem>
                  <ListItemIcon>
                    <ErrorIcon color="error" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Failed"
                    secondary={`${syncStatus.failed_count} items`}
                  />
                </ListItem>
              )}

              {syncStatus.last_sync && (
                <ListItem>
                  <ListItemText
                    secondary={`Last sync: ${new Date(syncStatus.last_sync).toLocaleString()}`}
                  />
                </ListItem>
              )}
            </List>
          </>
        )}

        {/* Sync Button */}
        <Box sx={{ mt: spacing.lg }}>
          {syncing && <LinearProgress sx={{ mb: spacing.md }} />}
          <Button
            variant="contained"
            fullWidth
            startIcon={<Sync />}
            onClick={syncNow}
            disabled={!isOnline || syncing}
          >
            {syncing ? 'Syncing...' : 'Sync Now'}
          </Button>
        </Box>

        {/* Offline Features Info */}
        <Alert severity="info" sx={{ mt: spacing.lg }}>
          <Typography variant="subtitle2" gutterBottom>
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

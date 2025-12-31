import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, Typography, Button, Alert, Divider, Chip, Spinner } from '../ui/tailwind';
// TODO: Replace icons with Heroicons
import api from '../../api/api';
import { useAuth } from '../../contexts/AuthContext';
import OptimizedImage from '../ui/OptimizedImage';
import { ArrowPathIcon, HeartIcon } from '@heroicons/react/24/outline';

interface HealthData {
  steps?: number;
  heart_rate?: number;
  sleep_hours?: number;
  calories?: number;
  distance?: number;
  last_sync?: string;
}

interface SyncStatus {
  google_fit: boolean;
  apple_health: boolean;
  last_sync_google?: string;
  last_sync_apple?: string;
}

const HealthSync: React.FC<{ userId: string }> = ({ userId }) => {
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    google_fit: false,
    apple_health: false
  });
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { token } = useAuth();

  const fetchSyncStatus = useCallback(async () => {
    try {
      const { data } = await api.get(`/api/integration/wearable/status`, {
        params: { user_id: userId },
        headers: { Authorization: `Bearer ${token}` }
      });
      setSyncStatus(data);
    } catch (e) {
      console.error('Failed to fetch sync status:', e);
    }
  }, [token, userId]);

  const fetchHealthData = useCallback(async () => {
    try {
      const { data } = await api.get(`/api/integration/wearable/details`, {
        params: { user_id: userId },
        headers: { Authorization: `Bearer ${token}` }
      });
      setHealthData(data?.data ? {
        steps: data?.data?.steps,
        heart_rate: data?.metrics?.heart_rate?.current,
        sleep_hours: data?.data?.sleep,
        calories: data?.data?.calories,
        last_sync: data?.last_sync
      } : null);
    } catch (e) {
      console.error('Failed to fetch health data:', e);
    }
  }, [token, userId]);

  useEffect(() => {
    fetchSyncStatus();
    fetchHealthData();
  }, [fetchSyncStatus, fetchHealthData]);

  const syncGoogleFit = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await api.post('/api/integration/wearable/google-fit/sync', {
        user_id: userId,
        access_token: 'dev-token'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess('Google Fit synced successfully!');
      setSyncStatus((prev) => ({ ...prev, google_fit: true, last_sync_google: new Date().toISOString() }));
      await fetchHealthData();
    } catch (e: unknown) {
      const errorMessage = e instanceof Error && 'response' in e && typeof e.response === 'object' && e.response && 'data' in e.response && typeof e.response.data === 'object' && e.response.data && 'error' in e.response.data
        ? String(e.response.data.error)
        : e instanceof Error ? e.message : String(e);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const syncAppleHealth = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await api.post('/api/integration/wearable/apple-health/sync', {
        user_id: userId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess('Apple Health synced successfully!');
      setSyncStatus((prev) => ({ ...prev, apple_health: true, last_sync_apple: new Date().toISOString() }));
      await fetchHealthData();
    } catch (e: unknown) {
      const errorMessage = e instanceof Error && 'response' in e && typeof e.response === 'object' && e.response && 'data' in e.response && typeof e.response.data === 'object' && e.response.data && 'error' in e.response.data
        ? String(e.response.data.error)
        : e instanceof Error ? e.message : String(e);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const toggleGoogleFit = async () => {
    if (!syncStatus.google_fit) {
      await syncGoogleFit();
    } else {
      // Disable sync
      setSyncStatus((prev) => ({ ...prev, google_fit: false }));
      setSuccess('Google Fit sync disabled');
    }
  };

  const toggleAppleHealth = async () => {
    if (!syncStatus.apple_health) {
      await syncAppleHealth();
    } else {
      // Disable sync
      setSyncStatus((prev) => ({ ...prev, apple_health: false }));
      setSuccess('Apple Health sync disabled');
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          🏃 Health & Fitness Integration
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Sync your fitness data from Google Fit or Apple Health to get personalized mood insights based on physical activity, sleep, and heart rate.
        </Typography>

        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {/* Integration Toggles */}
        <div>
          <FormControlLabel
            control={
              <Switch
                checked={syncStatus.google_fit}
                onChange={toggleGoogleFit}
                disabled={loading}
              />
            }
            label={
              <div>
                <OptimizedImage
                  src="https://www.gstatic.com/images/branding/product/2x/googleg_48dp.png"
                  alt="Google Fit"
                  width={24}
                  height={24}
                  sizes="24px"
                  className="rounded"
                />
                <Typography>Google Fit</Typography>
                {syncStatus.google_fit && <CheckCircle color="success" fontSize="small" />}
              </div>
            }
          />
          {syncStatus.last_sync_google && (
            <Typography variant="caption" color="text.secondary">
              Last synced: {new Date(syncStatus.last_sync_google).toLocaleString()}
            </Typography>
          )}
        </div>

        <div>
          <FormControlLabel
            control={
              <Switch
                checked={syncStatus.apple_health}
                onChange={toggleAppleHealth}
                disabled={loading}
              />
            }
            label={
              <div>
                <HeartIcon className="w-5 h-5" />
                <Typography>Apple Health</Typography>
                {syncStatus.apple_health && <CheckCircle color="success" fontSize="small" />}
              </div>
            }
          />
          {syncStatus.last_sync_apple && (
            <Typography variant="caption" color="text.secondary">
              Last synced: {new Date(syncStatus.last_sync_apple).toLocaleString()}
            </Typography>
          )}
        </div>

        <Divider />

        {/* Health Data Display */}
        <Typography variant="h6" gutterBottom>
          Today's Health Data
        </Typography>

        {loading && (
          <div>
            <Spinner />
          </div>
        )}

        {healthData && !loading && (
          <List>
            <ListItem>
              <ListItemIcon>
                <DirectionsRun color="primary" />
              </ListItemIcon>
              <ListItemText
                primary="Steps"
                secondary={healthData.steps?.toLocaleString() || 'No data'}
              />
              {healthData.steps && healthData.steps >= 10000 && (
                <Chip label="Goal reached!" color="success" size="small" />
              )}
            </ListItem>

            <ListItem>
              <ListItemIcon>
                <Favorite color="error" />
              </ListItemIcon>
              <ListItemText
                primary="Heart Rate"
                secondary={healthData.heart_rate ? `${healthData.heart_rate} bpm` : 'No data'}
              />
            </ListItem>

            <ListItem>
              <ListItemIcon>
                <LocalHospital color="info" />
              </ListItemIcon>
              <ListItemText
                primary="Sleep"
                secondary={healthData.sleep_hours ? `${healthData.sleep_hours} hours` : 'No data'}
              />
              {healthData.sleep_hours && healthData.sleep_hours >= 7 && (
                <Chip label="Well rested!" color="success" size="small" />
              )}
            </ListItem>

            <ListItem>
              <ListItemIcon>
                <FitnessCenter color="warning" />
              </ListItemIcon>
              <ListItemText
                primary="Calories Burned"
                secondary={healthData.calories?.toLocaleString() || 'No data'}
              />
            </ListItem>
          </List>
        )}

        {!healthData && !loading && (
          <Alert severity="info" icon={<ArrowPathIcon className="w-5 h-5" />}>
            No health data available. Enable sync with Google Fit or Apple Health to see your fitness metrics.
          </Alert>
        )}

        {/* Sync Button */}
        <div>
          <Button
            variant="primary"
            startIcon={<ArrowPathIcon className="w-5 h-5" />}
            onClick={() => {
              if (syncStatus.google_fit) syncGoogleFit();
              if (syncStatus.apple_health) syncAppleHealth();
            }}
            disabled={loading || (!syncStatus.google_fit && !syncStatus.apple_health)}
            fullWidth
          >
            Sync Now
          </Button>
        </div>

        <Typography variant="caption" color="text.secondary">
          💡 Tip: Regular physical activity and good sleep are strongly linked to improved mood and mental wellbeing.
        </Typography>
      </CardContent>
    </Card>
  );
};

export default HealthSync;


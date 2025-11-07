import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  Switch,
  FormControlLabel,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  CircularProgress
} from '@mui/material';
import {
  FitnessCenter,
  DirectionsRun,
  Favorite,
  LocalHospital,
  Sync,
  CheckCircle
} from '@mui/icons-material';
import api from '../../api/api';
import { useAuth } from '../../contexts/AuthContext';
import {
  CardBody,
  CardHeader,
  CardFooter,
} from '../ui/ProComponents';
import { useTranslation } from 'react-i18next';
import OptimizedImage from '../ui/OptimizedImage';

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

  useEffect(() => {
    fetchSyncStatus();
    fetchHealthData();
  }, [userId]);

  const fetchSyncStatus = async () => {
    try {
      const { data } = await api.get(`/api/integration/wearable/status`, {
        params: { user_id: userId },
        headers: { Authorization: `Bearer ${token}` }
      });
      setSyncStatus(data);
    } catch (e) {
      console.error('Failed to fetch sync status:', e);
    }
  };

  const fetchHealthData = async () => {
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
  };

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
    } catch (e: any) {
      setError(e?.response?.data?.error || e.message || String(e));
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
    } catch (e: any) {
      setError(e?.response?.data?.error || e.message || String(e));
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
    <Card sx={{ maxWidth: 800, margin: '16px auto' }}>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          🏃 Health & Fitness Integration
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Sync your fitness data from Google Fit or Apple Health to get personalized mood insights based on physical activity, sleep, and heart rate.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {/* Integration Toggles */}
        <Box sx={{ mb: 3 }}>
          <FormControlLabel
            control={
              <Switch
                checked={syncStatus.google_fit}
                onChange={toggleGoogleFit}
                disabled={loading}
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <OptimizedImage
                  src="https://www.gstatic.com/images/branding/product/2x/googleg_48dp.png"
                  alt="Google Fit"
                  width={24}
                  height={24}
                  className="rounded"
                />
                <Typography>Google Fit</Typography>
                {syncStatus.google_fit && <CheckCircle color="success" fontSize="small" />}
              </Box>
            }
          />
          {syncStatus.last_sync_google && (
            <Typography variant="caption" color="text.secondary" sx={{ ml: 5, display: 'block' }}>
              Last synced: {new Date(syncStatus.last_sync_google).toLocaleString()}
            </Typography>
          )}
        </Box>

        <Box sx={{ mb: 3 }}>
          <FormControlLabel
            control={
              <Switch
                checked={syncStatus.apple_health}
                onChange={toggleAppleHealth}
                disabled={loading}
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Favorite sx={{ color: '#FF2D55' }} />
                <Typography>Apple Health</Typography>
                {syncStatus.apple_health && <CheckCircle color="success" fontSize="small" />}
              </Box>
            }
          />
          {syncStatus.last_sync_apple && (
            <Typography variant="caption" color="text.secondary" sx={{ ml: 5, display: 'block' }}>
              Last synced: {new Date(syncStatus.last_sync_apple).toLocaleString()}
            </Typography>
          )}
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Health Data Display */}
        <Typography variant="h6" gutterBottom>
          Today's Health Data
        </Typography>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
            <CircularProgress />
          </Box>
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
          <Alert severity="info" icon={<Sync />}>
            No health data available. Enable sync with Google Fit or Apple Health to see your fitness metrics.
          </Alert>
        )}

        {/* Sync Button */}
        <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<Sync />}
            onClick={() => {
              if (syncStatus.google_fit) syncGoogleFit();
              if (syncStatus.apple_health) syncAppleHealth();
            }}
            disabled={loading || (!syncStatus.google_fit && !syncStatus.apple_health)}
            fullWidth
          >
            Sync Now
          </Button>
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
          💡 Tip: Regular physical activity and good sleep are strongly linked to improved mood and mental wellbeing.
        </Typography>
      </CardContent>
    </Card>
  );
};

export default HealthSync;

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert,
} from '@mui/material';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import notificationsService from '../services/notifications';
import { trackEvent, trackError } from '../services/analytics';

interface NotificationPermissionProps {
  open: boolean;
  onClose: (granted: boolean) => void;
  userId?: string;
}

/**
 * Notification Permission Request Component
 * Handles user permission for push notifications
 *
 * Display logic:
 *   - Only shown once per user/browser (see Dashboard logic)
 *   - Success state ('Notifications Enabled! 🎉') shown only after permission is granted
 *   - Dismissal or grant is tracked in localStorage (notifications_prompt_v1)
 *
 * Implementation notes:
 *   - The Dashboard component checks localStorage for 'notifications_prompt_v1' before showing this dialog.
 *   - Permission request is only triggered if browser permission is 'default'.
 *   - onClose is guarded to prevent duplicate triggers.
 *   - For local/dev, Firebase Messaging will not request permission if VAPID key is missing or invalid.
 */
export const NotificationPermission: React.FC<NotificationPermissionProps> = ({
  open,
  onClose,
  userId,
}) => {
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check notification permission on mount
    if ('Notification' in window) {
      setPermissionState(Notification.permission as any);
    }
  }, []);

  const handleRequestPermission = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!('Notification' in window)) {
        setError('Your browser does not support notifications');
        trackError(new Error('Notifications not supported'));
        return;
      }

      // For browsers that support the newer Notification API
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        const result = await notificationsService.requestNotificationPermission();
        
        if (result) {
          setPermissionState('granted');
          trackEvent('notification_permission_granted', {
            userId,
            source: 'notification_dialog',
          });
          
          // Auto-close after success
          setTimeout(() => {
            onClose(true);
          }, 1500);
        } else {
          setPermissionState('denied');
          trackEvent('notification_permission_denied', {
            userId,
            source: 'notification_dialog',
          });
        }
      } else {
        // Fallback for older browsers
        const permission = await Notification.requestPermission();
        setPermissionState(permission as any);
        
        if (permission === 'granted') {
          trackEvent('notification_permission_granted', {
            userId,
            source: 'notification_dialog',
            method: 'legacy',
          });
          setTimeout(() => {
            onClose(true);
          }, 1500);
        } else {
          trackEvent('notification_permission_denied', {
            userId,
            source: 'notification_dialog',
            method: 'legacy',
          });
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      trackError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    trackEvent('notification_permission_skipped', { userId });
    onClose(false);
  };

  const handleDeny = () => {
    trackEvent('notification_permission_denied_manually', { userId });
    onClose(false);
  };

  const benefits = [
    { icon: '🔔', text: 'Meditation reminders' },
    { icon: '📅', text: 'Mood check-in prompts' },
    { icon: '✨', text: 'Daily motivation' },
    { icon: '🎯', text: 'Goal progress updates' },
  ];

  return (
    <Dialog
      open={open}
      onClose={() => !isLoading && handleSkip()}
      maxWidth="sm"
      fullWidth
      aria-labelledby="notification-dialog-title"
      aria-describedby="notification-dialog-description"
      PaperProps={{
        sx: {
          borderRadius: 2,
          background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        },
      }}
    >
      <DialogTitle
        id="notification-dialog-title"
        sx={{
          textAlign: 'center',
          paddingBottom: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <NotificationsActiveIcon 
            sx={{ fontSize: '28px', color: '#667eea' }}
            aria-hidden="true"
          />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {permissionState === 'granted'
              ? 'Notifications Enabled! 🎉'
              : 'Stay Connected with Lugn & Trygg'}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ paddingTop: 2 }}>
        <Typography 
          id="notification-dialog-description"
          variant="body2"
          sx={{ mb: 2, textAlign: 'center', color: '#666' }}
        >
          Get meditation reminders, mood check-ins, and personalized motivation.
        </Typography>
        {permissionState === 'granted' ? (
          <Box sx={{ textAlign: 'center' }}>
            <CheckCircleIcon 
              sx={{ fontSize: '48px', color: '#4caf50', marginBottom: 1 }}
              aria-hidden="true"
            />
            <Typography sx={{ color: '#666', marginBottom: 1 }}>
              You'll now receive personalized notifications to support your wellness journey.
            </Typography>
          </Box>
        ) : (
          <>
            <Typography sx={{ marginBottom: 2, color: '#666' }}>
              Get timely reminders to help you stay on track with your meditation and wellness goals.
            </Typography>

            {error && (
              <Alert severity="error" sx={{ marginBottom: 2 }}>
                {error}
              </Alert>
            )}

            <Typography variant="subtitle2" sx={{ fontWeight: 600, marginBottom: 1, color: '#333' }}>
              You'll receive:
            </Typography>

            <List sx={{ bgcolor: 'rgba(255,255,255,0.7)', borderRadius: 1, marginBottom: 2 }}>
              {benefits.map((benefit, index) => (
                <ListItem key={index} disableGutters sx={{ padding: '8px 12px' }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <Typography 
                      sx={{ fontSize: '18px' }}
                      aria-hidden="true"
                    >
                      {benefit.icon}
                    </Typography>
                  </ListItemIcon>
                  <ListItemText
                    primary={benefit.text}
                    primaryTypographyProps={{ sx: { fontSize: '14px', color: '#333' } }}
                    id={`benefit-${index}`}
                  />
                </ListItem>
              ))}
            </List>

            {permissionState === 'denied' && (
              <Alert severity="warning">
                Notifications are disabled. You can enable them in your browser settings.
              </Alert>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ padding: 2, gap: 1 }}>
        {permissionState === 'granted' ? (
          <Button
            onClick={() => onClose(true)}
            variant="contained"
            fullWidth
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              fontWeight: 600,
            }}
          >
            Get Started
          </Button>
        ) : permissionState === 'denied' ? (
          <>
            <Button onClick={handleSkip} fullWidth>
              Back
            </Button>
            <Button
              onClick={handleDeny}
              fullWidth
              variant="contained"
              sx={{
                background: '#f44336',
                color: 'white',
              }}
            >
              Close
            </Button>
          </>
        ) : (
          <>
            <Button onClick={handleSkip} fullWidth disabled={isLoading}>
              Maybe Later
            </Button>
            <Button
              onClick={handleRequestPermission}
              fullWidth
              variant="contained"
              disabled={isLoading}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                fontWeight: 600,
              }}
            >
              {isLoading ? 'Requesting...' : 'Enable Notifications'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default NotificationPermission;

import React, { useState, useEffect } from 'react'
import { colors, spacing, shadows, borderRadius } from '@/theme/tokens';
import { Card, CardContent, Button, Typography, Box, Chip, Alert } from '@mui/material';
import { GetApp, Close, Star, Smartphone, Computer, Tablet } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { usePWA } from '../hooks/usePWA';
import { analytics } from '../services/analytics';

const PWAInstallPrompt: React.FC = () => {
  const { t } = useTranslation();
  const {
    isInstallable,
    isInstalled,
    installSuccess,
    platform,
    installApp,
    updateAvailable,
    updateApp,
  } = usePWA();

  const [dismissed, setDismissed] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    // Check if user has previously dismissed the prompt
    const dismissedPrompt = localStorage.getItem('pwa-install-dismissed');
    if (dismissedPrompt) {
      const dismissedTime = parseInt(dismissedPrompt);
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);

      // Show again after 7 days
      if (daysSinceDismissed < 7) {
        setDismissed(true);
      }
    }
  }, []);

  useEffect(() => {
    if (installSuccess) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [installSuccess]);

  const handleInstall = async () => {
    const success = await installApp();
    if (success) {
      analytics.track('PWA Install Button Clicked', { platform });
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    analytics.track('PWA Install Prompt Dismissed', { platform });
  };

  const handleUpdate = async () => {
    await updateApp();
    analytics.track('PWA Update Button Clicked', { platform });
  };

  // Don't show if already installed, dismissed, or not installable
  if (isInstalled || dismissed || !isInstallable) {
    return null;
  }

  const getPlatformIcon = () => {
    switch (platform) {
      case 'ios':
        return <Smartphone sx={{ color: 'primary.main' }} />;
      case 'android':
        return <Smartphone sx={{ color: 'success.main' }} />;
      case 'windows':
        return <Computer sx={{ color: 'info.main' }} />;
      case 'macos':
        return <Computer sx={{ color: 'secondary.main' }} />;
      default:
        return <Tablet sx={{ color: 'warning.main' }} />;
    }
  };

  const getPlatformName = () => {
    switch (platform) {
      case 'ios':
        return 'iOS';
      case 'android':
        return 'Android';
      case 'windows':
        return 'Windows';
      case 'macos':
        return 'macOS';
      default:
        return 'Din enhet';
    }
  };

  return (
    <>
      {/* Install Prompt */}
      <Card
        sx={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          maxWidth: 400,
          zIndex: 1000,
          boxShadow: 6,
          border: '2px solid',
          borderColor: 'primary.main',
        }}
        role="dialog"
        aria-labelledby="pwa-install-title"
        aria-describedby="pwa-install-description"
      >
        <CardContent sx={{ p: spacing.lg }}>
          <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={2}>
            <Box display="flex" alignItems="center" gap={2}>
              <GetApp sx={{ color: 'primary.main', fontSize: 28 }} />
              <Box>
                <Typography id="pwa-install-title" variant="h6" component="h2">
                  Installera Lugn & Trygg
                </Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  {getPlatformIcon()}
                  <Typography variant="body2" color="text.secondary">
                    För {getPlatformName()}
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Button
              size="small"
              onClick={handleDismiss}
              aria-label="Stäng installationsprompt"
              sx={{ minWidth: 'auto', p: 0.5 }}
            >
              <Close fontSize="small" />
            </Button>
          </Box>

          <Typography id="pwa-install-description" variant="body2" sx={{ mb: spacing.lg }}>
            Installera appen för snabb åtkomst, offline-funktionalitet och push-notiser.
            Fungerar även utan internetanslutning!
          </Typography>

          <Box display="flex" flexWrap="wrap" gap={1} mb={3}>
            <Chip
              icon={<Star />}
              label="Offline-först"
              size="small"
              color="primary"
              variant="outlined"
            />
            <Chip
              icon={<Smartphone />}
              label="Snabb åtkomst"
              size="small"
              color="secondary"
              variant="outlined"
            />
            <Chip
              icon={<GetApp />}
              label="Push-notiser"
              size="small"
              color="success"
              variant="outlined"
            />
          </Box>

          <Box display="flex" gap={2}>
            <Button
              variant="contained"
              fullWidth
              onClick={handleInstall}
              startIcon={<GetApp />}
              size="large"
            >
              Installera nu
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Update Prompt */}
      {updateAvailable && (
        <Card
          sx={{
            position: 'fixed',
            top: spacing.md0,
            right: 20,
            maxWidth: 350,
            zIndex: 1000,
            boxShadow: 6,
            border: '2px solid',
            borderColor: 'warning.main',
          }}
          role="dialog"
          aria-labelledby="pwa-update-title"
        >
          <CardContent sx={{ p: spacing.lg }}>
            <Typography id="pwa-update-title" variant="h6" gutterBottom>
              Uppdatering tillgänglig! 🚀
            </Typography>
            <Typography variant="body2" sx={{ mb: spacing.lg }}>
              En ny version av Lugn & Trygg är tillgänglig med förbättringar och nya funktioner.
            </Typography>

            <Box display="flex" gap={2}>
              <Button
                variant="contained"
                color="warning"
                onClick={handleUpdate}
                fullWidth
              >
                Uppdatera nu
              </Button>
              <Button
                variant="outlined"
                onClick={() => setDismissed(true)}
                fullWidth
              >
                Senare
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Success Message */}
      {showSuccess && (
        <Alert
          severity="success"
          sx={{
            position: 'fixed',
            top: spacing.md0,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            minWidth: 300,
            boxShadow: 6,
          }}
          onClose={() => setShowSuccess(false)}
        >
          🎉 Lugn & Trygg har installerats framgångsrikt!
        </Alert>
      )}
    </>
  );
};

export default PWAInstallPrompt;
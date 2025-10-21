import React, { useEffect } from 'react';
import { Box } from '@mui/material';
import { usePageTracking } from '../hooks/useAnalytics';
import OfflineIndicator from './OfflineIndicator';
import { initializeMessaging } from '../services/notifications';

interface AppLayoutProps {
  children: React.ReactNode;
}

/**
 * Main App Layout Component
 * Initializes analytics, notifications, offline tracking
 * Wraps all app content
 */
export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  // Track page views automatically
  usePageTracking();

  // Initialize services on mount
  useEffect(() => {
    // Analytics already initialized in main.tsx, but ensure it's available
    console.log('📱 AppLayout mounted - services ready');

    // Initialize Firebase Messaging (safe to call multiple times)
    try {
      initializeMessaging();
    } catch (error) {
      console.log('Messaging initialization skipped (service worker not available)');
    }
  }, []);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        width: '100%',
      }}
    >
      {/* Main content */}
      <Box
        sx={{
          flex: 1,
          width: '100%',
          overflow: 'auto',
        }}
      >
        {children}
      </Box>

      {/* Offline indicator */}
      <OfflineIndicator position="bottom" variant="snackbar" />
    </Box>
  );
};

export default AppLayout;

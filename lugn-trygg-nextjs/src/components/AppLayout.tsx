import React, { useEffect } from 'react';
import { Box } from '@mui/material';
import OfflineIndicator from './OfflineIndicator';

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  useEffect(() => {
    // Placeholder for analytics and notification initialization
    // e.g. initializeAnalytics();
    // e.g. initializeMessaging();
  }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%' }}>
      <Box sx={{ flex: 1, width: '100%', overflow: 'auto' }}>{children}</Box>
      <OfflineIndicator position="bottom" variant="snackbar" />
    </Box>
  );
};

export default AppLayout;

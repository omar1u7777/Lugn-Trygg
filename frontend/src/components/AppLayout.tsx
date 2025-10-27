import React, { useEffect } from 'react';
import { Box, Container, useTheme } from '@mui/material';
import { useAccessibility } from '../hooks/useAccessibility';
import SkipLinks from './Accessibility/SkipLinks';
import { accessibilityAuditor } from '../utils/accessibilityAudit';
import OfflineIndicator from './OfflineIndicator';

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  showSkipLinks?: boolean;
}

const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  title = 'Lugn & Trygg',
  showSkipLinks = true,
}) => {
  const theme = useTheme();
  const { announceToScreenReader } = useAccessibility();

  useEffect(() => {
    // Set page title
    document.title = title;

    // Announce page change to screen readers
    announceToScreenReader(`Sida laddad: ${title}`, 'polite');

    // Run accessibility audit in development
    if (process.env.NODE_ENV === 'development') {
      accessibilityAuditor.runFullAudit().then(result => {
        if (!result.passed) {
          console.warn('Accessibility Audit Issues:', result);
        }
      });
    }
  }, [title, announceToScreenReader]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: theme.palette.background.default,
        color: theme.palette.text.primary,
      }}
    >
      {/* Skip Links for Keyboard Navigation */}
      {showSkipLinks && <SkipLinks />}

      {/* Offline Indicator */}
      <OfflineIndicator variant="snackbar" position="top" />

      {/* Main Content Container */}
      <Container
        component="main"
        id="main-content"
        maxWidth="lg"
        sx={{
          py: 4,
          minHeight: 'calc(100vh - 64px)', // Account for potential header
        }}
      >
        {children}
      </Container>

      {/* Screen Reader Status Announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          left: '-10000px',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
        }}
        id="sr-status"
      />
    </Box>
  );
};

export default AppLayout;

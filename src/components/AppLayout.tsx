import React, { useEffect } from 'react';
import { useAccessibility } from '../hooks/useAccessibility';
import SkipLinks from './Accessibility/SkipLinks';
import { accessibilityAuditor } from '../utils/accessibilityAudit';
import OfflineIndicator from './OfflineIndicator';
import { logger } from '../utils/logger';


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
  // ✅ REMOVED: const theme = useTheme(); - Not needed with Tailwind
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
          logger.warn('Accessibility Audit Issues:', result);
        }
      });
    }
  }, [title, announceToScreenReader]);

  return (
    <div>
      {/* Skip Links for Keyboard Navigation */}
      {showSkipLinks && <SkipLinks />}

      {/* Offline Indicator */}
      <OfflineIndicator variant="snackbar" position="top" />

      {/* Content rendered directly - ProtectedAppShell provides its own <main> */}
      {children}

      {/* Screen Reader Status Announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        id="sr-status"
      />
    </div>
  );
};

export default AppLayout;

import React, { useEffect, useRef } from 'react';
import { Box } from '@mui/material';

interface ScreenReaderOnlyProps {
  children: React.ReactNode;
  announce?: boolean;
  politeness?: 'polite' | 'assertive';
  atomic?: boolean;
}

export const ScreenReaderOnly: React.FC<ScreenReaderOnlyProps> = ({
  children,
  announce = false,
  politeness = 'polite',
  atomic = true,
}) => {
  return (
    <Box
      component="span"
      sx={{
        position: 'absolute',
        left: '-10000px',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
        // Ensure screen readers can still access it
        clip: 'rect(0, 0, 0, 0)',
      }}
      aria-live={announce ? politeness : undefined}
      aria-atomic={announce ? atomic : undefined}
    >
      {children}
    </Box>
  );
};

interface LiveRegionProps {
  children: React.ReactNode;
  politeness?: 'polite' | 'assertive';
  atomic?: boolean;
  role?: 'status' | 'alert' | 'log';
}

export const LiveRegion: React.FC<LiveRegionProps> = ({
  children,
  politeness = 'polite',
  atomic = true,
  role = 'status',
}) => {
  return (
    <Box
      component="div"
      role={role}
      aria-live={politeness}
      aria-atomic={atomic}
      sx={{
        // Visually hidden but accessible to screen readers
        position: 'absolute',
        left: '-10000px',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
      }}
    >
      {children}
    </Box>
  );
};

interface ScreenReaderAnnouncerProps {
  message: string;
  politeness?: 'polite' | 'assertive';
  delay?: number;
}

export const ScreenReaderAnnouncer: React.FC<ScreenReaderAnnouncerProps> = ({
  message,
  politeness = 'polite',
  delay = 0,
}) => {
  const [announce, setAnnounce] = React.useState(false);

  useEffect(() => {
    if (message) {
      const timeoutId = setTimeout(() => {
        setAnnounce(true);
        // Reset after announcement
        setTimeout(() => setAnnounce(false), 1000);
      }, delay);

      return () => clearTimeout(timeoutId);
    }
  }, [message, delay]);

  if (!announce) return null;

  return (
    <LiveRegion politeness={politeness}>
      {message}
    </LiveRegion>
  );
};

// Hook for programmatic announcements
export const useScreenReader = () => {
  const announceRef = useRef<HTMLDivElement>(null);

  const announce = React.useCallback((message: string, politeness: 'polite' | 'assertive' = 'polite') => {
    if (announceRef.current) {
      announceRef.current.textContent = message;
      announceRef.current.setAttribute('aria-live', politeness);
    }
  }, []);

  return {
    announce,
    Announcer: () => (
      <Box
        ref={announceRef}
        component="div"
        aria-live="polite"
        aria-atomic="true"
        sx={{
          position: 'absolute',
          left: '-10000px',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
        }}
      />
    ),
  };
};

export default {
  ScreenReaderOnly,
  LiveRegion,
  ScreenReaderAnnouncer,
  useScreenReader,
};
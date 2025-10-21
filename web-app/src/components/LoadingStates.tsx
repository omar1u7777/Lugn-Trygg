/**
 * Loading States & Indicators
 * Reusable loading components for async operations
 */

import React from 'react';
import { CircularProgress, Skeleton, Box, Typography } from '@mui/material';
import './LoadingStates.css';

interface LoadingProps {
  isLoading: boolean;
  children?: React.ReactNode;
  message?: string;
  size?: 'small' | 'medium' | 'large';
}

/**
 * Loading Spinner
 */
export const LoadingSpinner: React.FC<LoadingProps> = ({
  isLoading,
  children,
  message = 'Laddar...',
  size = 'medium',
}) => {
  if (!isLoading) return <>{children}</>;

  const sizeMap = {
    small: 30,
    medium: 50,
    large: 70,
  };

  return (
    <Box 
      className="loading-spinner-container"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <CircularProgress 
        size={sizeMap[size]}
        aria-hidden="true"
      />
      {message && <Typography className="loading-message">{message}</Typography>}
    </Box>
  );
};

/**
 * Skeleton Loading
 */
export const SkeletonLoader: React.FC<{
  count?: number;
  type?: 'text' | 'card' | 'list';
}> = ({ count = 3, type = 'text' }) => {
  const items = Array.from({ length: count });

  if (type === 'card') {
    return (
      <Box className="skeleton-card-container">
        {items.map((_, idx) => (
          <Box key={idx} className="skeleton-card">
            <Skeleton variant="rectangular" height={200} />
            <Skeleton variant="text" height={30} style={{ marginTop: '10px' }} />
            <Skeleton variant="text" height={20} style={{ marginTop: '5px' }} />
          </Box>
        ))}
      </Box>
    );
  }

  if (type === 'list') {
    return (
      <Box className="skeleton-list-container">
        {items.map((_, idx) => (
          <Box key={idx} className="skeleton-list-item">
            <Skeleton variant="circular" width={40} height={40} />
            <Box style={{ flex: 1, marginLeft: '10px' }}>
              <Skeleton variant="text" height={20} />
              <Skeleton variant="text" height={16} width="80%" />
            </Box>
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <Box className="skeleton-text-container">
      {items.map((_, idx) => (
        <Skeleton key={idx} variant="text" height={20} style={{ marginBottom: '8px' }} />
      ))}
    </Box>
  );
};

/**
 * Loading Overlay
 */
export const LoadingOverlay: React.FC<LoadingProps> = ({
  isLoading,
  message = 'Bearbeitung...',
}) => {
  if (!isLoading) return null;

  return (
    <Box 
      className="loading-overlay"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={message}
    >
      <Box className="loading-overlay-content">
        <CircularProgress aria-hidden="true" />
        <Typography className="overlay-message">{message}</Typography>
      </Box>
    </Box>
  );
};

/**
 * Pulse Loading Indicator
 */
export const PulseLoader: React.FC<{ size?: number }> = ({ size = 30 }) => {
  // Check for prefers-reduced-motion to respect accessibility preferences
  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  return (
    <Box
      className={`pulse-loader ${prefersReducedMotion ? 'no-animation' : ''}`}
      style={{
        width: size,
        height: size,
      }}
      role="status"
      aria-label="Loading"
      aria-live="polite"
    >
      <Box 
        className="pulse-item"
        aria-hidden="true"
      />
    </Box>
  );
};

/**
 * Progressive Loading (skeleton → content)
 */
export const ProgressiveLoad: React.FC<{
  isLoading: boolean;
  children: React.ReactNode;
  skeletonCount?: number;
}> = ({ isLoading, children, skeletonCount = 3 }) => {
  if (isLoading) {
    return <SkeletonLoader count={skeletonCount} />;
  }
  return <>{children}</>;
};

export default {
  LoadingSpinner,
  SkeletonLoader,
  LoadingOverlay,
  PulseLoader,
  ProgressiveLoad,
};
